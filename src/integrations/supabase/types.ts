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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          ats_score: number | null
          certifications_score: number | null
          completed_at: string | null
          confidence: number | null
          created_at: string
          education_score: number | null
          error_message: string | null
          experience_score: number | null
          hiring_likelihood: string | null
          id: string
          job_description_id: string | null
          keywords_score: number | null
          model: string | null
          overall_score: number | null
          payment_id: string | null
          product: Database["public"]["Enums"]["product_code"]
          report: Json
          resume_id: string | null
          role_title: string | null
          semantic_similarity: number | null
          skills_score: number | null
          status: Database["public"]["Enums"]["analysis_status"]
          user_id: string
        }
        Insert: {
          ats_score?: number | null
          certifications_score?: number | null
          completed_at?: string | null
          confidence?: number | null
          created_at?: string
          education_score?: number | null
          error_message?: string | null
          experience_score?: number | null
          hiring_likelihood?: string | null
          id?: string
          job_description_id?: string | null
          keywords_score?: number | null
          model?: string | null
          overall_score?: number | null
          payment_id?: string | null
          product?: Database["public"]["Enums"]["product_code"]
          report?: Json
          resume_id?: string | null
          role_title?: string | null
          semantic_similarity?: number | null
          skills_score?: number | null
          status?: Database["public"]["Enums"]["analysis_status"]
          user_id: string
        }
        Update: {
          ats_score?: number | null
          certifications_score?: number | null
          completed_at?: string | null
          confidence?: number | null
          created_at?: string
          education_score?: number | null
          error_message?: string | null
          experience_score?: number | null
          hiring_likelihood?: string | null
          id?: string
          job_description_id?: string | null
          keywords_score?: number | null
          model?: string | null
          overall_score?: number | null
          payment_id?: string | null
          product?: Database["public"]["Enums"]["product_code"]
          report?: Json
          resume_id?: string | null
          role_title?: string | null
          semantic_similarity?: number | null
          skills_score?: number | null
          status?: Database["public"]["Enums"]["analysis_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_job_description_id_fkey"
            columns: ["job_description_id"]
            isOneToOne: false
            referencedRelation: "job_descriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyses_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyses_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          ip: string | null
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      coach_plans: {
        Row: {
          created_at: string
          current_score: number
          id: string
          job_description_id: string | null
          plan: Json
          projected_score: number
          resume_id: string | null
          target_role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_score?: number
          id?: string
          job_description_id?: string | null
          plan?: Json
          projected_score?: number
          resume_id?: string | null
          target_role: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_score?: number
          id?: string
          job_description_id?: string | null
          plan?: Json
          projected_score?: number
          resume_id?: string | null
          target_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_plans_job_description_id_fkey"
            columns: ["job_description_id"]
            isOneToOne: false
            referencedRelation: "job_descriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_plans_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      job_descriptions: {
        Row: {
          company: string | null
          content: string
          created_at: string
          id: string
          location: string | null
          parsed: Json
          seniority: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          content: string
          created_at?: string
          id?: string
          location?: string | null
          parsed?: Json
          seniority?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          content?: string
          created_at?: string
          id?: string
          location?: string | null
          parsed?: Json
          seniority?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_usd: number
          asset: string | null
          consumed_at: string | null
          created_at: string
          failure_reason: string | null
          id: string
          network: string | null
          pay_to: string | null
          payer: string | null
          payload: Json
          product: Database["public"]["Enums"]["product_code"]
          receipt_code: string
          status: Database["public"]["Enums"]["payment_status"]
          tx_hash: string | null
          user_id: string | null
        }
        Insert: {
          amount_usd: number
          asset?: string | null
          consumed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          network?: string | null
          pay_to?: string | null
          payer?: string | null
          payload?: Json
          product: Database["public"]["Enums"]["product_code"]
          receipt_code?: string
          status?: Database["public"]["Enums"]["payment_status"]
          tx_hash?: string | null
          user_id?: string | null
        }
        Update: {
          amount_usd?: number
          asset?: string | null
          consumed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          network?: string | null
          pay_to?: string | null
          payer?: string | null
          payload?: Json
          product?: Database["public"]["Enums"]["product_code"]
          receipt_code?: string
          status?: Database["public"]["Enums"]["payment_status"]
          tx_hash?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pricing: {
        Row: {
          active: boolean
          description: string | null
          label: string
          price_usd: number
          product: Database["public"]["Enums"]["product_code"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          description?: string | null
          label: string
          price_usd: number
          product: Database["public"]["Enums"]["product_code"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          description?: string | null
          label?: string
          price_usd?: number
          product?: Database["public"]["Enums"]["product_code"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          email: string | null
          full_name: string | null
          headline: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          headline?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          headline?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      resumes: {
        Row: {
          candidate_name: string | null
          created_at: string
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          parsed: Json
          raw_text: string
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          candidate_name?: string | null
          created_at?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          parsed?: Json
          raw_text?: string
          title?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          candidate_name?: string | null
          created_at?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          parsed?: Json
          raw_text?: string
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      screening_candidates: {
        Row: {
          alternative_roles: string[]
          bias_flags: Json
          candidate_label: string
          created_at: string
          id: string
          matched_skills: string[]
          missing_skills: string[]
          rationale: string | null
          resume_id: string | null
          score: number
          screening_id: string
          selected: boolean
          study_topics: Json
          user_id: string
        }
        Insert: {
          alternative_roles?: string[]
          bias_flags?: Json
          candidate_label: string
          created_at?: string
          id?: string
          matched_skills?: string[]
          missing_skills?: string[]
          rationale?: string | null
          resume_id?: string | null
          score?: number
          screening_id: string
          selected?: boolean
          study_topics?: Json
          user_id: string
        }
        Update: {
          alternative_roles?: string[]
          bias_flags?: Json
          candidate_label?: string
          created_at?: string
          id?: string
          matched_skills?: string[]
          missing_skills?: string[]
          rationale?: string | null
          resume_id?: string | null
          score?: number
          screening_id?: string
          selected?: boolean
          study_topics?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_candidates_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_candidates_screening_id_fkey"
            columns: ["screening_id"]
            isOneToOne: false
            referencedRelation: "screenings"
            referencedColumns: ["id"]
          },
        ]
      }
      screenings: {
        Row: {
          anonymize: boolean
          bias_summary: Json
          candidate_count: number
          completed_at: string | null
          created_at: string
          cutoff: number
          error_message: string | null
          id: string
          job_description_id: string | null
          selected_count: number
          status: string
          title: string
          user_id: string
        }
        Insert: {
          anonymize?: boolean
          bias_summary?: Json
          candidate_count?: number
          completed_at?: string | null
          created_at?: string
          cutoff?: number
          error_message?: string | null
          id?: string
          job_description_id?: string | null
          selected_count?: number
          status?: string
          title: string
          user_id: string
        }
        Update: {
          anonymize?: boolean
          bias_summary?: Json
          candidate_count?: number
          completed_at?: string | null
          created_at?: string
          cutoff?: number
          error_message?: string | null
          id?: string
          job_description_id?: string | null
          selected_count?: number
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screenings_job_description_id_fkey"
            columns: ["job_description_id"]
            isOneToOne: false
            referencedRelation: "job_descriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      grant_admin_role: { Args: { _email: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      analysis_status:
        | "pending"
        | "paid"
        | "processing"
        | "completed"
        | "failed"
      app_role: "user" | "recruiter" | "admin"
      payment_status: "pending" | "verified" | "settled" | "failed" | "consumed"
      product_code: "match_analysis" | "premium_ats" | "recruiter_bulk"
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
      analysis_status: ["pending", "paid", "processing", "completed", "failed"],
      app_role: ["user", "recruiter", "admin"],
      payment_status: ["pending", "verified", "settled", "failed", "consumed"],
      product_code: ["match_analysis", "premium_ats", "recruiter_bulk"],
    },
  },
} as const
