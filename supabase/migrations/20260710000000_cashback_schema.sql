-- ============================================================================
-- Migration — Schema do Cashback (ledger único)
-- ----------------------------------------------------------------------------
-- Modelo de "livro-razão" (ledger): cada linha de `cashback_ledger` é UM evento
-- financeiro. O saldo NUNCA é armazenado — é sempre calculado a partir do
-- histórico (view + function). Isso garante rastreabilidade total e evita saldo
-- inconsistente.
--
--   cashback_received  → crédito (+): um pedido gerou cashback
--   withdrawal         → débito (−): resgate; UMA linha cujo status caminha
--                        requested → approved → paid  (ou → cancelled)
--   adjustment_credit  → crédito manual (+) feito pelo admin
--   adjustment_debit   → débito manual (−) feito pelo admin
--
-- Saldo disponível = SOMA(amount) ignorando resgates cancelados.
-- Resgate cancelado devolve o valor (não conta no saldo).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Reset idempotente (fase de setup)
-- ----------------------------------------------------------------------------
-- Torna esta migration SEGURA para re-executar durante a montagem inicial do
-- schema: remove os objetos do cashback caso já existam, para recriar do zero
-- sem o erro "type ... already exists". Só afeta o cashback — NÃO toca em
-- profiles, usuários ou auth. Enquanto não há dados importados, é inofensivo.
drop table if exists public.cashback_ledger cascade;
drop table if exists public.authors cascade;
drop table if exists public.audit_log cascade;
drop function if exists public.author_available_balance(uuid) cascade;
drop function if exists public.enforce_non_negative_balance() cascade;
drop function if exists public.guard_ledger_update() cascade;
drop function if exists public.log_audit() cascade;
drop type if exists public.withdrawal_status cascade;
drop type if exists public.ledger_entry_type cascade;

-- ----------------------------------------------------------------------------
-- 1. Enums de domínio
-- ----------------------------------------------------------------------------
create type public.ledger_entry_type as enum (
  'cashback_received',
  'withdrawal',
  'adjustment_credit',
  'adjustment_debit'
);

-- Status só faz sentido para lançamentos do tipo 'withdrawal'.
create type public.withdrawal_status as enum (
  'requested', -- solicitado: valor bloqueado, ainda não pago
  'approved', -- liberado: aprovado pelo admin/operador (histórico)
  'paid', -- pago: pagamento efetivado
  'cancelled' -- cancelado: valor devolvido ao saldo
);

-- ----------------------------------------------------------------------------
-- 2. Autores (cada autor tem um cupom)
-- ----------------------------------------------------------------------------
create table public.authors (
  id uuid primary key default gen_random_uuid(),
  -- Chave estável do autor vinda do sistema anterior (id_usuario). Um autor
  -- pode usar VÁRIOS cupons ao longo do tempo — por isso o cupom não é a chave.
  external_id text,
  name text not null,
  -- Cupom principal/mais recente do autor (apenas para exibição e busca).
  coupon text,
  cpf_cnpj text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

comment on table public.authors is
  'Autores do programa de cashback. Identificados por external_id (id do sistema anterior). O cupom fica na linha do ledger, pois um autor usa vários cupons.';

-- external_id único quando informado (autores importados). Autores criados à mão têm external_id nulo.
create unique index authors_external_id_key on public.authors (external_id) where external_id is not null;
-- Busca por cupom (NÃO é único: um autor tem vários; vários autores podem repetir).
create index authors_coupon_idx on public.authors (lower(coupon));
-- CPF/CNPJ único quando informado.
create unique index authors_cpf_cnpj_key on public.authors (cpf_cnpj) where cpf_cnpj is not null;

-- ----------------------------------------------------------------------------
-- 3. Ledger — fonte única da verdade das movimentações
-- ----------------------------------------------------------------------------
create table public.cashback_ledger (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.authors (id) on delete restrict,
  entry_type public.ledger_entry_type not null,
  order_number text, -- nº do pedido (obrigatório em cashback_received)
  coupon text, -- cupom usado no pedido (preenchido em cashback_received)
  amount numeric(14, 2) not null, -- SEMPRE com sinal: crédito (+), débito (−)
  occurred_at timestamptz not null default now(), -- data do evento (emissão / solicitação)
  notes text,

  -- Fluxo de resgate (preenchido só quando entry_type = 'withdrawal')
  withdrawal_status public.withdrawal_status,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  paid_at timestamptz,
  paid_by uuid references public.profiles (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,

  -- Auditoria de criação
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,

  -- Integridade por tipo de lançamento -------------------------------------
  constraint amount_not_zero check (amount <> 0),
  constraint cashback_rules check (
    entry_type <> 'cashback_received'
    or (amount > 0 and order_number is not null and withdrawal_status is null)
  ),
  constraint withdrawal_rules check (
    entry_type <> 'withdrawal'
    or (amount < 0 and withdrawal_status is not null)
  ),
  constraint adjustment_credit_rules check (
    entry_type <> 'adjustment_credit'
    or (amount > 0 and withdrawal_status is null)
  ),
  constraint adjustment_debit_rules check (
    entry_type <> 'adjustment_debit'
    or (amount < 0 and withdrawal_status is null)
  )
);

comment on table public.cashback_ledger is
  'Livro-razão do cashback. Append-only: cada linha é um evento financeiro. Só o status de resgates pode mudar; valor/tipo/autor são imutáveis.';

create index cashback_ledger_author_idx on public.cashback_ledger (author_id);
create index cashback_ledger_running_idx on public.cashback_ledger (author_id, occurred_at, created_at);
create index cashback_ledger_withdrawal_status_idx
  on public.cashback_ledger (withdrawal_status)
  where entry_type = 'withdrawal';
-- Dedup da importação: um pedido gera no máximo um cashback por autor.
create unique index cashback_ledger_order_uniq
  on public.cashback_ledger (author_id, order_number)
  where entry_type = 'cashback_received' and order_number is not null;

-- ----------------------------------------------------------------------------
-- 4. Auditoria (quem fez o quê, quando, de qual IP)
-- ----------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  action text not null, -- INSERT | UPDATE | DELETE
  actor_id uuid, -- auth.uid() no momento da ação
  actor_role public.app_role,
  ip inet, -- preenchido se a action setar app.client_ip
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_log is 'Trilha de auditoria imutável de authors e cashback_ledger.';

create index audit_log_record_idx on public.audit_log (table_name, record_id);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- ----------------------------------------------------------------------------
-- 5. Function de saldo — a única fonte de "quanto o autor tem"
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER para poder ser usada dentro de triggers/policies sem esbarrar
-- na RLS. Ignora resgates cancelados (o valor volta pro saldo).
create or replace function public.author_available_balance(p_author_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::numeric(14, 2)
  from public.cashback_ledger
  where author_id = p_author_id
    and not (entry_type = 'withdrawal' and withdrawal_status = 'cancelled');
$$;

comment on function public.author_available_balance(uuid) is
  'Saldo disponível do autor = SOMA(amount) ignorando resgates cancelados. Nunca deve ser negativo.';

-- ----------------------------------------------------------------------------
-- 6. Views (com security_invoker: respeitam a RLS de quem consulta)
-- ----------------------------------------------------------------------------

-- 6.1 Saldos consolidados por autor (usada no dashboard e na busca).
create view public.author_balances
with (security_invoker = on) as
select
  a.id as author_id,
  a.name,
  a.coupon,
  a.cpf_cnpj,
  coalesce(sum(l.amount) filter (
    where l.entry_type in ('cashback_received', 'adjustment_credit')
  ), 0)::numeric(14, 2) as total_credited,
  coalesce(sum(-l.amount) filter (
    where l.entry_type = 'withdrawal' and l.withdrawal_status = 'paid'
  ), 0)::numeric(14, 2) as total_paid,
  coalesce(sum(-l.amount) filter (
    where l.entry_type = 'withdrawal' and l.withdrawal_status in ('requested', 'approved')
  ), 0)::numeric(14, 2) as blocked_amount,
  coalesce(sum(-l.amount) filter (
    where l.entry_type = 'adjustment_debit'
  ), 0)::numeric(14, 2) as total_debited,
  coalesce(sum(l.amount) filter (
    where not (l.entry_type = 'withdrawal' and l.withdrawal_status = 'cancelled')
  ), 0)::numeric(14, 2) as current_balance
from public.authors a
left join public.cashback_ledger l on l.author_id = a.id
group by a.id, a.name, a.coupon, a.cpf_cnpj;

-- 6.2 Ledger enriquecido com dados do autor e SALDO CORRENTE por linha
--     (Saldo Anterior / Saldo Atual da tela de consulta), via window function.
create view public.cashback_ledger_view
with (security_invoker = on) as
select
  l.id,
  l.author_id,
  a.name as author_name,
  -- cupom do pedido quando houver (cashback), senão o cupom principal do autor
  coalesce(l.coupon, a.coupon) as coupon,
  a.cpf_cnpj,
  l.entry_type,
  l.order_number,
  l.amount,
  l.occurred_at,
  l.notes,
  l.withdrawal_status,
  l.approved_at,
  l.approved_by,
  l.paid_at,
  l.paid_by,
  l.cancelled_at,
  l.cancelled_by,
  l.created_at,
  l.created_by,
  -- valor que efetivamente move o saldo (resgate cancelado = 0)
  (case
    when l.entry_type = 'withdrawal' and l.withdrawal_status = 'cancelled' then 0
    else l.amount
  end)::numeric(14, 2) as effective_amount,
  -- saldo depois deste lançamento (running balance por autor)
  (sum(case
    when l.entry_type = 'withdrawal' and l.withdrawal_status = 'cancelled' then 0
    else l.amount
  end) over (
    partition by l.author_id
    order by l.occurred_at, l.created_at, l.id
    rows between unbounded preceding and current row
  ))::numeric(14, 2) as balance_after
from public.cashback_ledger l
join public.authors a on a.id = l.author_id;

-- ----------------------------------------------------------------------------
-- 7. Triggers de integridade
-- ----------------------------------------------------------------------------

-- 7.1 updated_at automático (reusa o helper da migration inicial).
create trigger on_authors_updated
  before update on public.authors
  for each row execute procedure public.handle_updated_at();

create trigger on_cashback_ledger_updated
  before update on public.cashback_ledger
  for each row execute procedure public.handle_updated_at();

-- 7.2 Barreira de saldo negativo — nenhum débito (resgate ou ajuste de débito)
--     pode deixar o saldo do autor abaixo de zero.
create or replace function public.enforce_non_negative_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Só débitos importam (amount < 0). Resgate cancelado não conta.
  if new.amount < 0
     and not (new.entry_type = 'withdrawal' and new.withdrawal_status = 'cancelled') then
    -- Serializa débitos concorrentes DO MESMO AUTOR. Sem isto, sob READ
    -- COMMITTED dois débitos simultâneos leriam o mesmo saldo e ambos passariam
    -- (author_available_balance é STABLE e só enxerga linhas já commitadas),
    -- podendo deixar o saldo negativo. O lock é por autor e liberado no fim da
    -- transação. (Invariante do app: no máximo 1 débito por statement — não
    -- inserimos vários resgates do mesmo autor num único INSERT multi-linha.)
    perform pg_advisory_xact_lock(hashtextextended(new.author_id::text, 0));
    -- new.amount é negativo; saldo atual + novo débito não pode ficar < 0.
    if public.author_available_balance(new.author_id) + new.amount < 0 then
      -- SQLSTATE dedicado (classe 'PT', não usada pelo Postgres) para a app
      -- distinguir "saldo insuficiente" de outras violações de CHECK.
      raise exception 'Saldo insuficiente para esta operação.'
        using errcode = 'PT001';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_non_negative_balance
  before insert on public.cashback_ledger
  for each row execute procedure public.enforce_non_negative_balance();

-- 7.3 Imutabilidade + transição de status válida no UPDATE.
create or replace function public.guard_ledger_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Campos que representam o "dinheiro" são imutáveis após a criação.
  if new.author_id is distinct from old.author_id
     or new.entry_type is distinct from old.entry_type
     or new.amount is distinct from old.amount
     or new.order_number is distinct from old.order_number
     or new.coupon is distinct from old.coupon
     or new.occurred_at is distinct from old.occurred_at
     or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by then
    raise exception 'Lançamentos do ledger são imutáveis; apenas o status de resgate pode mudar.'
      using errcode = 'check_violation';
  end if;

  -- Transições de status permitidas (só para resgates).
  if old.entry_type = 'withdrawal'
     and new.withdrawal_status is distinct from old.withdrawal_status then
    if not (
      (old.withdrawal_status = 'requested' and new.withdrawal_status in ('approved', 'cancelled'))
      or (old.withdrawal_status = 'approved' and new.withdrawal_status in ('paid', 'cancelled'))
    ) then
      raise exception 'Transição de status inválida: % → %.',
        old.withdrawal_status, new.withdrawal_status
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_ledger_update
  before update on public.cashback_ledger
  for each row execute procedure public.guard_ledger_update();

-- ----------------------------------------------------------------------------
-- 8. Trigger de auditoria (authors + cashback_ledger)
-- ----------------------------------------------------------------------------
create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record_id uuid;
  v_ip inet;
begin
  v_record_id := case when tg_op = 'DELETE' then old.id else new.id end;
  -- IP opcional: a action pode setar via `select set_config('app.client_ip', ip, true)`.
  begin
    v_ip := nullif(current_setting('app.client_ip', true), '')::inet;
  exception when others then
    v_ip := null;
  end;

  insert into public.audit_log (
    table_name, record_id, action, actor_id, actor_role, ip, old_data, new_data
  )
  values (
    tg_table_name,
    v_record_id,
    tg_op,
    auth.uid(),
    public.current_app_role(),
    v_ip,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return null; -- AFTER trigger: valor de retorno é ignorado
end;
$$;

create trigger audit_authors
  after insert or update or delete on public.authors
  for each row execute procedure public.log_audit();

create trigger audit_cashback_ledger
  after insert or update or delete on public.cashback_ledger
  for each row execute procedure public.log_audit();

-- ----------------------------------------------------------------------------
-- 9. Row Level Security
-- ----------------------------------------------------------------------------
-- Mapa (deve bater com src/lib/rbac/rbac.config.ts):
--   cashback.read  → admin, operator, viewer
--   authors.write  → admin, operator
--   withdraw.*     → admin, operator
--   cashback/ajuste/import → admin (import roda com service_role, ignora RLS)

alter table public.authors enable row level security;
alter table public.cashback_ledger enable row level security;
alter table public.audit_log enable row level security;

-- 9.1 authors
create policy "authors_select" on public.authors for select
  using (public.current_app_role() in ('admin', 'operator', 'viewer'));

create policy "authors_write" on public.authors for all
  using (public.current_app_role() in ('admin', 'operator'))
  with check (public.current_app_role() in ('admin', 'operator'));

-- 9.2 cashback_ledger
create policy "ledger_select" on public.cashback_ledger for select
  using (public.current_app_role() in ('admin', 'operator', 'viewer'));

-- Inserção depende do tipo de lançamento:
--   withdrawal            → admin/operator
--   cashback_received     → admin (uso manual; import usa service_role)
--   adjustment_credit/debit → admin
create policy "ledger_insert" on public.cashback_ledger for insert
  with check (
    (entry_type = 'withdrawal' and public.current_app_role() in ('admin', 'operator'))
    or (entry_type = 'cashback_received' and public.is_admin())
    or (entry_type in ('adjustment_credit', 'adjustment_debit') and public.is_admin())
  );

-- Update só para resgate (transição de status), por admin/operator.
create policy "ledger_update_withdrawal" on public.cashback_ledger for update
  using (entry_type = 'withdrawal' and public.current_app_role() in ('admin', 'operator'))
  with check (entry_type = 'withdrawal' and public.current_app_role() in ('admin', 'operator'));

-- (Sem policy de DELETE: ledger é append-only para os usuários do app.)

-- 9.3 audit_log — leitura só admin (dados sensíveis); escrita só via trigger (definer).
-- Coerente com a matriz RBAC: auditoria é ação administrativa, como import/users.
create policy "audit_select" on public.audit_log for select
  using (public.is_admin());
