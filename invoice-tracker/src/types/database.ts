export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          address_line_1: string | null;
          address_line_2: string | null;
          business_name: string;
          city: string | null;
          country: string;
          created_at: string;
          default_currency: string;
          default_tax_name: string | null;
          default_tax_rate: number | null;
          display_name: string;
          email: string;
          id: string;
          invoice_prefix: string;
          next_invoice_number: number;
          payment_instructions: string | null;
          phone: string | null;
          postal_code: string | null;
          province: string | null;
          tax_registration_number: string | null;
          taxes_enabled: boolean;
          is_gst_qst_registered: boolean;
          gst_registration_number: string | null;
          qst_registration_number: string | null;
          updated_at: string;
        };
        Insert: {
          address_line_1?: string | null;
          address_line_2?: string | null;
          business_name?: string;
          city?: string | null;
          country?: string;
          created_at?: string;
          default_currency?: string;
          default_tax_name?: string | null;
          default_tax_rate?: number | null;
          display_name?: string;
          email: string;
          id: string;
          invoice_prefix?: string;
          next_invoice_number?: number;
          payment_instructions?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          province?: string | null;
          tax_registration_number?: string | null;
          taxes_enabled?: boolean;
          is_gst_qst_registered?: boolean;
          gst_registration_number?: string | null;
          qst_registration_number?: string | null;
          updated_at?: string;
        };
        Update: {
          address_line_1?: string | null;
          address_line_2?: string | null;
          business_name?: string;
          city?: string | null;
          country?: string;
          created_at?: string;
          default_currency?: string;
          default_tax_name?: string | null;
          default_tax_rate?: number | null;
          display_name?: string;
          email?: string;
          id?: string;
          invoice_prefix?: string;
          next_invoice_number?: number;
          payment_instructions?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          province?: string | null;
          tax_registration_number?: string | null;
          taxes_enabled?: boolean;
          is_gst_qst_registered?: boolean;
          gst_registration_number?: string | null;
          qst_registration_number?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          address_line_1: string | null;
          address_line_2: string | null;
          city: string | null;
          company_name: string | null;
          country: string | null;
          created_at: string;
          email: string;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          postal_code: string | null;
          province: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          company_name?: string | null;
          country?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          province?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          company_name?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          province?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          client_id: string;
          created_at: string;
          currency: string;
          discount_cents: number;
          due_date: string | null;
          id: string;
          invoice_number: string;
          issue_date: string;
          notes: string | null;
          paid_at: string | null;
          payment_instructions: string | null;
          public_token: string;
          sent_at: string | null;
          status: "draft" | "sent" | "paid" | "void";
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          stripe_payment_url: string | null;
          subtotal_cents: number;
          tax_cents: number;
          tax_name: string | null;
          tax_rate: number | null;
          taxable_subtotal_cents: number;
          gst_rate: number | null;
          gst_cents: number;
          qst_rate: number | null;
          qst_cents: number;
          total_cents: number;
          updated_at: string;
          user_id: string;
          viewed_at: string | null;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          currency?: string;
          discount_cents?: number;
          due_date: string | null;
          id?: string;
          invoice_number?: string;
          issue_date: string;
          notes?: string | null;
          paid_at?: string | null;
          payment_instructions?: string | null;
          public_token?: string;
          sent_at?: string | null;
          status?: "draft" | "sent" | "paid" | "void";
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_payment_url?: string | null;
          subtotal_cents?: number;
          tax_cents?: number;
          tax_name?: string | null;
          tax_rate?: number | null;
          taxable_subtotal_cents?: number;
          gst_rate?: number | null;
          gst_cents?: number;
          qst_rate?: number | null;
          qst_cents?: number;
          total_cents?: number;
          updated_at?: string;
          user_id: string;
          viewed_at?: string | null;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          currency?: string;
          discount_cents?: number;
          due_date?: string | null;
          id?: string;
          invoice_number?: string;
          issue_date?: string;
          notes?: string | null;
          paid_at?: string | null;
          payment_instructions?: string | null;
          public_token?: string;
          sent_at?: string | null;
          status?: "draft" | "sent" | "paid" | "void";
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_payment_url?: string | null;
          subtotal_cents?: number;
          tax_cents?: number;
          tax_name?: string | null;
          tax_rate?: number | null;
          taxable_subtotal_cents?: number;
          gst_rate?: number | null;
          gst_cents?: number;
          qst_rate?: number | null;
          qst_cents?: number;
          total_cents?: number;
          updated_at?: string;
          user_id?: string;
          viewed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_items: {
        Row: {
          amount_cents: number;
          created_at: string;
          description: string;
          id: string;
          invoice_id: string;
          position: number;
          quantity: number;
          unit_price_cents: number;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          description: string;
          id?: string;
          invoice_id: string;
          position?: number;
          quantity?: number;
          unit_price_cents: number;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          description?: string;
          id?: string;
          invoice_id?: string;
          position?: number;
          quantity?: number;
          unit_price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_cents: number;
          created_at: string;
          currency: string;
          id: string;
          invoice_id: string;
          method: "e-transfer" | "cash" | "cheque" | "bank_transfer" | "other" | "stripe";
          paid_on: string;
          reference: string | null;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          currency?: string;
          id?: string;
          invoice_id: string;
          method: "e-transfer" | "cash" | "cheque" | "bank_transfer" | "other" | "stripe";
          paid_on: string;
          reference?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          invoice_id?: string;
          method?: "e-transfer" | "cash" | "cheque" | "bank_transfer" | "other" | "stripe";
          paid_on?: string;
          reference?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          updated_at: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_public_invoice: {
        Args: { p_token: string };
        Returns: Json;
      };
      mark_public_invoice_viewed: {
        Args: { p_token: string };
        Returns: undefined;
      };
      get_invoice_checkout_state: {
        Args: { p_token: string };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type ClientListItem = Pick<
  Client,
  "id" | "name" | "company_name" | "email" | "phone"
>;
export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
export type InvoiceItem = Database["public"]["Tables"]["invoice_items"]["Row"];
export type InvoiceListRow = Invoice & {
  clients: Pick<Client, "id" | "name" | "company_name">;
  payments: Payment[];
};
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type PaymentMethod = Payment["method"];
export type PushSubscriptionRow =
  Database["public"]["Tables"]["push_subscriptions"]["Row"];
