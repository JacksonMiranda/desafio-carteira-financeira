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

### Opção A — tudo no Docker (recomendado)

Sobe PostgreSQL, API e frontend com um comando. As migrations são aplicadas
automaticamente quando a API inicia.

```bash
docker compose up --build
```

- Frontend: `http://localhost:3001`
- API: `http://localhost:3000` · documentação: `http://localhost:3000/docs`

Variáveis (`POSTGRES_*`, `JWT_SECRET`, `JWT_EXPIRES_IN`) têm defaults no
`docker-compose.yml` e podem ser sobrescritas por um `.env` na raiz.

### Opção B — desenvolvimento local (app fora do Docker)

Sobe apenas o banco no Docker e roda API e web localmente, com hot reload.

```bash
# banco
docker compose up -d postgres

# API
cd carteira-api
cp .env.example .env
npm install
npx prisma migrate deploy && npx prisma generate
npm run start:dev          # http://localhost:3000

# frontend (em outro terminal)
cd carteira-web
cp .env.example .env        # API_URL=http://localhost:3000
npm install
npm run dev                 # porta livre seguinte, ex.: http://localhost:3001
```

## Testes (backend)

```bash
docker compose up -d postgres   # os testes e2e exigem o banco no ar
cd carteira-api
npm run test       # unitários
npm run test:e2e   # integração contra o PostgreSQL
```
