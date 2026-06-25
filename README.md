# Carteira Financeira

Aplicação full stack de carteira financeira: usuários se cadastram, autenticam,
depositam, transferem saldo entre si e revertem operações.

## Estrutura

- `carteira-api/` — API REST em NestJS (autenticação, carteira e transações)
- `carteira-web/` — interface em Next.js (App Router + Server Actions)

## Tecnologias

- **Backend:** NestJS, TypeScript, Prisma, PostgreSQL, JWT (Passport), bcrypt
- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, Server Actions
- **Infra/qualidade:** Docker Compose, Jest (unit + e2e), Swagger

## Decisões de modelagem

- **Valores em centavos.** Os montantes são inteiros em centavos, persistidos
  como `BigInt`, evitando imprecisão de ponto flutuante. A API expõe os valores
  como string (BigInt serializado) e o frontend formata em reais.
- **Reversão.** Cada transação pode ser revertida uma única vez; a reversão usa
  lock pessimista e é idempotente (segunda tentativa retorna 409).

## Como rodar

### 1. Backend

```bash
cd carteira-api
cp .env.example .env
docker compose up -d        # PostgreSQL
npm install
npx prisma migrate deploy
npx prisma generate
npm run start:dev
```

API em `http://localhost:3000` · documentação em `http://localhost:3000/docs`.

### 2. Frontend

```bash
cd carteira-web
cp .env.example .env        # API_URL=http://localhost:3000
npm install
npm run dev
```

A API ocupa a porta 3000, então o Next sobe na próxima livre (ex.:
`http://localhost:3001`) — confira o log do `npm run dev`.

## Testes (backend)

```bash
cd carteira-api
npm run test       # unitários
npm run test:e2e   # integração (exige o PostgreSQL no ar)
```
