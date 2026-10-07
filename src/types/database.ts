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
      academic_terms: {
        Row: {
          academic_year: string
          carry_max: number
          created_at: string
          default_deadline: string
          eligible_threshold: number
          ends_on: string
          id: string
          is_current: boolean
          semester_no: number
          starts_on: string
          status: Database["public"]["Enums"]["term_status"]
        }
        Insert: {
          academic_year: string
          carry_max?: number
          created_at?: string
          default_deadline: string
          eligible_threshold?: number
          ends_on: string
          id?: string
          is_current?: boolean
          semester_no: number
          starts_on: string
          status?: Database["public"]["Enums"]["term_status"]
        }
        Update: {
          academic_year?: string
          carry_max?: number
          created_at?: string
          default_deadline?: string
          eligible_threshold?: number
          ends_on?: string
          id?: string
          is_current?: boolean
          semester_no?: number
          starts_on?: string
          status?: Database["public"]["Enums"]["term_status"]
        }
        Relationships: []
      }
      assessments: {
        Row: {
          assessment_type: string
          carry_weight: number
          created_at: string
          id: string
          is_published: boolean
          max_score: number
          name: string
          offering_id: string
          position: number
          updated_at: string
        }
        Insert: {
          assessment_type: string
          carry_weight: number
          created_at?: string
          id?: string
          is_published?: boolean
          max_score: number
          name: string
          offering_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          assessment_type?: string
          carry_weight?: number
          created_at?: string
          id?: string
          is_published?: boolean
          max_score?: number
          name?: string
          offering_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "subject_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          new_data: Json | null
          old_data: Json | null
          subject_code_snapshot: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          subject_code_snapshot?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          subject_code_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sections: {
        Row: {
          capacity: number
          created_at: string
          day_of_week: number | null
          ends_at: string | null
          id: string
          join_code: string | null
          label: string
          offering_id: string
          programme_id: string
          room: string | null
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          capacity: number
          created_at?: string
          day_of_week?: number | null
          ends_at?: string | null
          id?: string
          join_code?: string | null
          label: string
          offering_id: string
          programme_id: string
          room?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          day_of_week?: number | null
          ends_at?: string | null
          id?: string
          join_code?: string | null
          label?: string
          offering_id?: string
          programme_id?: string
          room?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sections_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sections_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "subject_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      enrolments: {
        Row: {
          enrolled_at: string
          external_ref: string | null
          id: string
          section_id: string
          status: Database["public"]["Enums"]["enrolment_status"]
          student_id: string
        }
        Insert: {
          enrolled_at?: string
          external_ref?: string | null
          id?: string
          section_id: string
          status?: Database["public"]["Enums"]["enrolment_status"]
          student_id: string
        }
        Update: {
          enrolled_at?: string
          external_ref?: string | null
          id?: string
          section_id?: string
          status?: Database["public"]["Enums"]["enrolment_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrolments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "class_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      marks: {
        Row: {
          assessment_id: string
          enrolment_id: string
          entered_at: string
          entered_by: string
          id: string
          remarks: string | null
          score: number | null
          updated_at: string
          version: number
        }
        Insert: {
          assessment_id: string
          enrolment_id: string
          entered_at?: string
          entered_by: string
          id?: string
          remarks?: string | null
          score?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          assessment_id?: string
          enrolment_id?: string
          entered_at?: string
          entered_by?: string
          id?: string
          remarks?: string | null
          score?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "marks_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_enrolment_id_fkey"
            columns: ["enrolment_id"]
            isOneToOne: false
            referencedRelation: "enrolments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_enrolment_id_fkey"
            columns: ["enrolment_id"]
            isOneToOne: false
            referencedRelation: "student_carry_totals"
            referencedColumns: ["enrolment_id"]
          },
          {
            foreignKeyName: "marks_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          alert_administrators: boolean
          auto_remind: boolean
          notify_students: boolean
          reminder_days: number
          term_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alert_administrators?: boolean
          auto_remind?: boolean
          notify_students?: boolean
          reminder_days?: number
          term_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alert_administrators?: boolean
          auto_remind?: boolean
          notify_students?: boolean
          reminder_days?: number
          term_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: true
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          delivery_status: string
          id: string
          read_at: string | null
          recipient_id: string
          related_entity_id: string | null
          sent_at: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          delivery_status?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          related_entity_id?: string | null
          sent_at?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          delivery_status?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          related_entity_id?: string | null
          sent_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          reminder_email: string | null
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          staff_no: string
          updated_at: string
        }
        Insert: {
          reminder_email?: string | null
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          staff_no: string
          updated_at?: string
        }
        Update: {
          reminder_email?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          staff_no?: string
          updated_at?: string
        }
        Relationships: []
      }
      programme_deadlines: {
        Row: {
          deadline_at: string
          programme_id: string
          term_id: string
        }
        Insert: {
          deadline_at: string
          programme_id: string
          term_id: string
        }
        Update: {
          deadline_at?: string
          programme_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_deadlines_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_deadlines_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      programmes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          auth_user_id: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          matrix_no: string
          programme_id: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          matrix_no: string
          programme_id: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          matrix_no?: string
          programme_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_offerings: {
        Row: {
          carry_max: number | null
          created_at: string
          deadline_at: string | null
          id: string
          lecturer_id: string
          programme_semester_override: number | null
          status: Database["public"]["Enums"]["offering_status"]
          subject_id: string
          subject_name_override: string | null
          term_id: string
          updated_at: string
        }
        Insert: {
          carry_max?: number | null
          created_at?: string
          deadline_at?: string | null
          id?: string
          lecturer_id: string
          programme_semester_override?: number | null
          status?: Database["public"]["Enums"]["offering_status"]
          subject_id: string
          subject_name_override?: string | null
          term_id: string
          updated_at?: string
        }
        Update: {
          carry_max?: number | null
          created_at?: string
          deadline_at?: string | null
          id?: string
          lecturer_id?: string
          programme_semester_override?: number | null
          status?: Database["public"]["Enums"]["offering_status"]
          subject_id?: string
          subject_name_override?: string | null
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_offerings_lecturer_id_fkey"
            columns: ["lecturer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          credit_hours: number | null
          id: string
          is_active: boolean
          name: string
          programme_semester: number | null
        }
        Insert: {
          code: string
          created_at?: string
          credit_hours?: number | null
          id?: string
          is_active?: boolean
          name: string
          programme_semester?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          credit_hours?: number | null
          id?: string
          is_active?: boolean
          name?: string
          programme_semester?: number | null
        }
        Relationships: []
      }
      submissions: {
        Row: {
          finalised_at: string | null
          finalised_by: string | null
          id: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          section_id: string
          status: Database["public"]["Enums"]["submission_status"]
          updated_at: string
        }
        Insert: {
          finalised_at?: string | null
          finalised_by?: string | null
          id?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          section_id: string
          status?: Database["public"]["Enums"]["submission_status"]
          updated_at?: string
        }
        Update: {
          finalised_at?: string | null
          finalised_by?: string | null
          id?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          section_id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_finalised_by_fkey"
            columns: ["finalised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: true
            referencedRelation: "class_sections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      student_carry_totals: {
        Row: {
          eligible: boolean | null
          eligible_threshold: number | null
          enrolment_id: string | null
          section_id: string | null
          student_id: string | null
          total_carry: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrolments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "class_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      set_offering_carry_max: { Args: { target_offering: string; total_weight: number }; Returns: undefined }
      create_lecturer_subject: { Args: { subject_code: string; subject_name: string; programme_semester: number }; Returns: string }
      update_lecturer_subject: { Args: { target_offering: string; subject_name: string; programme_semester: number }; Returns: undefined }
      can_access_enrolment: { Args: { target: string }; Returns: boolean }
      can_access_offering: { Args: { target: string }; Returns: boolean }
      can_access_section: { Args: { target: string }; Returns: boolean }
      can_access_student: { Args: { target: string }; Returns: boolean }
      finalise_section: { Args: { target_section: string }; Returns: undefined }
      get_my_subjects: {
        Args: never
        Returns: {
          academic_year: string
          carry_mark: number
          carry_max: number
          eligible: boolean
          finalised: boolean
          last_updated: string
          lecturer_name: string
          offering_id: string
          section_label: string
          semester_no: number
          subject_code: string
          subject_name: string
        }[]
      }
      get_my_lecturer_subjects: {
        Args: never
        Returns: {
          offering_id: string
          programme_ids: string[]
          programme_codes: string[]
          programme_names: string[]
          subject_code: string
          subject_name: string
          programme_semester: number | null
          student_count: number
          offering_status: string
          updated_at: string
          academic_year: string
          semester_no: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_current_student: { Args: { target_student: string }; Returns: boolean }
      join_class_by_code: { Args: { invitation_code: string }; Returns: string }
      owns_offering: { Args: { target_offering: string }; Returns: boolean }
      reopen_section: {
        Args: { reason: string; target_section: string }
        Returns: undefined
      }
      rotate_class_join_code: {
        Args: { target_section: string }
        Returns: string
      }
      student_can_read_lecturer: { Args: { target: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "lecturer"
      enrolment_status: "enrolled" | "withdrawn" | "completed"
      offering_status: "draft" | "active" | "completed"
      submission_status: "draft" | "finalised" | "reopened"
      term_status: "draft" | "active" | "closed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "lecturer"],
      enrolment_status: ["enrolled", "withdrawn", "completed"],
      offering_status: ["draft", "active", "completed"],
      submission_status: ["draft", "finalised", "reopened"],
      term_status: ["draft", "active", "closed"],
    },
  },
} as const
