# Importação do histórico de cashback

Como carregar o CSV exportado do sistema anterior para o banco, com o script
[`scripts/import-cashback.ts`](../scripts/import-cashback.ts).

## Formato do CSV esperado

Cabeçalho (a ordem das colunas não importa; os nomes sim):

```
identificador,numeropedido,datacriacao,saldoanterior,saldo,valorresgatependente,situacao,id_usuario,nome
```

| Coluna                  | Significado                                                                    |
| ----------------------- | ------------------------------------------------------------------------------ |
| `identificador`         | Cupom usado no pedido (varia por pedido).                                      |
| `numeropedido`          | Nº do pedido. Vazio nas linhas que são eventos de resgate.                     |
| `datacriacao`           | Data/hora do evento (`YYYY-MM-DD HH:MM:SS.mmm`).                               |
| `saldoanterior`/`saldo` | Saldo antes/depois; o crédito do pedido = `saldo − saldoanterior`.             |
| `valorresgatependente`  | Resgate pendente naquele momento.                                              |
| `situacao`              | `Cashback Recebido`, `Resgate Solicitado`, `Resgate Liberado`, `Resgate Pago`. |
| `id_usuario`            | **Chave do autor** (external_id). Um autor tem vários cupons.                  |
| `nome`                  | Nome do autor (acentuação quebrada é corrigida).                               |

## Estratégia: "cashback completo + saques resumidos"

Decidida com o cliente para preservar o histórico de ganhos sem reproduzir todo
o vaivém de status das linhas antigas:

1. **Autor** = `id_usuario` (external_id). Cupom principal = o mais recente.
2. **Cashback** — cada linha com `numeropedido` vira crédito de valor
   `saldo − saldoanterior` (positivo). Linhas **idênticas**
   (pedido+saldoanterior+saldo) são duplicatas de export e ignoradas; mas o
   **mesmo pedido em pontos de saldo diferentes** são créditos que o sistema
   anterior contou separadamente, então são **somados** no mesmo pedido (um
   lançamento por pedido no ledger).
3. **Resgates já pagos** — somados em **1 lançamento `withdrawal` pago por
   autor** (não reproduz cada saque antigo, mas mantém o total correto).
4. **Resgate pendente atual** — vem de `valorresgatependente` da linha mais
   recente do autor, importado como 1 `withdrawal` (`requested` ou `approved`).

Resultado: `Saldo = Σ(cashback) − pagos − pendentes`, idêntico ao sistema atual.

## Como rodar

Requer `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `.env.local`
(a `service_role` ignora a RLS — por isso o script roda **só no servidor**).

```bash
# 1) salve o arquivo em data/cashback.csv  (data/ é ignorada pelo Git)

# 2) SIMULAÇÃO — valida e mostra o resumo, sem gravar nada:
corepack pnpm import:cashback -- --dry-run --file data/cashback.csv

# 3) confira o resumo (autores, total gerado, pago, saldo, avisos) e então:
corepack pnpm import:cashback -- --file data/cashback.csv

# opcional: recomeçar do zero (apaga authors + ledger antes de importar)
corepack pnpm import:cashback -- --truncate --file data/cashback.csv
```

Um log com avisos/anomalias é gravado em `data/import-log.txt`.

## Depois de importar

1. **Rotacione a `service_role` key** no Supabase se ela já tiver sido exposta.
2. Confira o Dashboard e a Consulta: os saldos devem bater com o sistema antigo.
3. `data/` fica fora do Git (dados pessoais dos autores) — não commite o CSV.
