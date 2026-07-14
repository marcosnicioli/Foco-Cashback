/**
 * Definições de RBAC (papéis e permissões) do sistema de Cashback.
 *
 * Os papéis (`Role`) espelham o enum `app_role` da migration do banco. Manter
 * os dois em sincronia: ao adicionar um papel, atualize AQUI e na migration.
 *
 * Modelo (fase 1 — equipe interna):
 *   - admin    → pode tudo (consulta, aprova, paga, ajusta, importa, gerencia usuários)
 *   - operator → operação do dia a dia (consulta, solicita, aprova e paga resgates)
 *   - viewer   → somente consulta (deny-by-default para quem ainda não foi promovido)
 */

export const VALID_ROLES = ["admin", "operator", "viewer"] as const;

export type Role = (typeof VALID_ROLES)[number];

/** Rótulos PT-BR de cada papel, para exibir na UI. */
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  operator: "Operador",
  viewer: "Consulta",
};

/**
 * Permissões granulares. Convenção: `<dominio>.<verbo>`.
 * A matriz que liga papel → permissão está em `rbac.config.ts` e DEVE contar a
 * mesma história das policies RLS no banco.
 */
export type Permission =
  | "cashback.read" // ver autores, lançamentos e dashboard
  | "authors.write" // criar/editar autores
  | "withdraw.request" // solicitar resgate (lançamento negativo)
  | "withdraw.approve" // aprovar resgate (requested → approved)
  | "withdraw.pay" // marcar como pago (approved → paid)
  | "withdraw.cancel" // cancelar resgate (requested/approved → cancelled)
  | "ledger.adjust" // lançar ajuste manual (crédito/débito)
  | "import.run" // rodar importação do Excel
  | "users.manage"; // gerir papéis dos usuários

export function isRole(value: string): value is Role {
  return (VALID_ROLES as readonly string[]).includes(value);
}
