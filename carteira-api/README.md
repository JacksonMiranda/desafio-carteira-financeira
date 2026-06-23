# Carteira API

API REST da carteira financeira: cadastro e autenticação de usuários e (em construção) as operações de saldo — depósito, transferência e reversão.

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

## Estrutura

```
src/
├── auth/      # autenticação (JWT, guard, strategy e DTOs)
├── users/     # cadastro de usuários
├── prisma/    # acesso ao banco
└── common/    # utilidades compartilhadas (ex.: pipe de validação)
```

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | conexão com o PostgreSQL |
| `JWT_SECRET` | segredo usado para assinar os tokens |
| `JWT_EXPIRES_IN` | tempo de expiração do token (ex.: `1d`) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | credenciais do banco usadas pelo Docker |
