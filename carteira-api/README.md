# Carteira API

API REST da carteira financeira: cadastro e autenticação de usuários e as operações de saldo — depósito, transferência e reversão.

> **Valores em centavos.** Os montantes trafegam como inteiros em centavos e são persistidos como `BigInt` (serializado como string no JSON) para evitar imprecisão de ponto flutuante. A formatação em reais fica a cargo do cliente.

## Tecnologias

- **NestJS** + **TypeScript**
- **Prisma** ORM com **PostgreSQL**
- **JWT** (Passport) para autenticação e **bcrypt** para hash de senha
- **Docker Compose** para subir o banco
- **Jest** para os testes

## Requisitos

- Node.js 20+
- Docker e Docker Compose

## Configuração

```bash
# variáveis de ambiente
cp .env.example .env

# sobe o PostgreSQL
docker compose up -d

# dependências
npm install

# aplica as migrations e gera o client do Prisma
npx prisma migrate deploy
npx prisma generate
```

## Execução

```bash
npm run start:dev      # desenvolvimento (watch)
npm run start:prod     # produção (após npm run build)
```

A API fica disponível em `http://localhost:3000`.

## Scripts

```bash
npm run build          # compila para dist/
npm run lint           # ESLint
npm run test           # testes unitários
npm run test:e2e       # testes de integração
npm run test:cov       # cobertura
```

## Endpoints

Autenticação:

- `POST /auth/register` — cadastra um usuário (a carteira é criada automaticamente)
- `POST /auth/login` — autentica e retorna o `access_token`
- `GET /auth/profile` — dados do usuário autenticado (requer `Bearer token`)

Transações (todas exigem `Bearer token`):

- `POST /transactions/deposit` — deposita `{ amount }` (centavos) na carteira
- `POST /transactions/transfer` — transfere `{ receiverId, amount }` para outro usuário
- `POST /transactions/:id/reverse` — reverte um depósito ou transferência
- `GET /transactions/balance` — saldo atual (em centavos)
- `GET /transactions` — histórico, com `direction` (`IN`/`OUT`) por transação

### Documentação interativa (Swagger)

Com a API no ar, acesse `http://localhost:3000/docs`. Use o botão **Authorize**
para colar o `access_token` e testar as rotas protegidas.

## Estrutura

```
src/
├── auth/          # autenticação (JWT, guard, strategy e DTOs)
├── users/         # cadastro de usuários
├── transactions/  # depósito, transferência, reversão, saldo e extrato
├── prisma/        # acesso ao banco
└── common/        # utilidades compartilhadas (validação, serializer de BigInt)
```

## Testes

```bash
npm run test       # unitários (serviço de transações + validação de DTO)
npm run test:e2e   # integração: fluxo completo contra um Postgres real
```

Os testes e2e aplicam as migrations num schema isolado (`e2e`) e limpam os
dados entre os casos, então exigem o **PostgreSQL do Docker Compose no ar**.

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | conexão com o PostgreSQL |
| `JWT_SECRET` | segredo usado para assinar os tokens |
| `JWT_EXPIRES_IN` | tempo de expiração do token (ex.: `1d`) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | credenciais do banco usadas pelo Docker |
