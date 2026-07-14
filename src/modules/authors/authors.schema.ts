import { z } from "zod";

/**
 * Schema do formulário de Autor. Usado no client (React Hook Form) e revalidado
 * na action (defesa em profundidade).
 */
export const authorFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do autor."),
  coupon: z
    .string()
    .trim()
    .min(2, "Informe o cupom.")
    .max(40, "Cupom muito longo.")
    .transform((v) => v.toUpperCase()),
  cpfCnpj: z.string().trim().max(20, "CPF/CNPJ muito longo.").optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido.").optional().or(z.literal("")),
});

export type AuthorFormData = z.infer<typeof authorFormSchema>;
