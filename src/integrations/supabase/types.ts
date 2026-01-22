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
      activity_config: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string
          description: string | null
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      activity_confirmations: {
        Row: {
          activity_after: string | null
          activity_before: string | null
          auto_switch_reason: string | null
          created_at: string
          id: string
          prompted_at: string
          responded_at: string | null
          response_type: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          activity_after?: string | null
          activity_before?: string | null
          auto_switch_reason?: string | null
          created_at?: string
          id?: string
          prompted_at?: string
          responded_at?: string | null
          response_type?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          activity_after?: string | null
          activity_before?: string | null
          auto_switch_reason?: string | null
          created_at?: string
          id?: string
          prompted_at?: string
          responded_at?: string | null
          response_type?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_confirmations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "activity_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          activity_details: string | null
          activity_type: Database["public"]["Enums"]["activity_type"]
          auto_switch_reason: string | null
          confirmation_status: string | null
          confirmed_at: string | null
          created_at: string
          duration_minutes: number | null
          ended_at: string | null
          id: string
          is_system_enforced: boolean
          metadata: Json | null
          started_at: string
          user_id: string
        }
        Insert: {
          activity_details?: string | null
          activity_type: Database["public"]["Enums"]["activity_type"]
          auto_switch_reason?: string | null
          confirmation_status?: string | null
          confirmed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          is_system_enforced?: boolean
          metadata?: Json | null
          started_at?: string
          user_id: string
        }
        Update: {
          activity_details?: string | null
          activity_type?: Database["public"]["Enums"]["activity_type"]
          auto_switch_reason?: string | null
          confirmation_status?: string | null
          confirmed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          is_system_enforced?: boolean
          metadata?: Json | null
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_sessions: {
        Row: {
          created_at: string
          current_activity: string | null
          current_activity_started_at: string | null
          date: string
          end_reason: string | null
          end_time: string | null
          id: string
          is_active: boolean | null
          last_confirmation_at: string | null
          missed_confirmations: number | null
          start_time: string | null
          total_others_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_activity?: string | null
          current_activity_started_at?: string | null
          date?: string
          end_reason?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          last_confirmation_at?: string | null
          missed_confirmations?: number | null
          start_time?: string | null
          total_others_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_activity?: string | null
          current_activity_started_at?: string | null
          date?: string
          end_reason?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          last_confirmation_at?: string | null
          missed_confirmations?: number | null
          start_time?: string | null
          total_others_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_goals: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string
          end_date: string
          goal_type: string
          id: string
          is_active: boolean
          metric: string
          start_date: string
          target_value: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string
          end_date: string
          goal_type: string
          id?: string
          is_active?: boolean
          metric: string
          start_date: string
          target_value: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string
          end_date?: string
          goal_type?: string
          id?: string
          is_active?: boolean
          metric?: string
          start_date?: string
          target_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      agent_submissions: {
        Row: {
          agent_id: string
          bank_name: string
          company_name: string
          created_at: string
          id: string
          notes: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submission_date: string
          submission_group: Database["public"]["Enums"]["submission_group"]
          updated_at: string
        }
        Insert: {
          agent_id: string
          bank_name: string
          company_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_date?: string
          submission_group: Database["public"]["Enums"]["submission_group"]
          updated_at?: string
        }
        Update: {
          agent_id?: string
          bank_name?: string
          company_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_date?: string
          submission_group?: Database["public"]["Enums"]["submission_group"]
          updated_at?: string
        }
        Relationships: []
      }
      agent_talk_time: {
        Row: {
          agent_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          talk_time_minutes: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          talk_time_minutes?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          talk_time_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
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
      attendance_records: {
        Row: {
          created_at: string
          daily_score: number | null
          date: string
          end_reason: string | null
          first_login: string | null
          id: string
          is_late: boolean | null
          is_working: boolean | null
          last_confirmation_at: string | null
          last_logout: string | null
          late_by_minutes: number | null
          missed_confirmations: number | null
          start_button_pressed_at: string | null
          status: Database["public"]["Enums"]["attendance_status"] | null
          total_break_minutes: number | null
          total_work_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_score?: number | null
          date?: string
          end_reason?: string | null
          first_login?: string | null
          id?: string
          is_late?: boolean | null
          is_working?: boolean | null
          last_confirmation_at?: string | null
          last_logout?: string | null
          late_by_minutes?: number | null
          missed_confirmations?: number | null
          start_button_pressed_at?: string | null
          status?: Database["public"]["Enums"]["attendance_status"] | null
          total_break_minutes?: number | null
          total_work_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_score?: number | null
          date?: string
          end_reason?: string | null
          first_login?: string | null
          id?: string
          is_late?: boolean | null
          is_working?: boolean | null
          last_confirmation_at?: string | null
          last_logout?: string | null
          late_by_minutes?: number | null
          missed_confirmations?: number | null
          start_button_pressed_at?: string | null
          status?: Database["public"]["Enums"]["attendance_status"] | null
          total_break_minutes?: number | null
          total_work_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      banker_contacts: {
        Row: {
          bank: Database["public"]["Enums"]["case_bank"]
          created_at: string
          created_by: string
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          bank: Database["public"]["Enums"]["case_bank"]
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          bank?: Database["public"]["Enums"]["case_bank"]
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      call_feedback: {
        Row: {
          agent_id: string
          call_list_id: string | null
          call_timestamp: string | null
          callback_datetime: string | null
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
          callback_datetime?: string | null
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
          callback_datetime?: string | null
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
      case_audit_trail: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          case_id: string
          created_at: string
          id: string
          new_value: Json | null
          notes: string | null
          old_value: Json | null
          performed_by: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          case_id: string
          created_at?: string
          id?: string
          new_value?: Json | null
          notes?: string | null
          old_value?: Json | null
          performed_by: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          case_id?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          notes?: string | null
          old_value?: Json | null
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_audit_trail_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_documents: {
        Row: {
          case_id: string
          created_at: string
          document_type: Database["public"]["Enums"]["document_type"]
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          is_verified: boolean | null
          notes: string | null
          uploaded_by: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          document_type: Database["public"]["Enums"]["document_type"]
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          is_verified?: boolean | null
          notes?: string | null
          uploaded_by: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_verified?: boolean | null
          notes?: string | null
          uploaded_by?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          actual_completion_date: string | null
          bank: Database["public"]["Enums"]["case_bank"]
          case_number: string
          contact_id: string
          coordinator_id: string
          created_at: string
          deal_value: number | null
          expected_completion_date: string | null
          id: string
          internal_notes: string | null
          lead_id: string | null
          notes: string | null
          original_agent_id: string
          priority: number | null
          product_type: string
          status: Database["public"]["Enums"]["case_status"]
          updated_at: string
        }
        Insert: {
          actual_completion_date?: string | null
          bank: Database["public"]["Enums"]["case_bank"]
          case_number: string
          contact_id: string
          coordinator_id: string
          created_at?: string
          deal_value?: number | null
          expected_completion_date?: string | null
          id?: string
          internal_notes?: string | null
          lead_id?: string | null
          notes?: string | null
          original_agent_id: string
          priority?: number | null
          product_type: string
          status?: Database["public"]["Enums"]["case_status"]
          updated_at?: string
        }
        Update: {
          actual_completion_date?: string | null
          bank?: Database["public"]["Enums"]["case_bank"]
          case_number?: string
          contact_id?: string
          coordinator_id?: string
          created_at?: string
          deal_value?: number | null
          expected_completion_date?: string | null
          id?: string
          internal_notes?: string | null
          lead_id?: string | null
          notes?: string | null
          original_agent_id?: string
          priority?: number | null
          product_type?: string
          status?: Database["public"]["Enums"]["case_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "master_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_conversations: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      coach_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "coach_conversations"
            referencedColumns: ["id"]
          },
        ]
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
      document_templates: {
        Row: {
          bank: Database["public"]["Enums"]["case_bank"]
          created_at: string
          description: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          id: string
          is_required: boolean | null
          product_type: string
        }
        Insert: {
          bank: Database["public"]["Enums"]["case_bank"]
          created_at?: string
          description?: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          id?: string
          is_required?: boolean | null
          product_type: string
        }
        Update: {
          bank?: Database["public"]["Enums"]["case_bank"]
          created_at?: string
          description?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          id?: string
          is_required?: boolean | null
          product_type?: string
        }
        Relationships: []
      }
      follow_ups: {
        Row: {
          case_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          follow_up_type: Database["public"]["Enums"]["follow_up_type"]
          id: string
          notes: string | null
          outcome: string | null
          scheduled_at: string
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          follow_up_type: Database["public"]["Enums"]["follow_up_type"]
          id?: string
          notes?: string | null
          outcome?: string | null
          scheduled_at: string
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          follow_up_type?: Database["public"]["Enums"]["follow_up_type"]
          id?: string
          notes?: string | null
          outcome?: string | null
          scheduled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_logs: {
        Row: {
          activity_log_id: string
          created_at: string
          followup_count: number
          id: string
          remark: string | null
          remark_time: string
        }
        Insert: {
          activity_log_id: string
          created_at?: string
          followup_count?: number
          id?: string
          remark?: string | null
          remark_time?: string
        }
        Update: {
          activity_log_id?: string
          created_at?: string
          followup_count?: number
          id?: string
          remark?: string | null
          remark_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_logs_activity_log_id_fkey"
            columns: ["activity_log_id"]
            isOneToOne: false
            referencedRelation: "activity_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      idle_alerts: {
        Row: {
          acknowledged_at: string | null
          alert_time: string
          created_at: string
          escalated_to: string | null
          id: string
          idle_duration_minutes: number
          notes: string | null
          severity: Database["public"]["Enums"]["idle_alert_severity"]
          user_id: string
          was_acknowledged: boolean | null
        }
        Insert: {
          acknowledged_at?: string | null
          alert_time?: string
          created_at?: string
          escalated_to?: string | null
          id?: string
          idle_duration_minutes: number
          notes?: string | null
          severity: Database["public"]["Enums"]["idle_alert_severity"]
          user_id: string
          was_acknowledged?: boolean | null
        }
        Update: {
          acknowledged_at?: string | null
          alert_time?: string
          created_at?: string
          escalated_to?: string | null
          id?: string
          idle_duration_minutes?: number
          notes?: string | null
          severity?: Database["public"]["Enums"]["idle_alert_severity"]
          user_id?: string
          was_acknowledged?: boolean | null
        }
        Relationships: []
      }
      lead_stage_transitions: {
        Row: {
          changed_at: string
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["lead_status"] | null
          id: string
          lead_id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["lead_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          lead_id: string
          notes?: string | null
          to_status: Database["public"]["Enums"]["lead_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          lead_id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["lead_status"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_transitions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
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
          lead_source: string | null
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
          lead_source?: string | null
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
          lead_source?: string | null
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
          area: string | null
          city: string | null
          company_name: string
          contact_person_name: string | null
          created_at: string | null
          current_owner_agent_id: string | null
          first_upload_date: string | null
          first_uploaded_by: string | null
          id: string
          in_company_pool: boolean | null
          industry: string | null
          ownership_lock_until: string | null
          phone_number: string
          pool_entry_date: string | null
          status: Database["public"]["Enums"]["contact_status"] | null
          trade_license_number: string | null
          updated_at: string | null
        }
        Insert: {
          area?: string | null
          city?: string | null
          company_name: string
          contact_person_name?: string | null
          created_at?: string | null
          current_owner_agent_id?: string | null
          first_upload_date?: string | null
          first_uploaded_by?: string | null
          id?: string
          in_company_pool?: boolean | null
          industry?: string | null
          ownership_lock_until?: string | null
          phone_number: string
          pool_entry_date?: string | null
          status?: Database["public"]["Enums"]["contact_status"] | null
          trade_license_number?: string | null
          updated_at?: string | null
        }
        Update: {
          area?: string | null
          city?: string | null
          company_name?: string
          contact_person_name?: string | null
          created_at?: string | null
          current_owner_agent_id?: string | null
          first_upload_date?: string | null
          first_uploaded_by?: string | null
          id?: string
          in_company_pool?: boolean | null
          industry?: string | null
          ownership_lock_until?: string | null
          phone_number?: string
          pool_entry_date?: string | null
          status?: Database["public"]["Enums"]["contact_status"] | null
          trade_license_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      meeting_logs: {
        Row: {
          activity_log_id: string
          client_name: string
          created_at: string
          id: string
          next_step: string
          outcome: string
        }
        Insert: {
          activity_log_id: string
          client_name: string
          created_at?: string
          id?: string
          next_step: string
          outcome: string
        }
        Update: {
          activity_log_id?: string
          client_name?: string
          created_at?: string
          id?: string
          next_step?: string
          outcome?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_logs_activity_log_id_fkey"
            columns: ["activity_log_id"]
            isOneToOne: false
            referencedRelation: "activity_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          actual_value: number
          agent_id: string | null
          alert_status: Database["public"]["Enums"]["alert_status"]
          alert_type: Database["public"]["Enums"]["alert_type"]
          created_at: string
          id: string
          message: string | null
          metric: string
          percentage_achieved: number
          severity: Database["public"]["Enums"]["alert_severity"]
          target_id: string
          target_value: number
          team_id: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_value: number
          agent_id?: string | null
          alert_status?: Database["public"]["Enums"]["alert_status"]
          alert_type: Database["public"]["Enums"]["alert_type"]
          created_at?: string
          id?: string
          message?: string | null
          metric: string
          percentage_achieved: number
          severity?: Database["public"]["Enums"]["alert_severity"]
          target_id: string
          target_value: number
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_value?: number
          agent_id?: string | null
          alert_status?: Database["public"]["Enums"]["alert_status"]
          alert_type?: Database["public"]["Enums"]["alert_type"]
          created_at?: string
          id?: string
          message?: string | null
          metric?: string
          percentage_achieved?: number
          severity?: Database["public"]["Enums"]["alert_severity"]
          target_id?: string
          target_value?: number
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_alerts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_alerts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_alerts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_alerts_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "performance_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_alerts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
      performance_targets: {
        Row: {
          agent_id: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          metric: string
          period: string
          target_type: Database["public"]["Enums"]["alert_type"]
          target_value: number
          team_id: string | null
          threshold_percentage: number
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          metric: string
          period?: string
          target_type: Database["public"]["Enums"]["alert_type"]
          target_value: number
          team_id?: string | null
          threshold_percentage?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          metric?: string
          period?: string
          target_type?: Database["public"]["Enums"]["alert_type"]
          target_value?: number
          team_id?: string | null
          threshold_percentage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_targets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_targets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_targets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_targets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
          last_login_date: string | null
          login_streak_current: number | null
          login_streak_longest: number | null
          max_case_capacity: number | null
          phone_number: string | null
          supervisor_id: string | null
          team_id: string | null
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
          last_login_date?: string | null
          login_streak_current?: number | null
          login_streak_longest?: number | null
          max_case_capacity?: number | null
          phone_number?: string | null
          supervisor_id?: string | null
          team_id?: string | null
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
          last_login_date?: string | null
          login_streak_current?: number | null
          login_streak_longest?: number | null
          max_case_capacity?: number | null
          phone_number?: string | null
          supervisor_id?: string | null
          team_id?: string | null
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
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          created_at: string
          created_by: string
          frequency: string
          id: string
          include_agent_breakdown: boolean
          include_alerts_summary: boolean
          include_team_summary: boolean
          is_active: boolean
          last_sent_at: string | null
          recipients: Json
          report_type: string
          schedule_day: number
          schedule_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          frequency?: string
          id?: string
          include_agent_breakdown?: boolean
          include_alerts_summary?: boolean
          include_team_summary?: boolean
          is_active?: boolean
          last_sent_at?: string | null
          recipients?: Json
          report_type?: string
          schedule_day?: number
          schedule_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          frequency?: string
          id?: string
          include_agent_breakdown?: boolean
          include_alerts_summary?: boolean
          include_team_summary?: boolean
          is_active?: boolean
          last_sent_at?: string | null
          recipients?: Json
          report_type?: string
          schedule_day?: number
          schedule_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      supervisor_alerts: {
        Row: {
          agent_id: string
          agent_name: string | null
          alert_type: string
          created_at: string
          description: string | null
          details: Json | null
          id: string
          is_read: boolean | null
          read_at: string | null
          supervisor_id: string
          title: string
        }
        Insert: {
          agent_id: string
          agent_name?: string | null
          alert_type: string
          created_at?: string
          description?: string | null
          details?: Json | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          supervisor_id: string
          title: string
        }
        Update: {
          agent_id?: string
          agent_name?: string | null
          alert_type?: string
          created_at?: string
          description?: string | null
          details?: Json | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          supervisor_id?: string
          title?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          id: string
          leader_id: string | null
          name: string
          team_type: Database["public"]["Enums"]["team_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          leader_id?: string | null
          name: string
          team_type: Database["public"]["Enums"]["team_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          leader_id?: string | null
          name?: string
          team_type?: Database["public"]["Enums"]["team_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_processing_logs: {
        Row: {
          agent_id: string
          created_at: string
          ended_at: string | null
          file_name: string
          id: string
          log_entries: Json
          session_id: string
          started_at: string
          summary: Json | null
          upload_id: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          ended_at?: string | null
          file_name: string
          id?: string
          log_entries?: Json
          session_id: string
          started_at?: string
          summary?: Json | null
          upload_id?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          ended_at?: string | null
          file_name?: string
          id?: string
          log_entries?: Json
          session_id?: string
          started_at?: string
          summary?: Json | null
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upload_processing_logs_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "call_sheet_uploads"
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
      whatsapp_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean | null
          name: string
          placeholders: string[] | null
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean | null
          name: string
          placeholders?: string[] | null
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean | null
          name?: string
          placeholders?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          last_login_date: string | null
          login_streak_current: number | null
          login_streak_longest: number | null
          supervisor_id: string | null
          team_id: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          last_login_date?: string | null
          login_streak_current?: number | null
          login_streak_longest?: number | null
          supervisor_id?: string | null
          team_id?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          last_login_date?: string | null
          login_streak_current?: number | null
          login_streak_longest?: number | null
          supervisor_id?: string | null
          team_id?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_secure: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          last_login: string | null
          last_login_date: string | null
          login_streak_current: number | null
          login_streak_longest: number | null
          phone_number: string | null
          supervisor_id: string | null
          team_id: string | null
          updated_at: string | null
          username: string | null
          whatsapp_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          last_login?: string | null
          last_login_date?: string | null
          login_streak_current?: number | null
          login_streak_longest?: number | null
          phone_number?: string | null
          supervisor_id?: string | null
          team_id?: string | null
          updated_at?: string | null
          username?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          last_login?: string | null
          last_login_date?: string | null
          login_streak_current?: number | null
          login_streak_longest?: number | null
          phone_number?: string | null
          supervisor_id?: string | null
          team_id?: string | null
          updated_at?: string | null
          username?: string | null
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
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_daily_score: {
        Args: { p_date?: string; p_user_id: string }
        Returns: number
      }
      can_access_sensitive_profile: {
        Args: { profile_id: string }
        Returns: boolean
      }
      check_dnc: { Args: { phone_to_check: string }; Returns: boolean }
      check_duplicate_phone_numbers: {
        Args: { phone_numbers: string[] }
        Returns: {
          exists_in_db: boolean
          owner_agent_id: string
          owner_name: string
          phone_number: string
        }[]
      }
      decrypt_sensitive_data: {
        Args: { encrypted_data: string }
        Returns: string
      }
      find_contact_by_phone: { Args: { phone: string }; Returns: string }
      generate_case_number: { Args: never; Returns: string }
      get_led_team_id: { Args: { _user_id: string }; Returns: string }
      get_own_profile: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_login_date: string
          login_streak_current: number
          login_streak_longest: number
          phone_number: string
          supervisor_id: string
          team_id: string
          updated_at: string
          username: string
          whatsapp_number: string
        }[]
      }
      get_public_profile_info: {
        Args: { profile_id: string }
        Returns: {
          avatar_url: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          supervisor_id: string
          team_id: string
          username: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_team_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_coordinator: { Args: { user_id: string }; Returns: boolean }
      is_team_leader: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      mask_email: { Args: { email_text: string }; Returns: string }
      mask_phone: { Args: { phone_text: string }; Returns: string }
      move_old_contacts_to_pool: { Args: never; Returns: number }
      switch_activity:
        | {
            Args: {
              p_activity_type: Database["public"]["Enums"]["activity_type"]
              p_metadata?: Json
            }
            Returns: string
          }
        | {
            Args: {
              p_activity_type: Database["public"]["Enums"]["activity_type"]
              p_metadata?: Json
              p_user_id: string
            }
            Returns: string
          }
      trigger_performance_check: { Args: never; Returns: undefined }
      update_login_streak: {
        Args: { user_id: string }
        Returns: {
          current_streak: number
          is_new_day: boolean
          longest_streak: number
          streak_bonus_xp: number
        }[]
      }
    }
    Enums: {
      action_type: "upload" | "call" | "feedback" | "reassign" | "status_change"
      activity_type:
        | "data_collection"
        | "customer_followup"
        | "calling_telecalling"
        | "calling_coldcalling"
        | "calling_calllist_movement"
        | "client_meeting"
        | "admin_documentation"
        | "training"
        | "system_bank_portal"
        | "break"
        | "idle"
      alert_severity: "warning" | "critical"
      alert_status: "active" | "acknowledged" | "resolved"
      alert_type: "team" | "agent"
      app_role:
        | "agent"
        | "supervisor"
        | "operations_head"
        | "admin"
        | "super_admin"
        | "sales_controller"
        | "coordinator"
      attendance_status: "present" | "late" | "absent" | "half_day"
      audit_action:
        | "case_created"
        | "status_changed"
        | "document_uploaded"
        | "document_verified"
        | "note_added"
        | "follow_up_scheduled"
        | "follow_up_completed"
        | "assigned"
        | "reassigned"
      call_status: "pending" | "called" | "skipped"
      case_bank: "RAK" | "NBF" | "UBL" | "RUYA" | "MASHREQ" | "WIO"
      case_status:
        | "new"
        | "document_collection"
        | "under_review"
        | "submitted_to_bank"
        | "bank_processing"
        | "approved"
        | "declined"
        | "on_hold"
        | "cancelled"
      contact_status:
        | "new"
        | "contacted"
        | "interested"
        | "not_interested"
        | "converted"
      delivery_status: "pending" | "sent" | "delivered" | "read" | "failed"
      document_type:
        | "trade_license"
        | "emirates_id"
        | "passport"
        | "visa"
        | "bank_statement"
        | "financials"
        | "moa"
        | "power_of_attorney"
        | "other"
      feedback_status:
        | "not_answered"
        | "interested"
        | "not_interested"
        | "callback"
        | "wrong_number"
      follow_up_type:
        | "call"
        | "email"
        | "whatsapp"
        | "meeting"
        | "bank_visit"
        | "other"
      idle_alert_severity: "warning" | "escalation" | "discipline_flag"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "converted"
        | "lost"
        | "approved"
        | "declined"
      message_direction: "inbound" | "outbound"
      submission_group: "group1" | "group2"
      team_type: "remote" | "office"
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
      activity_type: [
        "data_collection",
        "customer_followup",
        "calling_telecalling",
        "calling_coldcalling",
        "calling_calllist_movement",
        "client_meeting",
        "admin_documentation",
        "training",
        "system_bank_portal",
        "break",
        "idle",
      ],
      alert_severity: ["warning", "critical"],
      alert_status: ["active", "acknowledged", "resolved"],
      alert_type: ["team", "agent"],
      app_role: [
        "agent",
        "supervisor",
        "operations_head",
        "admin",
        "super_admin",
        "sales_controller",
        "coordinator",
      ],
      attendance_status: ["present", "late", "absent", "half_day"],
      audit_action: [
        "case_created",
        "status_changed",
        "document_uploaded",
        "document_verified",
        "note_added",
        "follow_up_scheduled",
        "follow_up_completed",
        "assigned",
        "reassigned",
      ],
      call_status: ["pending", "called", "skipped"],
      case_bank: ["RAK", "NBF", "UBL", "RUYA", "MASHREQ", "WIO"],
      case_status: [
        "new",
        "document_collection",
        "under_review",
        "submitted_to_bank",
        "bank_processing",
        "approved",
        "declined",
        "on_hold",
        "cancelled",
      ],
      contact_status: [
        "new",
        "contacted",
        "interested",
        "not_interested",
        "converted",
      ],
      delivery_status: ["pending", "sent", "delivered", "read", "failed"],
      document_type: [
        "trade_license",
        "emirates_id",
        "passport",
        "visa",
        "bank_statement",
        "financials",
        "moa",
        "power_of_attorney",
        "other",
      ],
      feedback_status: [
        "not_answered",
        "interested",
        "not_interested",
        "callback",
        "wrong_number",
      ],
      follow_up_type: [
        "call",
        "email",
        "whatsapp",
        "meeting",
        "bank_visit",
        "other",
      ],
      idle_alert_severity: ["warning", "escalation", "discipline_flag"],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "converted",
        "lost",
        "approved",
        "declined",
      ],
      message_direction: ["inbound", "outbound"],
      submission_group: ["group1", "group2"],
      team_type: ["remote", "office"],
      upload_status: ["pending", "approved", "rejected", "supplemented"],
    },
  },
} as const
