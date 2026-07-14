/**
 * Tipos do banco — REFERÊNCIA / PLACEHOLDER.
 *
 * Este arquivo é GERADO automaticamente a partir do schema do Supabase.
 * Sempre que você alterar o schema (criar/alterar tabela numa migration),
 * regenere com:
 *
 *   pnpm db:types
 *
 * NÃO edite este arquivo à mão — suas mudanças serão sobrescritas. Esta
 * versão foi escrita à mão para o projeto compilar antes do primeiro
 * `pnpm db:types`; ela reflete as migrations em supabase/migrations/.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: Database["public"]["Enums"]["app_role"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      authors: {
        Row: {
          id: string;
          external_id: string | null;
          name: string;
          coupon: string | null;
          cpf_cnpj: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          external_id?: string | null;
          name: string;
          coupon?: string | null;
          cpf_cnpj?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          external_id?: string | null;
          name?: string;
          coupon?: string | null;
          cpf_cnpj?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      cashback_ledger: {
        Row: {
          id: string;
          author_id: string;
          entry_type: Database["public"]["Enums"]["ledger_entry_type"];
          order_number: string | null;
          coupon: string | null;
          amount: number;
          occurred_at: string;
          notes: string | null;
          withdrawal_status: Database["public"]["Enums"]["withdrawal_status"] | null;
          approved_at: string | null;
          approved_by: string | null;
          paid_at: string | null;
          paid_by: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          author_id: string;
          entry_type: Database["public"]["Enums"]["ledger_entry_type"];
          order_number?: string | null;
          coupon?: string | null;
          amount: number;
          occurred_at?: string;
          notes?: string | null;
          withdrawal_status?: Database["public"]["Enums"]["withdrawal_status"] | null;
          approved_at?: string | null;
          approved_by?: string | null;
          paid_at?: string | null;
          paid_by?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          author_id?: string;
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"];
          order_number?: string | null;
          coupon?: string | null;
          amount?: number;
          occurred_at?: string;
          notes?: string | null;
          withdrawal_status?: Database["public"]["Enums"]["withdrawal_status"] | null;
          approved_at?: string | null;
          approved_by?: string | null;
          paid_at?: string | null;
          paid_by?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cashback_ledger_author_id_fkey";
            columns: ["author_id"];
            referencedRelation: "authors";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          id: number;
          table_name: string;
          record_id: string | null;
          action: string;
          actor_id: string | null;
          actor_role: Database["public"]["Enums"]["app_role"] | null;
          ip: string | null;
          old_data: Json | null;
          new_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          table_name: string;
          record_id?: string | null;
          action: string;
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["app_role"] | null;
          ip?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          table_name?: string;
          record_id?: string | null;
          action?: string;
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["app_role"] | null;
          ip?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      author_balances: {
        Row: {
          author_id: string | null;
          name: string | null;
          coupon: string | null;
          cpf_cnpj: string | null;
          total_credited: number | null;
          total_paid: number | null;
          blocked_amount: number | null;
          total_debited: number | null;
          current_balance: number | null;
        };
        Relationships: [];
      };
      cashback_ledger_view: {
        Row: {
          id: string | null;
          author_id: string | null;
          author_name: string | null;
          coupon: string | null;
          cpf_cnpj: string | null;
          entry_type: Database["public"]["Enums"]["ledger_entry_type"] | null;
          order_number: string | null;
          amount: number | null;
          occurred_at: string | null;
          notes: string | null;
          withdrawal_status: Database["public"]["Enums"]["withdrawal_status"] | null;
          approved_at: string | null;
          approved_by: string | null;
          paid_at: string | null;
          paid_by: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string | null;
          created_by: string | null;
          effective_amount: number | null;
          balance_after: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_app_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["app_role"];
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      author_available_balance: {
        Args: { p_author_id: string };
        Returns: number;
      };
    };
    Enums: {
      app_role: "admin" | "operator" | "viewer";
      ledger_entry_type:
        | "cashback_received"
        | "withdrawal"
        | "adjustment_credit"
        | "adjustment_debit";
      withdrawal_status: "requested" | "approved" | "paid" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Atalhos convenientes.
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
