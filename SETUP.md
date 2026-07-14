# Setup — como rodar o projeto

## Pré-requisitos

- **Node 20+** — verifique com `node --version`.
- **pnpm 9+** — via `corepack` (já vem com o Node) ou `npm install -g pnpm`.
- **Git** e uma conta no **[Supabase](https://supabase.com)**.

> Neste ambiente o pnpm é chamado via `corepack pnpm …` (ex.: `corepack pnpm install`).

## 1. Instalar dependências

```bash
corepack pnpm install
```

(Isso também configura os hooks do Git via Husky automaticamente.)

## 2. Variáveis de ambiente

Copie o exemplo e preencha com os dados do seu projeto Supabase
(Dashboard → Project Settings → API):

```bash
# Mac/Linux
cp .env.example .env.local
# Windows PowerShell
Copy-Item .env.example .env.local
```

Preencha no `.env.local`:

| Variável                        | Onde achar                     | Uso                               |
| ------------------------------- | ------------------------------ | --------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Project URL                    | App (público).                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / `sb_publishable_…`    | App (público).                    |
| `SUPABASE_SERVICE_ROLE_KEY`     | `service_role` / `sb_secret_…` | **Só** o importador. **Segredo.** |

> ⚠️ A `service_role`/`sb_secret_…` ignora a RLS. Ela fica **só** no `.env.local`
> (ignorado pelo Git) e **nunca** em `NEXT_PUBLIC_*` nem no frontend.

## 3. Banco de dados (aplicar o schema)

O schema é criado por migrations, na ordem. A forma mais direta é pelo
**SQL Editor** do Supabase (Dashboard → SQL Editor → New query): cole e rode o
conteúdo de cada arquivo, **em ordem**:

1. `supabase/migrations/20260603000000_init.sql` — perfis, papéis e helpers.
2. `supabase/migrations/20260710000000_cashback_schema.sql` — autores, ledger,
   auditoria, views, funções, triggers e RLS. (É idempotente: pode rodar de novo
   sem erro; ele se autolimpa antes de recriar.)

Depois, se quiser dados de exemplo para ver as telas funcionando, rode também
`supabase/seed.sql`.

> **Alternativa (CLI):** se preferir, `corepack pnpm exec supabase login`,
> `corepack pnpm db:link` (cole o project ref) e `corepack pnpm db:push`. Com o
> projeto linkado, `corepack pnpm db:types` regenera `src/types/database.ts`.

## 4. Rodar

```bash
corepack pnpm dev
```

Abra http://localhost:3000. Você será mandado para `/login`.

## 5. Criar o primeiro usuário (admin)

1. Crie seu usuário (Dashboard → Authentication → Add user, ou pelo signup do app).
2. Promova-o a admin no **SQL Editor**:

```sql
update public.profiles set role = 'admin' where email = 'voce@empresa.com';
```

Papéis disponíveis: `admin`, `operator`, `viewer` (novos usuários entram como
`viewer`).

3. Faça login no app.

## 6. Importar o histórico (opcional)

Com o schema aplicado e a `service_role` no `.env.local`:

```bash
# salve o CSV em data/cashback.csv (data/ é ignorada pelo Git), então:
corepack pnpm import:cashback -- --dry-run --file data/cashback.csv   # simula
corepack pnpm import:cashback -- --file data/cashback.csv             # importa
```

Depois de importar, **rotacione a `service_role` key** se ela já tiver sido
exposta. Detalhes em [docs/IMPORT.md](./docs/IMPORT.md).

## Comandos do dia a dia

| Comando                         | O que faz                      |
| ------------------------------- | ------------------------------ |
| `corepack pnpm dev`             | Sobe o app em desenvolvimento  |
| `corepack pnpm lint`            | Verifica problemas de código   |
| `corepack pnpm type-check`      | Verifica os tipos (TypeScript) |
| `corepack pnpm test`            | Roda os testes                 |
| `corepack pnpm build`           | Build de produção              |
| `corepack pnpm format`          | Formata o código (Prettier)    |
| `corepack pnpm import:cashback` | Importa o CSV de cashback      |

## (Opcional) Permissões do Claude Code

Para o Claude Code pedir menos confirmações em comandos seguros, crie o arquivo
`.claude/settings.json` com o conteúdo abaixo (ou use o comando `/permissions`).
**Revise antes de aplicar** — você está autorizando esses comandos a rodarem sem
perguntar:

```json
{
  "permissions": {
    "allow": [
      "Bash(corepack pnpm install)",
      "Bash(corepack pnpm dev:*)",
      "Bash(corepack pnpm build:*)",
      "Bash(corepack pnpm lint:*)",
      "Bash(corepack pnpm type-check:*)",
      "Bash(corepack pnpm test:*)",
      "Bash(corepack pnpm format:*)",
      "Bash(corepack pnpm db:*)",
      "Bash(git status)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git branch:*)",
      "Bash(git checkout:*)"
    ],
    "ask": ["Bash(git push:*)", "Bash(supabase db push:*)"],
    "deny": ["Read(.env)", "Read(.env.local)"]
  }
}
```
