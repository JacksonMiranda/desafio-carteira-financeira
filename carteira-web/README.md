# Carteira Web

Interface em **Next.js (App Router)** para a carteira financeira: cadastro,
login, saldo, extrato e as operações de depósito, transferência e reversão.

Consome a [`carteira-api`](../carteira-api).

## Decisões

- **Server Actions** para todas as operações (login, cadastro, depósito,
  transferência, reversão) — sem rotas de API intermediárias no frontend.
- **JWT em cookie httpOnly**: inacessível ao JS do cliente (mitiga XSS) e
  disponível ao servidor para os Server Actions encaminharem à API. Um
  `middleware` protege as rotas e redireciona conforme a sessão.
- **Valores em centavos**: a API fala centavos; a UI formata em reais (BRL) e
  converte a entrada do usuário antes de enviar (`src/lib/money.ts`).

## Requisitos

- Node.js 20+
- A `carteira-api` em execução (por padrão em `http://localhost:3000`)

## Como rodar

```bash
cp .env.example .env        # API_URL=http://localhost:3000
npm install
npm run dev
```

Como a API costuma ocupar a porta 3000, o Next sobe na próxima livre (ex.:
`http://localhost:3001`) — confira o log do `npm run dev`.

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `API_URL` | URL base da carteira-api (uso server-side, nos Server Actions) |

## Estrutura

```
src/
├── app/
│   ├── login/        # tela e action de login
│   ├── register/     # tela e action de cadastro
│   ├── actions.ts    # Server Actions de depósito, transferência, reversão e logout
│   └── page.tsx      # dashboard (saldo, extrato e operações)
├── components/       # formulários e UI (extrato, botões, campos)
├── lib/              # api (fetch + JWT), session (cookie), money, tipos
└── middleware.ts     # proteção de rotas
```
