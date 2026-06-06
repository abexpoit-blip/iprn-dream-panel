export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      active_rates: {
        Row: {
          country: string
          created_at: string | null
          id: string
          provider: string
          rate: number
          type: string
        }
        Insert: {
          country: string
          created_at?: string | null
          id?: string
          provider: string
          rate: number
          type: string
        }
        Update: {
          country?: string
          created_at?: string | null
          id?: string
          provider?: string
          rate?: number
          type?: string
        }
        Relationships: []
      }
      banned_keywords: {
        Row: {
          created_at: string | null
          id: string
          keyword: string
          reason: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          keyword: string
          reason?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          keyword?: string
          reason?: string | null
        }
        Relationships: []
      }
      bot_settings: {
        Row: {
          bot_id: string | null
          id: string
          is_secret: boolean | null
          setting_key: string
          setting_value: string
          updated_at: string | null
        }
        Insert: {
          bot_id?: string | null
          id?: string
          is_secret?: boolean | null
          setting_key: string
          setting_value: string
          updated_at?: string | null
        }
        Update: {
          bot_id?: string | null
          id?: string
          is_secret?: boolean | null
          setting_key?: string
          setting_value?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_settings_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          auto_relogin: boolean | null
          bot_type: string | null
          config: Json | null
          created_at: string | null
          id: string
          last_error: string | null
          last_seen: string | null
          name: string
          number_panel_type: string | null
          session_keep_alive: boolean | null
          status: string
        }
        Insert: {
          auto_relogin?: boolean | null
          bot_type?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          last_error?: string | null
          last_seen?: string | null
          name: string
          number_panel_type?: string | null
          session_keep_alive?: boolean | null
          status?: string
        }
        Update: {
          auto_relogin?: boolean | null
          bot_type?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          last_error?: string | null
          last_seen?: string | null
          name?: string
          number_panel_type?: string | null
          session_keep_alive?: boolean | null
          status?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          agent_id: string | null
          created_at: string | null
          email: string | null
          id: string
          skype_id: string | null
          status: string | null
          user_id: string | null
          username: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          skype_id?: string | null
          status?: string | null
          user_id?: string | null
          username: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          skype_id?: string | null
          status?: string | null
          user_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      number_panels: {
        Row: {
          auto_relogin: boolean | null
          created_at: string | null
          id: string
          last_error: string | null
          last_login: string | null
          name: string
          panel_url: string
          password: string | null
          session_keep_alive: boolean | null
          status: string | null
          username: string | null
        }
        Insert: {
          auto_relogin?: boolean | null
          created_at?: string | null
          id?: string
          last_error?: string | null
          last_login?: string | null
          name: string
          panel_url: string
          password?: string | null
          session_keep_alive?: boolean | null
          status?: string | null
          username?: string | null
        }
        Update: {
          auto_relogin?: boolean | null
          created_at?: string | null
          id?: string
          last_error?: string | null
          last_login?: string | null
          name?: string
          panel_url?: string
          password?: string | null
          session_keep_alive?: boolean | null
          status?: string | null
          username?: string | null
        }
        Relationships: []
      }
      number_pool: {
        Row: {
          allocation_id: string | null
          bot_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          number: string
          number_panel_id: string | null
          payout_rate: number | null
          reserved_at: string | null
          reserved_for: string | null
          service_tag: string | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          allocation_id?: string | null
          bot_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          number: string
          number_panel_id?: string | null
          payout_rate?: number | null
          reserved_at?: string | null
          reserved_for?: string | null
          service_tag?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          allocation_id?: string | null
          bot_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          number?: string
          number_panel_id?: string | null
          payout_rate?: number | null
          reserved_at?: string | null
          reserved_for?: string | null
          service_tag?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "number_pool_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "number_pool_number_panel_id_fkey"
            columns: ["number_panel_id"]
            isOneToOne: false
            referencedRelation: "number_panels"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_audit_log: {
        Row: {
          amount_earned: number | null
          bot_id: string | null
          cli: string | null
          created_at: string | null
          id: string
          otp_code: string | null
          outcome: string
          phone_number: string | null
          sms_text: string | null
          source: string
          source_msg_id: string | null
        }
        Insert: {
          amount_earned?: number | null
          bot_id?: string | null
          cli?: string | null
          created_at?: string | null
          id?: string
          otp_code?: string | null
          outcome: string
          phone_number?: string | null
          sms_text?: string | null
          source: string
          source_msg_id?: string | null
        }
        Update: {
          amount_earned?: number | null
          bot_id?: string | null
          cli?: string | null
          created_at?: string | null
          id?: string
          otp_code?: string | null
          outcome?: string
          phone_number?: string | null
          sms_text?: string | null
          source?: string
          source_msg_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "otp_audit_log_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          account_details: string | null
          agent_id: string
          amount: number
          created_at: string | null
          id: string
          method: string | null
          payment_method: string | null
          status: string
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_details?: string | null
          agent_id: string
          amount: number
          created_at?: string | null
          id?: string
          method?: string | null
          payment_method?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_details?: string | null
          agent_id?: string
          amount?: number
          created_at?: string | null
          id?: string
          method?: string | null
          payment_method?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          balance: number | null
          created_at: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          last_payout_at: string | null
          role: string | null
          skype_id: string | null
          status: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          last_payout_at?: string | null
          role?: string | null
          skype_id?: string | null
          status?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          last_payout_at?: string | null
          role?: string | null
          skype_id?: string | null
          status?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      sms_cdr: {
        Row: {
          agent_id: string | null
          client_id: string | null
          id: string
          message: string | null
          number: string
          payout: number | null
          prefix: string | null
          received_at: string | null
          status: string | null
        }
        Insert: {
          agent_id?: string | null
          client_id?: string | null
          id?: string
          message?: string | null
          number: string
          payout?: number | null
          prefix?: string | null
          received_at?: string | null
          status?: string | null
        }
        Update: {
          agent_id?: string | null
          client_id?: string | null
          id?: string
          message?: string | null
          number?: string
          payout?: number | null
          prefix?: string | null
          received_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_cdr_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_cdr_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          agent_id: string | null
          client_id: string | null
          created_at: string | null
          id: string
          number: string
          otp_code: string | null
          payout: number | null
          status: string | null
        }
        Insert: {
          agent_id?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          number: string
          otp_code?: string | null
          payout?: number | null
          status?: string | null
        }
        Update: {
          agent_id?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          number?: string
          otp_code?: string | null
          payout?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_ranges: {
        Row: {
          created_at: string | null
          currency: string | null
          id: string
          memo: string | null
          name: string | null
          payout_1_1: number | null
          payout_30_45: number | null
          payout_7_1: number | null
          payout_7_7: number | null
          prefix: string
          test_number: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          id?: string
          memo?: string | null
          name?: string | null
          payout_1_1?: number | null
          payout_30_45?: number | null
          payout_7_1?: number | null
          payout_7_7?: number | null
          prefix: string
          test_number?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          id?: string
          memo?: string | null
          name?: string | null
          payout_1_1?: number | null
          payout_30_45?: number | null
          payout_7_1?: number | null
          payout_7_7?: number | null
          prefix?: string
          test_number?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_client_id: { Args: never; Returns: string }
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
  public: {
    Enums: {},
  },
} as const
