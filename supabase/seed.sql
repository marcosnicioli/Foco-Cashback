-- ============================================================================
-- Seed — dados fictícios para desenvolvimento/demonstração.
-- ----------------------------------------------------------------------------
-- Rodado automaticamente por `supabase db reset` (local). No Supabase na nuvem,
-- você pode colar este conteúdo no SQL Editor para popular dados de teste.
--
-- Reproduz (de forma limpa) o exemplo da Letícia do sistema atual, além de
-- mais dois autores. Usuários NÃO são criados aqui — vêm do fluxo de signup.
-- Para virar admin:
--   update public.profiles set role = 'admin' where email = 'voce@empresa.com';
--
-- IMPORTANTE: os cashbacks (créditos) são inseridos ANTES dos resgates, em
-- statements separados. A trava de saldo (função STABLE) só enxerga linhas de
-- statements anteriores — por isso resgates ficam em INSERTs próprios.
-- ============================================================================

-- 1. Autores
insert into public.authors (name, coupon, cpf_cnpj) values
  ('Letícia Gouveia', 'LETICIA20', '12345678901'),
  ('João Silva', 'JOAO10', '98765432100'),
  ('Maria Souza', 'MARIA15', '11122233344');

-- 2. Cashback recebido (todos créditos — sem risco de saldo negativo)
insert into public.cashback_ledger (author_id, entry_type, order_number, amount, occurred_at) values
  ((select id from public.authors where coupon = 'LETICIA20'), 'cashback_received', '7440475', 19.92, '2024-07-31 09:36-03'),
  ((select id from public.authors where coupon = 'LETICIA20'), 'cashback_received', '7459613', 19.37, '2025-01-05 22:41-03'),
  ((select id from public.authors where coupon = 'LETICIA20'), 'cashback_received', '7461237', 17.43, '2025-01-21 15:03-03'),
  ((select id from public.authors where coupon = 'JOAO10'), 'cashback_received', '8001001', 50.00, '2025-02-10 10:00-03'),
  ((select id from public.authors where coupon = 'JOAO10'), 'cashback_received', '8002002', 30.00, '2025-03-01 08:00-03'),
  ((select id from public.authors where coupon = 'MARIA15'), 'cashback_received', '9003003', 100.00, '2025-03-10 16:20-03');

-- 3. Resgate SOLICITADO (Letícia) — statement próprio
insert into public.cashback_ledger (author_id, entry_type, amount, occurred_at, withdrawal_status, notes)
values (
  (select id from public.authors where coupon = 'LETICIA20'),
  'withdrawal', -39.29, '2025-01-17 19:33-03', 'requested', 'Resgate via PIX'
);

-- 4. Resgate PAGO (João) — exercita o fluxo completo até o pagamento
insert into public.cashback_ledger (
  author_id, entry_type, amount, occurred_at, withdrawal_status, approved_at, paid_at
)
values (
  (select id from public.authors where coupon = 'JOAO10'),
  'withdrawal', -20.00, '2025-02-15 14:00-03', 'paid', '2025-02-16 09:00-03', '2025-02-18 11:00-03'
);
