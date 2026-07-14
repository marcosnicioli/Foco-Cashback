# Gestão de Cashback

Sistema interno para **gerir o cashback dos autores**: consultar saldos e
histórico, solicitar resgates, aprovar, liberar e marcar pagamentos — com
trilha de auditoria e controle de acesso por papéis.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind v4 ·
componentes estilo shadcn/ui · Supabase (Auth + Postgres + RLS) · Zod +
React Hook Form · TanStack Table · Vitest · pnpm.

Idioma: **código em inglês, interface em PT-BR**.

## O que o sistema faz

| Tela              | Rota           | Para quê                                                                |
| ----------------- | -------------- | ----------------------------------------------------------------------- |
| **Dashboard**     | `/dashboard`   | Total gerado, pago, solicitado, saldo, nº de autores, últimos resgates. |
| **Consulta**      | `/cashback`    | Busca/filtra lançamentos; clique numa linha abre o histórico do autor.  |
| **Autores**       | `/authors`     | Cadastro e edição de autores (nome, cupom, CPF/CNPJ, e-mail).           |
| **Administração** | `/withdrawals` | Resgates _solicitados_: aprovar (liberar) ou cancelar.                  |
| **Pagamentos**    | `/payments`    | Resgates _liberados_: marcar como pago.                                 |

### Como o saldo funciona (regra de ouro)

O saldo **nunca é armazenado** — é sempre calculado a partir do histórico. Toda
movimentação é uma linha no **ledger** (livro-razão) `cashback_ledger`:

- **Cashback Recebido** — crédito (+); cada pedido gera um.
- **Resgate** — débito (−); UMA linha cujo status caminha
  `Solicitado → Liberado → Pago` (ou `→ Cancelado`, que devolve o valor).
- **Ajuste de crédito/débito** — correção manual do admin.

```
Saldo disponível = Σ(créditos) − Σ(resgates não cancelados)
```

O banco **garante** que o saldo nunca fica negativo (trigger) e que os
lançamentos são imutáveis — só o status de um resgate pode mudar, e só nas
transições válidas. As mesmas regras estão espelhadas e testadas em TypeScript
em [`src/lib/cashback/ledger-rules.ts`](./src/lib/cashback/ledger-rules.ts).

### Papéis (RBAC)

| Papel      | Pode                                                                              |
| ---------- | --------------------------------------------------------------------------------- |
| `admin`    | Tudo (inclui ajustes manuais, importação, gestão de usuários).                    |
| `operator` | Consultar + todo o fluxo de resgate (solicitar/aprovar/pagar/cancelar) + autores. |
| `viewer`   | Somente consulta.                                                                 |

Duas camadas: a matriz em [`src/lib/rbac/rbac.config.ts`](./src/lib/rbac/rbac.config.ts)
(app) **e** RLS no banco — as duas contam a mesma história.

## Começar

```bash
pnpm install
cp .env.example .env.local   # preencha com seu projeto Supabase
pnpm dev
```

Passo a passo completo (banco, primeiro admin, importação do CSV) em
**[SETUP.md](./SETUP.md)**.

## Importar o histórico do sistema anterior

Há um importador que lê o CSV exportado, corrige acentuação, deduplica pedidos e
carrega tudo respeitando as regras de saldo:

```bash
# 1) salve o CSV em data/cashback.csv (a pasta data/ é ignorada pelo Git)
# 2) simule primeiro (não grava nada) e confira o resumo:
corepack pnpm import:cashback -- --dry-run --file data/cashback.csv
# 3) importe de verdade:
corepack pnpm import:cashback -- --file data/cashback.csv
```

Detalhes da estratégia de importação em [docs/IMPORT.md](./docs/IMPORT.md).

## Testes

```bash
pnpm test            # roda tudo uma vez
pnpm test:watch      # modo interativo
```

Os testes cobrem as regras de negócio: cálculo de saldo, saldo nunca negativo,
transições de status, validações (Zod) e formatadores PT-BR.

## Qualidade

Antes de finalizar qualquer mudança, rode as checagens (lint, type-check,
testes, build). No Claude Code: `/pre-pr`. Manualmente:

```bash
pnpm lint && pnpm type-check && pnpm test && pnpm build
```

## Segurança (leia)

- **Segredos só no `.env.local`** (ignorado pelo Git). A `service_role`/`sb_secret_…`
  **nunca** vai para o frontend, para `NEXT_PUBLIC_*` nem para o repositório.
- A `service_role` é usada **apenas** pelo importador (script de servidor), que
  ignora a RLS de propósito. O app nunca a usa.
- Schema só por migration (nunca pelo Dashboard). Toda tabela tem RLS.

## Documentação

Índice em [docs/README.md](./docs/README.md). Regras do projeto em
[CLAUDE.md](./CLAUDE.md).
