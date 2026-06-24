// Importa o patch de BigInt antes de qualquer uso, pois o main.ts não é
// carregado nos testes — sem isso, campos monetários (BigInt) causariam
// TypeError ao serializar a resposta JSON.
import '../src/common/bigint.serializer';

import { execSync } from 'child_process';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';

// Caminho absoluto para o binário do Prisma — funciona em Unix e Windows
// sem depender do shell wrapper (.cmd) que não é suportado via execSync cross-platform.
const prismaBin = path.join(
  __dirname,
  '..',
  'node_modules',
  'prisma',
  'build',
  'index.js',
);

// DATABASE_URL de teste é definida em test/env-setup.js (setupFiles).
const TEST_DB_URL = process.env.DATABASE_URL!;

// Valores em centavos usados ao longo dos testes
const DEPOSIT_AMOUNT = 5000; // R$ 50,00
const TRANSFER_AMOUNT = 2000; // R$ 20,00

// ---------------------------------------------------------------------------
// Tipos das respostas da API
// ---------------------------------------------------------------------------

type RegisterBody = { id: string; name: string; email: string };
type LoginBody = { access_token: string };

type TransactionRecord = {
  id: string;
  type: string;
  status: string;
  amount: string; // BigInt serializado como string
  senderWalletId: string | null;
  receiverWalletId: string | null;
  relatedTransactionId: string | null;
};

type DepositBody = { transaction: TransactionRecord; balance: string };
type TransferBody = { transaction: TransactionRecord; balance: string };
type ReverseBody = {
  reversal: TransactionRecord;
  balances: Record<string, string>;
};

// ---------------------------------------------------------------------------

describe('Transactions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Aplica migrations no schema de teste antes de inicializar a aplicação.
    // Usa o mesmo banco Postgres, schema separado ("e2e") para não poluir dev.
    execSync(`node "${prismaBin}" migrate deploy`, {
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdio: 'pipe',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  async function cleanDatabase() {
    // Ordem respeita as FK: transações antes de carteiras, carteiras antes de usuários.
    await prisma.transaction.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.user.deleteMany();
  }

  // -------------------------------------------------------------------------
  // Helpers de requisição
  // -------------------------------------------------------------------------

  async function register(
    name: string,
    email: string,
    password = 'senha123',
  ): Promise<RegisterBody> {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name, email, password })
      .expect(201);
    return res.body as RegisterBody;
  }

  async function login(email: string, password = 'senha123'): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    return (res.body as LoginBody).access_token;
  }

  function authHeader(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  // =========================================================================
  // Fluxo crítico
  // =========================================================================

  it('fluxo crítico: cadastro → depósito → transferência → reversão → dupla reversão', async () => {
    // 1. Cadastra usuário A e usuário B
    await register('Usuário A', 'a@e2e.test');
    const userB = await register('Usuário B', 'b@e2e.test');

    // 2. Login de A
    const tokenA = await login('a@e2e.test');

    // 3. Depósito — verifica saldo e registro de transação
    const depositRes = await request(app.getHttpServer())
      .post('/transactions/deposit')
      .set(authHeader(tokenA))
      .send({ amount: DEPOSIT_AMOUNT })
      .expect(201);

    const deposit = depositRes.body as DepositBody;
    expect(deposit.balance).toBe(String(DEPOSIT_AMOUNT));
    expect(deposit.transaction).toMatchObject({
      type: 'DEPOSIT',
      status: 'COMPLETED',
      amount: String(DEPOSIT_AMOUNT),
      senderWalletId: null,
    });

    const walletAId = deposit.transaction.receiverWalletId!;

    // Registro aparece no histórico
    const listAfterDeposit = await request(app.getHttpServer())
      .get('/transactions')
      .set(authHeader(tokenA))
      .expect(200);

    expect(listAfterDeposit.body).toHaveLength(1);
    expect(listAfterDeposit.body[0]).toMatchObject({
      type: 'DEPOSIT',
      status: 'COMPLETED',
    });

    // 4. Transferência A → B — verifica saldos de A e B
    const transferRes = await request(app.getHttpServer())
      .post('/transactions/transfer')
      .set(authHeader(tokenA))
      .send({ receiverId: userB.id, amount: TRANSFER_AMOUNT })
      .expect(201);

    const transfer = transferRes.body as TransferBody;
    const transferTxId = transfer.transaction.id;
    const walletBId = transfer.transaction.receiverWalletId!;

    expect(transfer.balance).toBe(String(DEPOSIT_AMOUNT - TRANSFER_AMOUNT)); // 3000
    expect(transfer.transaction).toMatchObject({
      type: 'TRANSFER',
      status: 'COMPLETED',
      amount: String(TRANSFER_AMOUNT),
      senderWalletId: walletAId,
      receiverWalletId: walletBId,
    });

    // Histórico de A tem depósito + transferência
    const listAfterTransfer = await request(app.getHttpServer())
      .get('/transactions')
      .set(authHeader(tokenA))
      .expect(200);

    expect(listAfterTransfer.body).toHaveLength(2);

    // 5. A reverte a transferência — saldos voltam e original fica REVERSED
    const reverseRes = await request(app.getHttpServer())
      .post(`/transactions/${transferTxId}/reverse`)
      .set(authHeader(tokenA))
      .expect(201);

    const reverse = reverseRes.body as ReverseBody;

    expect(reverse.reversal).toMatchObject({
      type: 'REVERSAL',
      status: 'COMPLETED',
      amount: String(TRANSFER_AMOUNT),
      relatedTransactionId: transferTxId,
      senderWalletId: walletBId, // fluxo invertido em relação à original
      receiverWalletId: walletAId,
    });

    // Saldo de A volta ao valor pós-depósito; B volta a 0
    expect(reverse.balances[walletAId]).toBe(String(DEPOSIT_AMOUNT));
    expect(reverse.balances[walletBId]).toBe('0');

    // Transação original consta como REVERSED no histórico
    const listAfterReverse = await request(app.getHttpServer())
      .get('/transactions')
      .set(authHeader(tokenA))
      .expect(200);

    const originalInList = (listAfterReverse.body as TransactionRecord[]).find(
      (tx) => tx.id === transferTxId,
    );
    expect(originalInList?.status).toBe('REVERSED');

    // 6. Segunda tentativa de reverter a mesma transferência → 409
    const doubleReverseRes = await request(app.getHttpServer())
      .post(`/transactions/${transferTxId}/reverse`)
      .set(authHeader(tokenA))
      .expect(409);

    expect(doubleReverseRes.body.message).toContain('Transação já revertida.');
  });

  // =========================================================================
  // Rota protegida sem token → 401
  // =========================================================================

  it('rota protegida sem token retorna 401', async () => {
    await request(app.getHttpServer())
      .post('/transactions/deposit')
      .send({ amount: 100 })
      .expect(401);

    await request(app.getHttpServer())
      .post('/transactions/transfer')
      .send({ receiverId: 'qualquer-id', amount: 100 })
      .expect(401);

    await request(app.getHttpServer()).get('/transactions').expect(401);
  });

  // =========================================================================
  // Transferência com saldo insuficiente → 400
  // =========================================================================

  it('transferência com saldo insuficiente retorna 400 com mensagem PT-BR', async () => {
    await register('Usuário A', 'a@e2e.test');
    const userB = await register('Usuário B', 'b@e2e.test');
    const tokenA = await login('a@e2e.test');

    // Deposita 100 centavos (R$ 1,00)
    await request(app.getHttpServer())
      .post('/transactions/deposit')
      .set(authHeader(tokenA))
      .send({ amount: 100 })
      .expect(201);

    // Tenta transferir 5000 centavos — bem acima do saldo
    const res = await request(app.getHttpServer())
      .post('/transactions/transfer')
      .set(authHeader(tokenA))
      .send({ receiverId: userB.id, amount: 5000 })
      .expect(400);

    expect(res.body.message).toBe('Saldo insuficiente.');
  });
});
