/** Tipos do domínio de Autores (camelCase; o banco usa snake_case). */

export interface Author {
  id: string;
  name: string;
  coupon: string;
  cpfCnpj: string | null;
  email: string | null;
  createdAt: string;
}

/** Saldos consolidados de um autor (view `author_balances`). */
export interface AuthorBalance {
  authorId: string;
  name: string;
  coupon: string;
  cpfCnpj: string | null;
  /** Total creditado (cashback recebido + ajustes de crédito). */
  totalCredited: number;
  /** Total efetivamente pago em resgates. */
  totalPaid: number;
  /** Valor bloqueado em resgates solicitados/liberados (ainda não pagos). */
  blockedAmount: number;
  /** Saldo disponível (nunca negativo). */
  currentBalance: number;
}
