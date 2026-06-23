import { Injectable, NotFoundException } from '@nestjs/common';
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
