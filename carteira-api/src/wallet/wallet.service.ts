import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { centsToReais, reaisToCents } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';

export type TransactionDirection = 'IN' | 'OUT';

export interface BalanceView {
  balance: number;
}

export interface OperationResult {
  balance: number;
  transactionId: string;
}

export interface ReversalResult {
  balance: number;
  reversalTransactionId: string;
}

export interface TransactionView {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  direction: TransactionDirection;
  amount: number;
  createdAt: Date;
}

const transactionSelect = {
  id: true,
  type: true,
  status: true,
  amount: true,
  senderWalletId: true,
  receiverWalletId: true,
  createdAt: true,
} satisfies Prisma.TransactionSelect;

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string): Promise<BalanceView> {
    const wallet = await this.getWalletByUserId(userId);

    return { balance: centsToReais(wallet.balance) };
  }

  async getStatement(userId: string): Promise<TransactionView[]> {
    const wallet = await this.getWalletByUserId(userId);

    const transactions = await this.prisma.transaction.findMany({
      select: transactionSelect,
      where: {
        OR: [{ senderWalletId: wallet.id }, { receiverWalletId: wallet.id }],
      },
      orderBy: { createdAt: 'desc' },
    });

    return transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      direction: transaction.receiverWalletId === wallet.id ? 'IN' : 'OUT',
      amount: centsToReais(transaction.amount),
      createdAt: transaction.createdAt,
    }));
  }

  async deposit(userId: string, amount: number): Promise<OperationResult> {
    const amountInCents = reaisToCents(amount);

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await this.getWalletByUserId(userId, tx);

      const transaction = await tx.transaction.create({
        data: {
          type: TransactionType.DEPOSIT,
          amount: amountInCents,
          receiverWalletId: wallet.id,
        },
      });

      // Depósito é sempre um incremento: se o saldo estava negativo, ele sobe.
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amountInCents } },
      });

      return { balance: updated.balance, transactionId: transaction.id };
    });

    return {
      balance: centsToReais(result.balance),
      transactionId: result.transactionId,
    };
  }

  async transfer(
    userId: string,
    receiverEmail: string,
    amount: number,
  ): Promise<OperationResult> {
    const amountInCents = reaisToCents(amount);

    const result = await this.prisma.$transaction(async (tx) => {
      const senderWallet = await this.getWalletByUserId(userId, tx);

      const receiver = await tx.user.findUnique({
        where: { email: receiverEmail },
        select: { wallet: { select: { id: true } } },
      });

      if (!receiver?.wallet) {
        throw new NotFoundException('Destinatário não encontrado.');
      }

      if (receiver.wallet.id === senderWallet.id) {
        throw new BadRequestException(
          'Não é possível transferir para a própria carteira.',
        );
      }

      // Débito condicional: só desconta se houver saldo suficiente. Evita a
      // condição de corrida entre transferências simultâneas da mesma carteira.
      const debit = await tx.wallet.updateMany({
        where: { id: senderWallet.id, balance: { gte: amountInCents } },
        data: { balance: { decrement: amountInCents } },
      });

      if (debit.count === 0) {
        throw new UnprocessableEntityException('Saldo insuficiente.');
      }

      await tx.wallet.update({
        where: { id: receiver.wallet.id },
        data: { balance: { increment: amountInCents } },
      });

      const transaction = await tx.transaction.create({
        data: {
          type: TransactionType.TRANSFER,
          amount: amountInCents,
          senderWalletId: senderWallet.id,
          receiverWalletId: receiver.wallet.id,
        },
      });

      const updatedSender = await tx.wallet.findUniqueOrThrow({
        where: { id: senderWallet.id },
        select: { balance: true },
      });

      return { balance: updatedSender.balance, transactionId: transaction.id };
    });

    return {
      balance: centsToReais(result.balance),
      transactionId: result.transactionId,
    };
  }

  async reverse(
    userId: string,
    transactionId: string,
  ): Promise<ReversalResult> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const wallet = await this.getWalletByUserId(userId, tx);

        const original = await tx.transaction.findUnique({
          where: { id: transactionId },
        });

        if (!original) {
          throw new NotFoundException('Transação não encontrada.');
        }

        const isParticipant =
          original.senderWalletId === wallet.id ||
          original.receiverWalletId === wallet.id;

        if (!isParticipant) {
          throw new ForbiddenException('Você não participa desta transação.');
        }

        if (original.type === TransactionType.REVERSAL) {
          throw new UnprocessableEntityException(
            'Uma reversão não pode ser revertida.',
          );
        }

        if (original.status === TransactionStatus.REVERSED) {
          throw new UnprocessableEntityException('Transação já foi revertida.');
        }

        // A reversão desfaz o movimento original. Ela tem prioridade sobre o
        // saldo e pode deixá-lo negativo (cenário previsto no enunciado).
        if (original.senderWalletId) {
          await tx.wallet.update({
            where: { id: original.senderWalletId },
            data: { balance: { increment: original.amount } },
          });
        }

        if (original.receiverWalletId) {
          await tx.wallet.update({
            where: { id: original.receiverWalletId },
            data: { balance: { decrement: original.amount } },
          });
        }

        await tx.transaction.update({
          where: { id: original.id },
          data: { status: TransactionStatus.REVERSED },
        });

        const reversal = await tx.transaction.create({
          data: {
            type: TransactionType.REVERSAL,
            amount: original.amount,
            // Inverte o fluxo de dinheiro em relação à transação original.
            senderWalletId: original.receiverWalletId,
            receiverWalletId: original.senderWalletId,
            relatedTransactionId: original.id,
          },
        });

        const updatedWallet = await this.getWalletByUserId(userId, tx);

        return {
          balance: updatedWallet.balance,
          reversalTransactionId: reversal.id,
        };
      });

      return {
        balance: centsToReais(result.balance),
        reversalTransactionId: result.reversalTransactionId,
      };
    } catch (error) {
      // A constraint única em relatedTransactionId barra, no banco, reversões
      // concorrentes da mesma transação.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new UnprocessableEntityException('Transação já foi revertida.');
      }

      throw error;
    }
  }

  private async getWalletByUserId(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const wallet = await client.wallet.findUnique({ where: { userId } });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada.');
    }

    return wallet;
  }
}
