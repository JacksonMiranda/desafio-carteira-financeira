import {
  BadRequestException,
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
