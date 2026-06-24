import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async deposit(userId: string, amountInCents: number) {
    const amount = BigInt(amountInCents);

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });

      if (!wallet) {
        throw new NotFoundException('Carteira não encontrada.');
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      });

      const transaction = await tx.transaction.create({
        data: {
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.COMPLETED,
          amount,
          receiverWalletId: wallet.id,
          senderWalletId: null,
        },
      });

      return { transaction, balance: updatedWallet.balance };
    });
  }

  async transfer(
    senderUserId: string,
    receiverId: string,
    amountInCents: number,
  ) {
    const senderWallet = await this.prisma.wallet.findUnique({
      where: { userId: senderUserId },
    });

    if (!senderWallet) {
      throw new NotFoundException('Carteira não encontrada.');
    }

    if (senderWallet.userId === receiverId) {
      throw new BadRequestException('Não é possível transferir para si mesmo.');
    }

    const receiverWallet = await this.prisma.wallet.findUnique({
      where: { userId: receiverId },
    });

    if (!receiverWallet) {
      throw new NotFoundException('Carteira do destinatário não encontrada.');
    }

    const amount = BigInt(amountInCents);

    return this.prisma.$transaction(async (tx) => {
      // Travar sempre na mesma ordem (por id) evita deadlock quando duas
      // transferências cruzadas tentam adquirir os locks em sentidos opostos.
      const [firstId, secondId] = [senderWallet.id, receiverWallet.id].sort();

      // A validação autoritativa de existência e saldo fica aqui, após o lock,
      // porque o pré-check externo sofre TOCTOU: uma wallet pode ser removida
      // entre o SELECT inicial e o início desta transação. O FOR UPDATE garante
      // que lemos o estado comprometido e bloqueamos escritas concorrentes.
      const locked = await tx.$queryRaw<{ id: string; balance: bigint }[]>`
        SELECT id, balance
        FROM "Wallet"
        WHERE id IN (${firstId}::uuid, ${secondId}::uuid)
        ORDER BY id
        FOR UPDATE
      `;

      if (locked.length !== 2) {
        throw new NotFoundException('Carteira não encontrada.');
      }

      const lockedSender = locked.find((w) => w.id === senderWallet.id)!;

      if (lockedSender.balance < amount) {
        throw new BadRequestException('Saldo insuficiente.');
      }

      const updatedSender = await tx.wallet.update({
        where: { id: senderWallet.id },
        data: { balance: { decrement: amount } },
      });

      await tx.wallet.update({
        where: { id: receiverWallet.id },
        data: { balance: { increment: amount } },
      });

      const transaction = await tx.transaction.create({
        data: {
          type: TransactionType.TRANSFER,
          status: TransactionStatus.COMPLETED,
          amount,
          senderWalletId: senderWallet.id,
          receiverWalletId: receiverWallet.id,
        },
      });

      return { transaction, balance: updatedSender.balance };
    });
  }

  async reverse(userId: string, transactionId: string) {
    const userWallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!userWallet) {
      throw new NotFoundException('Carteira não encontrada.');
    }

    const original = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!original) {
      throw new NotFoundException('Transação não encontrada.');
    }

    const isParticipant =
      original.senderWalletId === userWallet.id ||
      original.receiverWalletId === userWallet.id;

    if (!isParticipant) {
      throw new ForbiddenException(
        'Você não tem permissão para reverter esta transação.',
      );
    }

    if (original.type === TransactionType.REVERSAL) {
      throw new BadRequestException('Não é possível reverter um estorno.');
    }

    // A constraint @unique em relatedTransactionId é a rede de segurança no
    // banco: se duas requisições concorrentes passarem por aqui simultaneamente,
    // apenas uma conseguirá inserir a reversão — a outra receberá P2002.
    if (original.status === TransactionStatus.REVERSED) {
      throw new ConflictException('Transação já revertida.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Trava a linha da transação original antes de qualquer movimento de saldo.
      // A releitura do status pós-lock serializa reversões concorrentes: a segunda
      // requisição espera o commit da primeira e então enxerga REVERSED, saindo
      // limpa sem tentar o insert. A constraint @unique em relatedTransactionId
      // é defesa em profundidade para o que escapar desta checagem.
      await tx.$queryRaw`
        SELECT id FROM "Transaction"
        WHERE id = ${original.id}::uuid
        FOR UPDATE
      `;

      const reloaded = await tx.transaction.findUnique({
        where: { id: original.id },
      });

      // A transação pode ter sumido entre o pré-check e o FOR UPDATE; sem este
      // guard, o update adiante lançaria P2025 e devolveria 500 em vez de 404.
      if (!reloaded) {
        throw new NotFoundException('Transação não encontrada.');
      }

      if (reloaded.status === TransactionStatus.REVERSED) {
        throw new ConflictException('Transação já revertida.');
      }

      // Coleta os ids das wallets afetadas (depósito tem apenas receiver).
      const walletIds = [
        original.senderWalletId,
        original.receiverWalletId,
      ].filter((id): id is string => id !== null);

      // Travar sempre na mesma ordem (por id) evita deadlock entre reversões
      // concorrentes de transações que compartilham as mesmas wallets.
      const sortedIds = [...walletIds].sort();

      await tx.$queryRaw`
        SELECT id FROM "Wallet"
        WHERE id IN (${Prisma.join(sortedIds.map((id) => Prisma.sql`${id}::uuid`))})
        ORDER BY id
        FOR UPDATE
      `;

      // A reversão é autoritativa: não valida saldo suficiente. O domínio
      // aceita saldo negativo como consequência de um estorno legítimo.
      let reversalSenderWalletId: string | null = null;
      let reversalReceiverWalletId: string | null = null;
      const balances: Record<string, bigint> = {};

      try {
        if (original.type === TransactionType.DEPOSIT) {
          // Desfaz o depósito: debita da wallet que recebeu.
          const updated = await tx.wallet.update({
            where: { id: original.receiverWalletId! },
            data: { balance: { decrement: original.amount } },
          });
          reversalSenderWalletId = original.receiverWalletId;
          balances[original.receiverWalletId!] = updated.balance;
        } else {
          // Desfaz a transferência: devolve ao sender original, retira do receiver.
          const updatedSender = await tx.wallet.update({
            where: { id: original.senderWalletId! },
            data: { balance: { increment: original.amount } },
          });
          const updatedReceiver = await tx.wallet.update({
            where: { id: original.receiverWalletId! },
            data: { balance: { decrement: original.amount } },
          });
          reversalSenderWalletId = original.receiverWalletId;
          reversalReceiverWalletId = original.senderWalletId;
          balances[original.senderWalletId!] = updatedSender.balance;
          balances[original.receiverWalletId!] = updatedReceiver.balance;
        }
      } catch (error) {
        // P2025: wallet foi removida entre o pré-check e esta transação.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          throw new NotFoundException('Carteira não encontrada.');
        }
        throw error;
      }

      await tx.transaction.update({
        where: { id: original.id },
        data: { status: TransactionStatus.REVERSED },
      });

      try {
        const reversal = await tx.transaction.create({
          data: {
            type: TransactionType.REVERSAL,
            status: TransactionStatus.COMPLETED,
            amount: original.amount,
            relatedTransactionId: original.id,
            senderWalletId: reversalSenderWalletId,
            receiverWalletId: reversalReceiverWalletId,
          },
        });

        return { reversal, balances };
      } catch (error) {
        // P2002: insert de REVERSAL colidiu com outra requisição concorrente —
        // defesa em profundidade caso o lock da Transaction não tenha sido
        // suficiente (ex.: réplica de leitura ou isolamento rebaixado).
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException('Transação já revertida.');
        }
        throw error;
      }
    });
  }

  async getBalance(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada.');
    }

    // Saldo em centavos (BigInt serializado como string); o cliente formata em R$.
    return { balance: wallet.balance };
  }

  async findAllByUser(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada.');
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [{ senderWalletId: wallet.id }, { receiverWalletId: wallet.id }],
      },
      orderBy: { createdAt: 'desc' },
    });

    // Anota a direção sob a ótica do usuário: entrada (recebeu) ou saída (enviou).
    return transactions.map((transaction) => ({
      ...transaction,
      direction: transaction.receiverWalletId === wallet.id ? 'IN' : 'OUT',
    }));
  }
}
