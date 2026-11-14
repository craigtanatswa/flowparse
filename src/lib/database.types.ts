export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      statements: {
        Row: {
          account_holder: string | null
          account_number_last4: string | null
          bank_name: string | null
          closing_balance: number | null
          created_at: string
          currency: string | null
          error_message: string | null
          extraction_method: string | null
          file_name: string
          file_size: number
          id: string
          mime_type: string
          opening_balance: number | null
          page_count: number | null
          processed_at: string | null
          processing_stage: string | null
          progress_percent: number | null
          report: Json
          statement_end: string | null
          statement_start: string | null
          status: string
          storage_path: string
          updated_at: string
          user_id: string
          validation: Json
          validation_status: string | null
        }
        Insert: {
          account_holder?: string | null
          account_number_last4?: string | null
          bank_name?: string | null
          closing_balance?: number | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          extraction_method?: string | null
          file_name: string
          file_size: number
          id?: string
          mime_type?: string
          opening_balance?: number | null
          page_count?: number | null
          processed_at?: string | null
          processing_stage?: string | null
          progress_percent?: number | null
          report?: Json
          statement_end?: string | null
          statement_start?: string | null
          status?: string
          storage_path: string
          updated_at?: string
          user_id: string
          validation?: Json
          validation_status?: string | null
        }
        Update: {
          account_holder?: string | null
          account_number_last4?: string | null
          bank_name?: string | null
          closing_balance?: number | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          extraction_method?: string | null
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          opening_balance?: number | null
          page_count?: number | null
          processed_at?: string | null
          processing_stage?: string | null
          progress_percent?: number | null
          report?: Json
          statement_end?: string | null
          statement_start?: string | null
          status?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
          validation?: Json
          validation_status?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          balance: number | null
          created_at: string
          credit: number | null
          currency: string | null
          debit: number | null
          description: string
          edited: boolean
          id: string
          needs_review: boolean
          page_number: number | null
          raw_text: string | null
          reference: string | null
          review_reasons: Json
          sort_index: number
          source: string
          statement_id: string
          txn_date: string | null
          updated_at: string
          user_id: string
          value_date: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string
          credit?: number | null
          currency?: string | null
          debit?: number | null
          description?: string
          edited?: boolean
          id?: string
          needs_review?: boolean
          page_number?: number | null
          raw_text?: string | null
          reference?: string | null
          review_reasons?: Json
          sort_index?: number
          source?: string
          statement_id: string
          txn_date?: string | null
          updated_at?: string
          user_id: string
          value_date?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string
          credit?: number | null
          currency?: string | null
          debit?: number | null
          description?: string
          edited?: boolean
          id?: string
          needs_review?: boolean
          page_number?: number | null
          raw_text?: string | null
          reference?: string | null
          review_reasons?: Json
          sort_index?: number
          source?: string
          statement_id?: string
          txn_date?: string | null
          updated_at?: string
          user_id?: string
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "statements"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_transaction_changes: {
        Args: { p_deletes?: string[]; p_statement_id: string; p_upserts: Json }
        Returns: {
          balance: number | null
          created_at: string
          credit: number | null
          currency: string | null
          debit: number | null
          description: string
          edited: boolean
          id: string
          needs_review: boolean
          page_number: number | null
          raw_text: string | null
          reference: string | null
          review_reasons: Json
          sort_index: number
          source: string
          statement_id: string
          txn_date: string | null
          updated_at: string
          user_id: string
          value_date: string | null
        }[]
      }
      mark_statement_failed: {
        Args: { p_message: string; p_statement_id: string }
        Returns: undefined
      }
      save_extraction_result: {
        Args: { p_payload: Json; p_statement_id: string }
        Returns: undefined
      }
      update_statement_progress: {
        Args: { p_percent: number; p_stage: string; p_statement_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

