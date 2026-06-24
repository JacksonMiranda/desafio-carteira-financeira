import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { validate } from 'class-validator';
import { DepositDto } from './dto/deposit.dto';
import { TransactionsService } from './transactions.service';

// ---------------------------------------------------------------------------
// Fábrica de mocks — cria instâncias limpas para cada teste
// ---------------------------------------------------------------------------

function makePrisma() {
  const txMock = {
    wallet: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const prisma = {
    wallet: {
      findUnique: jest.fn(),
    },
    transaction: {
      findUnique: jest.fn(),
    },
    $transaction: jest
      .fn()
      .mockImplementation((fn: (tx: typeof txMock) => unknown) => fn(txMock)),
  };

  return { prisma, txMock };
}

// ---------------------------------------------------------------------------
// Fixtures reutilizadas nos testes de reversão
// ---------------------------------------------------------------------------

const walletA = {
  id: 'aaaaaaaa-0000-0000-0000-000000000000',
  userId: 'user-a',
};
const walletB = {
  id: 'bbbbbbbb-0000-0000-0000-000000000000',
  userId: 'user-b',
};

const depositTx = {
  id: 'tx-deposit-1',
  type: TransactionType.DEPOSIT,
  status: TransactionStatus.COMPLETED,
  amount: BigInt(1000),
  senderWalletId: null,
  receiverWalletId: walletA.id,
};

const transferTx = {
  id: 'tx-transfer-1',
  type: TransactionType.TRANSFER,
  status: TransactionStatus.COMPLETED,
  amount: BigInt(500),
  senderWalletId: walletA.id,
  receiverWalletId: walletB.id,
};

// Configura um prisma mock pronto para chegar ao $transaction de reverse()
function makeReversePrisma(original: typeof depositTx | typeof transferTx) {
  const { prisma, txMock } = makePrisma();
  prisma.wallet.findUnique.mockResolvedValue(walletA);
  prisma.transaction.findUnique.mockResolvedValue(original);
  // $queryRaw chamado duas vezes: lock da Transaction e lock das Wallets
  txMock.$queryRaw.mockResolvedValue([]);
  // releitura do status dentro da transação deve mostrar COMPLETED
  txMock.transaction.findUnique.mockResolvedValue(original);
  txMock.transaction.update.mockResolvedValue({});
  return { prisma, txMock };
}

// ---------------------------------------------------------------------------
// Testes de validação do DTO
// ---------------------------------------------------------------------------

describe('DepositDto — validação de amount', () => {
  it('rejeita amount igual a zero', async () => {
    const dto = Object.assign(new DepositDto(), { amount: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejeita amount negativo', async () => {
    const dto = Object.assign(new DepositDto(), { amount: -100 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('aceita amount positivo', async () => {
    const dto = Object.assign(new DepositDto(), { amount: 100 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Testes do serviço
// ---------------------------------------------------------------------------

describe('TransactionsService', () => {
  // -------------------------------------------------------------------------
  describe('deposit()', () => {
    it('soma o amount ao balance e cria Transaction DEPOSIT', async () => {
      const { prisma, txMock } = makePrisma();
      const service = new TransactionsService(prisma as any);

      txMock.wallet.findUnique.mockResolvedValue({
        ...walletA,
        balance: BigInt(500),
      });
      txMock.wallet.update.mockResolvedValue({
        ...walletA,
        balance: BigInt(1500),
      });
      const created = { id: 'tx-1', type: TransactionType.DEPOSIT };
      txMock.transaction.create.mockResolvedValue(created);

      const result = await service.deposit(walletA.userId, 1000);

      expect(txMock.wallet.update).toHaveBeenCalledWith({
        where: { id: walletA.id },
        data: { balance: { increment: BigInt(1000) } },
      });
      expect(txMock.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.COMPLETED,
          amount: BigInt(1000),
          receiverWalletId: walletA.id,
          senderWalletId: null,
        }),
      });
      expect(result).toEqual({ transaction: created, balance: BigInt(1500) });
    });

    it('funciona com saldo negativo — apenas soma, sem validação de mínimo', async () => {
      const { prisma, txMock } = makePrisma();
      const service = new TransactionsService(prisma as any);

      // Saldo inicial negativo
      txMock.wallet.findUnique.mockResolvedValue({
        ...walletA,
        balance: BigInt(-300),
      });
      txMock.wallet.update.mockResolvedValue({
        ...walletA,
        balance: BigInt(700),
      });
      txMock.transaction.create.mockResolvedValue({ id: 'tx-1' });

      const result = await service.deposit(walletA.userId, 1000);

      expect(txMock.wallet.update).toHaveBeenCalled();
      expect(result.balance).toBe(BigInt(700));
    });

    it('lança NotFoundException quando a wallet não existe', async () => {
      const { prisma, txMock } = makePrisma();
      const service = new TransactionsService(prisma as any);

      txMock.wallet.findUnique.mockResolvedValue(null);

      await expect(service.deposit(walletA.userId, 1000)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('transfer()', () => {
    it('rejeita transferência para si mesmo', async () => {
      const { prisma } = makePrisma();
      const service = new TransactionsService(prisma as any);

      prisma.wallet.findUnique.mockResolvedValue(walletA);

      await expect(
        service.transfer(walletA.userId, walletA.userId, 100),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança NotFoundException quando a wallet do destinatário não existe', async () => {
      const { prisma } = makePrisma();
      const service = new TransactionsService(prisma as any);

      prisma.wallet.findUnique
        .mockResolvedValueOnce(walletA) // sender
        .mockResolvedValueOnce(null); // receiver ausente

      await expect(
        service.transfer(walletA.userId, walletB.userId, 100),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejeita quando o saldo travado é insuficiente', async () => {
      const { prisma, txMock } = makePrisma();
      const service = new TransactionsService(prisma as any);

      prisma.wallet.findUnique
        .mockResolvedValueOnce(walletA)
        .mockResolvedValueOnce(walletB);

      // Sender tem apenas 50 centavos no lock
      txMock.$queryRaw.mockResolvedValue([
        { id: walletA.id, balance: BigInt(50) },
        { id: walletB.id, balance: BigInt(0) },
      ]);

      await expect(
        service.transfer(walletA.userId, walletB.userId, 1000),
      ).rejects.toThrow(new BadRequestException('Saldo insuficiente.'));
    });

    it('debita sender, credita receiver e cria Transaction TRANSFER', async () => {
      const { prisma, txMock } = makePrisma();
      const service = new TransactionsService(prisma as any);

      prisma.wallet.findUnique
        .mockResolvedValueOnce(walletA)
        .mockResolvedValueOnce(walletB);

      txMock.$queryRaw.mockResolvedValue([
        { id: walletA.id, balance: BigInt(5000) },
        { id: walletB.id, balance: BigInt(0) },
      ]);

      const updatedSender = { ...walletA, balance: BigInt(4000) };
      txMock.wallet.update
        .mockResolvedValueOnce(updatedSender) // decrement sender
        .mockResolvedValueOnce({ ...walletB, balance: BigInt(1000) }); // increment receiver

      const created = { id: 'tx-1', type: TransactionType.TRANSFER };
      txMock.transaction.create.mockResolvedValue(created);

      const result = await service.transfer(
        walletA.userId,
        walletB.userId,
        1000,
      );

      const amount = BigInt(1000);

      expect(txMock.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: walletA.id },
          data: { balance: { decrement: amount } },
        }),
      );
      expect(txMock.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: walletB.id },
          data: { balance: { increment: amount } },
        }),
      );
      expect(txMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: TransactionType.TRANSFER,
            senderWalletId: walletA.id,
            receiverWalletId: walletB.id,
          }),
        }),
      );
      expect(result).toEqual({ transaction: created, balance: BigInt(4000) });
    });
  });

  // -------------------------------------------------------------------------
  describe('reverse()', () => {
    it('lança NotFoundException para transação inexistente', async () => {
      const { prisma } = makePrisma();
      const service = new TransactionsService(prisma as any);

      prisma.wallet.findUnique.mockResolvedValue(walletA);
      prisma.transaction.findUnique.mockResolvedValue(null);

      await expect(
        service.reverse(walletA.userId, 'tx-missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando o usuário não é participante', async () => {
      const { prisma } = makePrisma();
      const service = new TransactionsService(prisma as any);

      // walletA não aparece em depositTx — depositTx usa walletA como receiver,
      // mas aqui o usuário tem uma wallet diferente (walletC)
      const walletC = {
        id: 'cccccccc-0000-0000-0000-000000000000',
        userId: 'user-c',
      };
      prisma.wallet.findUnique.mockResolvedValue(walletC);
      prisma.transaction.findUnique.mockResolvedValue(depositTx);

      await expect(service.reverse('user-c', depositTx.id)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lança BadRequestException ao tentar reverter um REVERSAL', async () => {
      const { prisma } = makePrisma();
      const service = new TransactionsService(prisma as any);

      const reversalTx = { ...depositTx, type: TransactionType.REVERSAL };
      prisma.wallet.findUnique.mockResolvedValue(walletA);
      prisma.transaction.findUnique.mockResolvedValue(reversalTx);

      await expect(
        service.reverse(walletA.userId, reversalTx.id),
      ).rejects.toThrow(
        new BadRequestException('Não é possível reverter um estorno.'),
      );
    });

    it('lança ConflictException quando a transação já está REVERSED', async () => {
      const { prisma } = makePrisma();
      const service = new TransactionsService(prisma as any);

      const reversedTx = { ...depositTx, status: TransactionStatus.REVERSED };
      prisma.wallet.findUnique.mockResolvedValue(walletA);
      prisma.transaction.findUnique.mockResolvedValue(reversedTx);

      await expect(
        service.reverse(walletA.userId, reversedTx.id),
      ).rejects.toThrow(ConflictException);
    });

    it('lança ConflictException quando a releitura pós-lock detecta status REVERSED', async () => {
      // Simula a segunda requisição concorrente: passa no pré-check, mas ao
      // reler dentro da transação já encontra REVERSED.
      const { prisma, txMock } = makePrisma();
      const service = new TransactionsService(prisma as any);

      prisma.wallet.findUnique.mockResolvedValue(walletA);
      prisma.transaction.findUnique.mockResolvedValue(depositTx); // pré-check: COMPLETED
      txMock.$queryRaw.mockResolvedValue([]);
      txMock.transaction.findUnique.mockResolvedValue({
        ...depositTx,
        status: TransactionStatus.REVERSED, // releitura pós-lock
      });

      await expect(
        service.reverse(walletA.userId, depositTx.id),
      ).rejects.toThrow(ConflictException);
    });

    it('lança NotFoundException quando a transação some entre o pré-check e o lock', async () => {
      // Raça: passa no pré-check, mas a releitura pós-lock retorna null.
      const { prisma, txMock } = makePrisma();
      const service = new TransactionsService(prisma as any);

      prisma.wallet.findUnique.mockResolvedValue(walletA);
      prisma.transaction.findUnique.mockResolvedValue(depositTx); // pré-check: existe
      txMock.$queryRaw.mockResolvedValue([]);
      txMock.transaction.findUnique.mockResolvedValue(null); // sumiu após o lock

      await expect(
        service.reverse(walletA.userId, depositTx.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('reverte DEPOSIT: debita receiverWallet e aceita saldo negativo', async () => {
      const { prisma, txMock } = makeReversePrisma(depositTx);
      const service = new TransactionsService(prisma as any);

      // Saldo cai abaixo de zero — comportamento aceito pelo domínio
      txMock.wallet.update.mockResolvedValue({
        ...walletA,
        balance: BigInt(-500),
      });
      const reversalRecord = { id: 'rev-1', type: TransactionType.REVERSAL };
      txMock.transaction.create.mockResolvedValue(reversalRecord);

      const result = await service.reverse(walletA.userId, depositTx.id);

      expect(txMock.wallet.update).toHaveBeenCalledWith({
        where: { id: walletA.id },
        data: { balance: { decrement: depositTx.amount } },
      });
      expect(txMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: TransactionType.REVERSAL,
            relatedTransactionId: depositTx.id,
            senderWalletId: walletA.id, // quem recebeu o depósito vira sender da reversão
            receiverWalletId: null,
          }),
        }),
      );
      expect(result.reversal).toBe(reversalRecord);
      expect(result.balances[walletA.id]).toBe(BigInt(-500));
    });

    it('reverte TRANSFER: credita sender original e debita receiver original', async () => {
      const { prisma, txMock } = makeReversePrisma(transferTx);
      const service = new TransactionsService(prisma as any);

      const senderAfter = { ...walletA, balance: BigInt(500) };
      const receiverAfter = { ...walletB, balance: BigInt(0) };
      txMock.wallet.update
        .mockResolvedValueOnce(senderAfter) // increment sender original
        .mockResolvedValueOnce(receiverAfter); // decrement receiver original

      const reversalRecord = { id: 'rev-2', type: TransactionType.REVERSAL };
      txMock.transaction.create.mockResolvedValue(reversalRecord);

      const result = await service.reverse(walletA.userId, transferTx.id);

      // Sender original recebe o dinheiro de volta
      expect(txMock.wallet.update).toHaveBeenCalledWith({
        where: { id: walletA.id },
        data: { balance: { increment: transferTx.amount } },
      });
      // Receiver original é debitado
      expect(txMock.wallet.update).toHaveBeenCalledWith({
        where: { id: walletB.id },
        data: { balance: { decrement: transferTx.amount } },
      });
      expect(txMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: TransactionType.REVERSAL,
            relatedTransactionId: transferTx.id,
            senderWalletId: walletB.id, // fluxo invertido
            receiverWalletId: walletA.id,
          }),
        }),
      );
      expect(result.balances[walletA.id]).toBe(BigInt(500));
      expect(result.balances[walletB.id]).toBe(BigInt(0));
    });

    it('atualiza o status da transação original para REVERSED', async () => {
      const { prisma, txMock } = makeReversePrisma(depositTx);
      const service = new TransactionsService(prisma as any);

      txMock.wallet.update.mockResolvedValue({
        ...walletA,
        balance: BigInt(0),
      });
      txMock.transaction.create.mockResolvedValue({ id: 'rev-1' });

      await service.reverse(walletA.userId, depositTx.id);

      expect(txMock.transaction.update).toHaveBeenCalledWith({
        where: { id: depositTx.id },
        data: { status: TransactionStatus.REVERSED },
      });
    });

    it('converte P2025 em NotFoundException quando wallet é removida durante a operação', async () => {
      const { prisma, txMock } = makeReversePrisma(depositTx);
      const service = new TransactionsService(prisma as any);

      // Simula wallet removida entre o pré-check e o wallet.update dentro da transação
      const p2025 = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '0.0.0',
      });
      txMock.wallet.update.mockRejectedValue(p2025);

      await expect(
        service.reverse(walletA.userId, depositTx.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('converte P2002 em ConflictException quando insert de REVERSAL colide', async () => {
      const { prisma, txMock } = makeReversePrisma(depositTx);
      const service = new TransactionsService(prisma as any);

      txMock.wallet.update.mockResolvedValue({
        ...walletA,
        balance: BigInt(0),
      });

      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint',
        {
          code: 'P2002',
          clientVersion: '0.0.0',
        },
      );
      txMock.transaction.create.mockRejectedValue(p2002);

      await expect(
        service.reverse(walletA.userId, depositTx.id),
      ).rejects.toThrow(ConflictException);
    });
  });

  // -------------------------------------------------------------------------
  describe('getBalance()', () => {
    it('retorna o saldo da carteira em centavos', async () => {
      const { prisma } = makePrisma();
      const service = new TransactionsService(prisma as any);

      prisma.wallet.findUnique.mockResolvedValue({
        ...walletA,
        balance: BigInt(2500),
      });

      const result = await service.getBalance(walletA.userId);

      expect(result).toEqual({ balance: BigInt(2500) });
    });

    it('lança NotFoundException quando a wallet não existe', async () => {
      const { prisma } = makePrisma();
      const service = new TransactionsService(prisma as any);

      prisma.wallet.findUnique.mockResolvedValue(null);

      await expect(service.getBalance(walletA.userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('findAllByUser()', () => {
    it('anota a direção de cada transação sob a ótica do usuário (IN/OUT)', async () => {
      const { prisma } = makePrisma();
      const service = new TransactionsService(prisma as any);

      // received: usuário (walletA) é o receiver → IN
      // sent: usuário é o sender → OUT
      const received = {
        id: 'tx-in',
        receiverWalletId: walletA.id,
        senderWalletId: walletB.id,
      };
      const sent = {
        id: 'tx-out',
        receiverWalletId: walletB.id,
        senderWalletId: walletA.id,
      };

      prisma.wallet.findUnique.mockResolvedValue(walletA);
      (prisma as any).transaction = {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([received, sent]),
      };

      const result = await service.findAllByUser(walletA.userId);

      expect(result).toEqual([
        { ...received, direction: 'IN' },
        { ...sent, direction: 'OUT' },
      ]);
    });

    it('lança NotFoundException quando a wallet não existe', async () => {
      const { prisma } = makePrisma();
      const service = new TransactionsService(prisma as any);

      prisma.wallet.findUnique.mockResolvedValue(null);

      await expect(service.findAllByUser(walletA.userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
