import type { Permission, Role } from "./rbac.types";

/**
 * Matriz de permissões: quais papéis têm cada permissão.
 *
 * Regra: se o papel está na lista, tem a permissão; senão, NEGADO
 * (deny-by-default). Esta matriz é a 1ª camada (app-side). A 2ª camada é a
 * RLS no banco — as duas devem contar a mesma história.
 *
 * Regra de negócio da fase 1 (ajuste aqui se as regras mudarem — é 1 linha):
 * o operador toca no fluxo inteiro de resgate (solicitar/aprovar/pagar), porque
 * a equipe interna é pequena. Ações administrativas (ajuste manual de saldo,
 * importação, gestão de usuários) ficam só com o admin.
 */
export const PERMISSION_MATRIX: Record<Permission, readonly Role[]> = {
  // Consulta (autores, lançamentos, dashboard)
  "cashback.read": ["admin", "operator", "viewer"],

  // Cadastro de autores
  "authors.write": ["admin", "operator"],

  // Fluxo de resgate
  "withdraw.request": ["admin", "operator"],
  "withdraw.approve": ["admin", "operator"],
  "withdraw.pay": ["admin", "operator"],
  "withdraw.cancel": ["admin", "operator"],

  // Ações administrativas
  "ledger.adjust": ["admin"],
  "import.run": ["admin"],
  "users.manage": ["admin"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSION_MATRIX[permission].includes(role);
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}
