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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      approved_call_list: {
        Row: {
          agent_id: string
          call_order: number
          call_status: Database["public"]["Enums"]["call_status"] | null
          called_at: string | null
          contact_id: string
          created_at: string | null
          id: string
          list_date: string
          upload_id: string | null
        }
        Insert: {
          agent_id: string
          call_order: number
          call_status?: Database["public"]["Enums"]["call_status"] | null
          called_at?: string | null
          contact_id: string
          created_at?: string | null
          id?: string
          list_date?: string
          upload_id?: string | null
        }
        Update: {
          agent_id?: string
          call_order?: number
          call_status?: Database["public"]["Enums"]["call_status"] | null
          called_at?: string | null
          contact_id?: string
          created_at?: string | null
          id?: string
          list_date?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approved_call_list_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "master_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approved_call_list_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "call_sheet_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      call_feedback: {
        Row: {
          agent_id: string
          call_list_id: string | null
          call_timestamp: string | null
          contact_id: string
          created_at: string | null
          feedback_status: Database["public"]["Enums"]["feedback_status"]
          id: string
          notes: string | null
          whatsapp_sent: boolean | null
        }
        Insert: {
          agent_id: string
          call_list_id?: string | null
          call_timestamp?: string | null
          contact_id: string
          created_at?: string | null
          feedback_status: Database["public"]["Enums"]["feedback_status"]
          id?: string
          notes?: string | null
          whatsapp_sent?: boolean | null
        }
        Update: {
          agent_id?: string
          call_list_id?: string | null
          call_timestamp?: string | null
          contact_id?: string
          created_at?: string | null
          feedback_status?: Database["public"]["Enums"]["feedback_status"]
          id?: string
          notes?: string | null
          whatsapp_sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "call_feedback_call_list_id_fkey"
            columns: ["call_list_id"]
            isOneToOne: false
            referencedRelation: "approved_call_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_feedback_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "master_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sheet_uploads: {
        Row: {
          agent_id: string
          approval_timestamp: string | null
          approved_count: number | null
          created_at: string | null
          duplicate_entries: number | null
          file_name: string | null
          file_size: number | null
          id: string
          invalid_entries: number | null
          rejected_count: number | null
          status: Database["public"]["Enums"]["upload_status"] | null
          total_entries_submitted: number | null
          upload_date: string
          upload_timestamp: string | null
          valid_entries: number | null
        }
        Insert: {
          agent_id: string
          approval_timestamp?: string | null
          approved_count?: number | null
          created_at?: string | null
          duplicate_entries?: number | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          invalid_entries?: number | null
          rejected_count?: number | null
          status?: Database["public"]["Enums"]["upload_status"] | null
          total_entries_submitted?: number | null
          upload_date?: string
          upload_timestamp?: string | null
          valid_entries?: number | null
        }
        Update: {
          agent_id?: string
          approval_timestamp?: string | null
          approved_count?: number | null
          created_at?: string | null
          duplicate_entries?: number | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          invalid_entries?: number | null
          rejected_count?: number | null
          status?: Database["public"]["Enums"]["upload_status"] | null
          total_entries_submitted?: number | null
          upload_date?: string
          upload_timestamp?: string | null
          valid_entries?: number | null
        }
        Relationships: []
      }
      contact_history: {
        Row: {
          action_date: string | null
          action_type: Database["public"]["Enums"]["action_type"]
          agent_id: string
          contact_id: string
          created_at: string | null
          feedback_status: Database["public"]["Enums"]["feedback_status"] | null
          id: string
          notes: string | null
        }
        Insert: {
          action_date?: string | null
          action_type: Database["public"]["Enums"]["action_type"]
          agent_id: string
          contact_id: string
          created_at?: string | null
          feedback_status?:
            | Database["public"]["Enums"]["feedback_status"]
            | null
          id?: string
          notes?: string | null
        }
        Update: {
          action_date?: string | null
          action_type?: Database["public"]["Enums"]["action_type"]
          agent_id?: string
          contact_id?: string
          created_at?: string | null
          feedback_status?:
            | Database["public"]["Enums"]["feedback_status"]
            | null
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "master_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      do_not_call_list: {
        Row: {
          added_at: string | null
          added_by: string | null
          id: string
          phone_number: string
          reason: string | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          phone_number: string
          reason?: string | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          phone_number?: string
          reason?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          agent_id: string
          contact_id: string
          created_at: string | null
          deal_value: number | null
          expected_close_date: string | null
          id: string
          lead_score: number | null
          lead_status: Database["public"]["Enums"]["lead_status"] | null
          notes: string | null
          qualified_date: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          contact_id: string
          created_at?: string | null
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          lead_score?: number | null
          lead_status?: Database["public"]["Enums"]["lead_status"] | null
          notes?: string | null
          qualified_date?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          contact_id?: string
          created_at?: string | null
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          lead_score?: number | null
          lead_status?: Database["public"]["Enums"]["lead_status"] | null
          notes?: string | null
          qualified_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "master_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      master_contacts: {
        Row: {
          city: string | null
          company_name: string
          contact_person_name: string
          created_at: string | null
          current_owner_agent_id: string | null
          first_upload_date: string | null
          first_uploaded_by: string | null
          id: string
          industry: string | null
          ownership_lock_until: string | null
          phone_number: string
          status: Database["public"]["Enums"]["contact_status"] | null
          trade_license_number: string
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          company_name: string
          contact_person_name: string
          created_at?: string | null
          current_owner_agent_id?: string | null
          first_upload_date?: string | null
          first_uploaded_by?: string | null
          id?: string
          industry?: string | null
          ownership_lock_until?: string | null
          phone_number: string
          status?: Database["public"]["Enums"]["contact_status"] | null
          trade_license_number: string
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          company_name?: string
          contact_person_name?: string
          created_at?: string | null
          current_owner_agent_id?: string | null
          first_upload_date?: string | null
          first_uploaded_by?: string | null
          id?: string
          industry?: string | null
          ownership_lock_until?: string | null
          phone_number?: string
          status?: Database["public"]["Enums"]["contact_status"] | null
          trade_license_number?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      performance_cache: {
        Row: {
          agent_id: string
          cache_date: string
          id: string
          interested_count: number | null
          leads_generated: number | null
          not_answered_count: number | null
          not_interested_count: number | null
          total_calls: number | null
          updated_at: string | null
          whatsapp_sent: number | null
        }
        Insert: {
          agent_id: string
          cache_date?: string
          id?: string
          interested_count?: number | null
          leads_generated?: number | null
          not_answered_count?: number | null
          not_interested_count?: number | null
          total_calls?: number | null
          updated_at?: string | null
          whatsapp_sent?: number | null
        }
        Update: {
          agent_id?: string
          cache_date?: string
          id?: string
          interested_count?: number | null
          leads_generated?: number | null
          not_answered_count?: number | null
          not_interested_count?: number | null
          total_calls?: number | null
          updated_at?: string | null
          whatsapp_sent?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          last_login: string | null
          phone_number: string | null
          supervisor_id: string | null
          updated_at: string | null
          username: string
          whatsapp_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean | null
          last_login?: string | null
          phone_number?: string | null
          supervisor_id?: string | null
          updated_at?: string | null
          username: string
          whatsapp_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          phone_number?: string | null
          supervisor_id?: string | null
          updated_at?: string | null
          username?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_rejections: {
        Row: {
          company_name: string | null
          created_at: string | null
          id: string
          phone_number: string | null
          rejection_reason: string | null
          row_number: number | null
          upload_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          id?: string
          phone_number?: string | null
          rejection_reason?: string | null
          row_number?: number | null
          upload_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          id?: string
          phone_number?: string | null
          rejection_reason?: string | null
          row_number?: number | null
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_rejections_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "call_sheet_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          agent_id: string
          contact_id: string
          created_at: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status"] | null
          direction: Database["public"]["Enums"]["message_direction"] | null
          id: string
          message_content: string
          phone_number: string
          sent_timestamp: string | null
          template_name: string | null
        }
        Insert: {
          agent_id: string
          contact_id: string
          created_at?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          direction?: Database["public"]["Enums"]["message_direction"] | null
          id?: string
          message_content: string
          phone_number: string
          sent_timestamp?: string | null
          template_name?: string | null
        }
        Update: {
          agent_id?: string
          contact_id?: string
          created_at?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          direction?: Database["public"]["Enums"]["message_direction"] | null
          id?: string
          message_content?: string
          phone_number?: string
          sent_timestamp?: string | null
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "master_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      action_type: "upload" | "call" | "feedback" | "reassign" | "status_change"
      app_role:
        | "agent"
        | "supervisor"
        | "operations_head"
        | "admin"
        | "super_admin"
        | "sales_controller"
      call_status: "pending" | "called" | "skipped"
      contact_status:
        | "new"
        | "contacted"
        | "interested"
        | "not_interested"
        | "converted"
      delivery_status: "pending" | "sent" | "delivered" | "read" | "failed"
      feedback_status:
        | "not_answered"
        | "interested"
        | "not_interested"
        | "callback"
        | "wrong_number"
      lead_status: "new" | "contacted" | "qualified" | "converted" | "lost"
      message_direction: "inbound" | "outbound"
      upload_status: "pending" | "approved" | "rejected" | "supplemented"
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
    Enums: {
      action_type: ["upload", "call", "feedback", "reassign", "status_change"],
      app_role: [
        "agent",
        "supervisor",
        "operations_head",
        "admin",
        "super_admin",
        "sales_controller",
      ],
      call_status: ["pending", "called", "skipped"],
      contact_status: [
        "new",
        "contacted",
        "interested",
        "not_interested",
        "converted",
      ],
      delivery_status: ["pending", "sent", "delivered", "read", "failed"],
      feedback_status: [
        "not_answered",
        "interested",
        "not_interested",
        "callback",
        "wrong_number",
      ],
      lead_status: ["new", "contacted", "qualified", "converted", "lost"],
      message_direction: ["inbound", "outbound"],
      upload_status: ["pending", "approved", "rejected", "supplemented"],
    },
  },
} as const
