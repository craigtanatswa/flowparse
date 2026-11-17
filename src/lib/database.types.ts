export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      billing_subscriptions: {
        Row: {
          cancel_at_next_billing_date: boolean;
          created_at: string;
          current_period_end: string | null;
          dodo_customer_id: string | null;
          dodo_product_id: string | null;
          dodo_subscription_id: string | null;
          last_event_at: string | null;
          plan_id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          cancel_at_next_billing_date?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          dodo_customer_id?: string | null;
          dodo_product_id?: string | null;
          dodo_subscription_id?: string | null;
          last_event_at?: string | null;
          plan_id?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cancel_at_next_billing_date?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          dodo_customer_id?: string | null;
          dodo_product_id?: string | null;
          dodo_subscription_id?: string | null;
          last_event_at?: string | null;
          plan_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_webhook_events: {
        Row: {
          event_type: string;
          id: string;
          received_at: string;
        };
        ComputedFields: never;
        Insert: {
          event_type: string;
          id: string;
          received_at?: string;
        };
        Update: {
          event_type?: string;
          id?: string;
          received_at?: string;
        };
        Relationships: [];
      };
      conversion_jobs: {
        Row: {
          attempt: number;
          created_at: string;
          document_id: string;
          error_message: string | null;
          finished_at: string | null;
          id: string;
          processing_stage: string | null;
          progress_percent: number | null;
          started_at: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempt?: number;
          created_at?: string;
          document_id: string;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          processing_stage?: string | null;
          progress_percent?: number | null;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          attempt?: number;
          created_at?: string;
          document_id?: string;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          processing_stage?: string | null;
          progress_percent?: number | null;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversion_jobs_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "uploaded_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      extracted_transactions: {
        Row: {
          balance: number | null;
          created_at: string;
          credit: number | null;
          currency: string | null;
          debit: number | null;
          description: string;
          document_id: string;
          edited: boolean;
          id: string;
          job_id: string | null;
          needs_review: boolean;
          page_number: number | null;
          raw_text: string | null;
          reference: string | null;
          review_reasons: NonNullable<Json>;
          sort_index: number;
          source: string;
          txn_date: string | null;
          updated_at: string;
          user_id: string;
          value_date: string | null;
        };
        ComputedFields: never;
        Insert: {
          balance?: number | null;
          created_at?: string;
          credit?: number | null;
          currency?: string | null;
          debit?: number | null;
          description?: string;
          document_id: string;
          edited?: boolean;
          id?: string;
          job_id?: string | null;
          needs_review?: boolean;
          page_number?: number | null;
          raw_text?: string | null;
          reference?: string | null;
          review_reasons?: NonNullable<Json>;
          sort_index?: number;
          source?: string;
          txn_date?: string | null;
          updated_at?: string;
          user_id: string;
          value_date?: string | null;
        };
        Update: {
          balance?: number | null;
          created_at?: string;
          credit?: number | null;
          currency?: string | null;
          debit?: number | null;
          description?: string;
          document_id?: string;
          edited?: boolean;
          id?: string;
          job_id?: string | null;
          needs_review?: boolean;
          page_number?: number | null;
          raw_text?: string | null;
          reference?: string | null;
          review_reasons?: NonNullable<Json>;
          sort_index?: number;
          source?: string;
          txn_date?: string | null;
          updated_at?: string;
          user_id?: string;
          value_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "extracted_transactions_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "conversion_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_statement_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "uploaded_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          company: string | null;
          created_at: string;
          display_name: string;
          email: string | null;
          id: string;
          plan_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          company?: string | null;
          created_at?: string;
          display_name?: string;
          email?: string | null;
          id: string;
          plan_id?: string;
          updated_at?: string;
        };
        Update: {
          company?: string | null;
          created_at?: string;
          display_name?: string;
          email?: string | null;
          id?: string;
          plan_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_plans: {
        Row: {
          batch_limit: number;
          cadence: string;
          created_at: string;
          description: string;
          features: NonNullable<Json>;
          file_size_mb: number;
          id: string;
          is_active: boolean;
          name: string;
          page_limit: number | null;
          price_display: string;
          sort_order: number;
          unlimited: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          batch_limit: number;
          cadence?: string;
          created_at?: string;
          description?: string;
          features?: NonNullable<Json>;
          file_size_mb: number;
          id: string;
          is_active?: boolean;
          name: string;
          page_limit?: number | null;
          price_display?: string;
          sort_order?: number;
          unlimited?: boolean;
          updated_at?: string;
        };
        Update: {
          batch_limit?: number;
          cadence?: string;
          created_at?: string;
          description?: string;
          features?: NonNullable<Json>;
          file_size_mb?: number;
          id?: string;
          is_active?: boolean;
          name?: string;
          page_limit?: number | null;
          price_display?: string;
          sort_order?: number;
          unlimited?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      uploaded_documents: {
        Row: {
          account_holder: string | null;
          account_number_last4: string | null;
          bank_name: string | null;
          closing_balance: number | null;
          created_at: string;
          currency: string | null;
          error_message: string | null;
          extraction_method: string | null;
          file_name: string;
          file_size: number;
          id: string;
          mime_type: string;
          opening_balance: number | null;
          page_count: number | null;
          processed_at: string | null;
          processing_stage: string | null;
          progress_percent: number | null;
          report: NonNullable<Json>;
          statement_end: string | null;
          statement_start: string | null;
          status: string;
          storage_path: string;
          updated_at: string;
          user_id: string;
          validation: NonNullable<Json>;
          validation_status: string | null;
        };
        ComputedFields: never;
        Insert: {
          account_holder?: string | null;
          account_number_last4?: string | null;
          bank_name?: string | null;
          closing_balance?: number | null;
          created_at?: string;
          currency?: string | null;
          error_message?: string | null;
          extraction_method?: string | null;
          file_name: string;
          file_size: number;
          id?: string;
          mime_type?: string;
          opening_balance?: number | null;
          page_count?: number | null;
          processed_at?: string | null;
          processing_stage?: string | null;
          progress_percent?: number | null;
          report?: NonNullable<Json>;
          statement_end?: string | null;
          statement_start?: string | null;
          status?: string;
          storage_path: string;
          updated_at?: string;
          user_id: string;
          validation?: NonNullable<Json>;
          validation_status?: string | null;
        };
        Update: {
          account_holder?: string | null;
          account_number_last4?: string | null;
          bank_name?: string | null;
          closing_balance?: number | null;
          created_at?: string;
          currency?: string | null;
          error_message?: string | null;
          extraction_method?: string | null;
          file_name?: string;
          file_size?: number;
          id?: string;
          mime_type?: string;
          opening_balance?: number | null;
          page_count?: number | null;
          processed_at?: string | null;
          processing_stage?: string | null;
          progress_percent?: number | null;
          report?: NonNullable<Json>;
          statement_end?: string | null;
          statement_start?: string | null;
          status?: string;
          storage_path?: string;
          updated_at?: string;
          user_id?: string;
          validation?: NonNullable<Json>;
          validation_status?: string | null;
        };
        Relationships: [];
      };
      usage_records: {
        Row: {
          conversions_completed: number;
          conversions_failed: number;
          created_at: string;
          documents_uploaded: number;
          id: string;
          pages_processed: number;
          period_start: string;
          storage_bytes: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          conversions_completed?: number;
          conversions_failed?: number;
          created_at?: string;
          documents_uploaded?: number;
          id?: string;
          pages_processed?: number;
          period_start: string;
          storage_bytes?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          conversions_completed?: number;
          conversions_failed?: number;
          created_at?: string;
          documents_uploaded?: number;
          id?: string;
          pages_processed?: number;
          period_start?: string;
          storage_bytes?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_billing_event: {
        Args: {
          p_cancel_at_next_billing_date: boolean;
          p_current_period_end: string;
          p_customer_id: string;
          p_event_at: string;
          p_event_type: string;
          p_plan_id: string;
          p_product_id: string;
          p_status: string;
          p_subscription_id: string;
          p_user_id: string;
          p_webhook_id: string;
        };
        Returns: boolean;
      };
      apply_transaction_changes: {
        Args: { p_deletes?: string[]; p_document_id: string; p_upserts: Json };
        Returns: {
          balance: number | null;
          created_at: string;
          credit: number | null;
          currency: string | null;
          debit: number | null;
          description: string;
          document_id: string;
          edited: boolean;
          id: string;
          job_id: string | null;
          needs_review: boolean;
          page_number: number | null;
          raw_text: string | null;
          reference: string | null;
          review_reasons: NonNullable<Json>;
          sort_index: number;
          source: string;
          txn_date: string | null;
          updated_at: string;
          user_id: string;
          value_date: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "extracted_transactions";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      fail_conversion: {
        Args: { p_job_id: string; p_message: string };
        Returns: undefined;
      };
      mark_conversion_failed: {
        Args: { p_job_id: string; p_message: string };
        Returns: undefined;
      };
      queue_conversion: {
        Args: { p_document_id: string };
        Returns: {
          attempt: number;
          created_at: string;
          document_id: string;
          error_message: string | null;
          finished_at: string | null;
          id: string;
          processing_stage: string | null;
          progress_percent: number | null;
          started_at: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "conversion_jobs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_extraction_result: {
        Args: { p_document_id: string; p_job_id: string; p_payload: Json };
        Returns: undefined;
      };
      update_conversion_progress: {
        Args: { p_job_id: string; p_percent: number; p_stage: string };
        Returns: undefined;
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
