# Carteira Financeira

Aplicação de carteira financeira em que os usuários podem se cadastrar, autenticar, depositar, transferir saldo entre si e reverter operações.

## Estrutura

- `carteira-api/` — API REST em NestJS (autenticação, carteira e transações)
- `carteira-web/` — interface em Next.js (em desenvolvimento)

## Backend (carteira-api)

### Requisitos

- Node.js 20+
- Docker e Docker Compose (para o PostgreSQL)

### Como rodar

```bash
cd carteira-api
cp .env.example .env
docker compose up -d
npm install
npx prisma migrate deploy
npx prisma generate
npm run start:dev
```

A API fica disponível em http://localhost:3000.
