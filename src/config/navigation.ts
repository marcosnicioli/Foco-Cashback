import {
  BadgeCheck,
  Banknote,
  LayoutDashboard,
  Upload,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/rbac/rbac.types";

export interface NavItem {
  /** Rótulo exibido na UI (PT-BR). */
  title: string;
  /** Rota (em inglês, kebab-case). */
  href: string;
  icon: LucideIcon;
  /** Permissão necessária para ver o item. Ausente = visível para todos os logados. */
  permission?: Permission;
  /**
   * `false` = item de roadmap, ainda não implementado. Aparece com selo
   * "Em breve" e leva a um placeholder. Ao implementar, vire `true`.
   */
  available: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Navegação principal do sistema de Cashback. A navegação é a fonte da verdade
 * da estrutura do produto — ao construir uma tela nova, marque `available: true`.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Geral",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, available: true }],
  },
  {
    title: "Cashback",
    items: [
      {
        title: "Consulta",
        href: "/cashback",
        icon: Wallet,
        permission: "cashback.read",
        available: true,
      },
      {
        title: "Autores",
        href: "/authors",
        icon: UsersRound,
        permission: "cashback.read",
        available: true,
      },
    ],
  },
  {
    title: "Resgates",
    items: [
      {
        title: "Administração",
        href: "/withdrawals",
        icon: BadgeCheck,
        permission: "withdraw.approve",
        available: true,
      },
      {
        title: "Pagamentos",
        href: "/payments",
        icon: Banknote,
        permission: "withdraw.pay",
        available: true,
      },
    ],
  },
  {
    title: "Administração",
    items: [
      {
        title: "Importação",
        href: "/import",
        icon: Upload,
        permission: "import.run",
        available: false,
      },
      {
        title: "Usuários",
        href: "/users",
        icon: Users,
        permission: "users.manage",
        available: false,
      },
    ],
  },
];
