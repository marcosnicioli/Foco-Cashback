import type { Metadata } from "next";
import { getCurrentUserRole } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/rbac/rbac.config";
import { listAuthorBalances, listAuthors } from "@/lib/services/authors";
import { AuthorsClient, type AuthorRow } from "./authors-client";

export const metadata: Metadata = { title: "Autores" };

export default async function AuthorsPage() {
  const [authors, balances, role] = await Promise.all([
    listAuthors(),
    listAuthorBalances(),
    getCurrentUserRole(),
  ]);

  const canWrite = hasPermission(role, "authors.write");
  const balanceByAuthor = new Map(balances.map((b) => [b.authorId, b]));

  const rows: AuthorRow[] = authors.map((a) => {
    const b = balanceByAuthor.get(a.id);
    return {
      id: a.id,
      name: a.name,
      coupon: a.coupon,
      cpfCnpj: a.cpfCnpj,
      // Minimização de dados: e-mail só vai ao browser de quem edita (o form o usa).
      // Quem só consulta não recebe PII que não é exibida em nenhuma coluna.
      email: canWrite ? a.email : null,
      currentBalance: b?.currentBalance ?? 0,
      blockedAmount: b?.blockedAmount ?? 0,
      totalPaid: b?.totalPaid ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Autores</h1>
        <p className="text-muted-foreground mt-1">
          Cadastro de autores e seus cupons. Clique em uma linha para ver o histórico completo.
        </p>
      </div>

      <AuthorsClient authors={rows} canWrite={canWrite} />
    </div>
  );
}
