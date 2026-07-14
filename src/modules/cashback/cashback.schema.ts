import { z } from "zod";

/**
 * Solicitação de resgate. As regras de negócio (existe saldo? valor > 0? não
 * ultrapassa o disponível?) são checadas AQUI (valor > 0) e na action + banco
 * (saldo suficiente), nunca só no client.
 */
export const withdrawRequestSchema = z.object({
  authorId: z.string().uuid("Selecione um autor."),
  amount: z.coerce
    .number({ invalid_type_error: "Informe um valor." })
    .positive("O valor deve ser maior que zero.")
    .multipleOf(0.01, "Use no máximo 2 casas decimais."),
  notes: z.string().trim().max(500, "Observação muito longa.").optional().or(z.literal("")),
});

export type WithdrawRequestData = z.infer<typeof withdrawRequestSchema>;

/** Ajuste manual de saldo (somente admin). */
export const adjustmentSchema = z.object({
  authorId: z.string().uuid("Selecione um autor."),
  direction: z.enum(["credit", "debit"], {
    errorMap: () => ({ message: "Escolha crédito ou débito." }),
  }),
  amount: z.coerce
    .number({ invalid_type_error: "Informe um valor." })
    .positive("O valor deve ser maior que zero.")
    .multipleOf(0.01, "Use no máximo 2 casas decimais."),
  notes: z.string().trim().min(3, "Descreva o motivo do ajuste.").max(500),
});

export type AdjustmentData = z.infer<typeof adjustmentSchema>;

/** Filtros da tela de consulta (todos opcionais). */
export const cashbackFilterSchema = z.object({
  coupon: z.string().trim().optional(),
  author: z.string().trim().optional(),
  cpfCnpj: z.string().trim().optional(),
  orderNumber: z.string().trim().optional(),
  status: z.enum(["cashback_received", "requested", "approved", "paid", "cancelled"]).optional(),
  from: z.string().optional(), // ISO date (yyyy-mm-dd)
  to: z.string().optional(),
});

export type CashbackFilter = z.infer<typeof cashbackFilterSchema>;
