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
      companies: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          industry: string | null
          name: string
          notes: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_controls: {
        Row: {
          company_id: string
          control_id: string
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          owner_user_id: string | null
          status: Database["public"]["Enums"]["company_control_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          control_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          owner_user_id?: string | null
          status?: Database["public"]["Enums"]["company_control_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          control_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          owner_user_id?: string | null
          status?: Database["public"]["Enums"]["company_control_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_controls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_controls_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          role: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          role?: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["company_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      controls: {
        Row: {
          control_ref: string
          control_type: Database["public"]["Enums"]["control_type"]
          created_at: string
          description: string | null
          domain: string | null
          evidence_examples: string | null
          evidence_keywords: string | null
          framework_id: string
          id: string
          parent_control_id: string | null
          recommendation_template: string | null
          source: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          control_ref: string
          control_type?: Database["public"]["Enums"]["control_type"]
          created_at?: string
          description?: string | null
          domain?: string | null
          evidence_examples?: string | null
          evidence_keywords?: string | null
          framework_id: string
          id?: string
          parent_control_id?: string | null
          recommendation_template?: string | null
          source?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          control_ref?: string
          control_type?: Database["public"]["Enums"]["control_type"]
          created_at?: string
          description?: string | null
          domain?: string | null
          evidence_examples?: string | null
          evidence_keywords?: string | null
          framework_id?: string
          id?: string
          parent_control_id?: string | null
          recommendation_template?: string | null
          source?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "controls_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controls_parent_control_id_fkey"
            columns: ["parent_control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
        ]
      }
      crosswalks: {
        Row: {
          created_at: string
          id: string
          mapping_type: Database["public"]["Enums"]["crosswalk_mapping_type"]
          notes: string | null
          source_control_id: string
          target_control_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mapping_type?: Database["public"]["Enums"]["crosswalk_mapping_type"]
          notes?: string | null
          source_control_id: string
          target_control_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mapping_type?: Database["public"]["Enums"]["crosswalk_mapping_type"]
          notes?: string | null
          source_control_id?: string
          target_control_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crosswalks_source_control_id_fkey"
            columns: ["source_control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crosswalks_target_control_id_fkey"
            columns: ["target_control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          collected_at: string | null
          collected_by: string | null
          company_id: string
          created_at: string
          description: string | null
          expires_at: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          status: Database["public"]["Enums"]["evidence_status"]
          storage_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          collected_at?: string | null
          collected_by?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          status?: Database["public"]["Enums"]["evidence_status"]
          storage_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          collected_at?: string | null
          collected_by?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          status?: Database["public"]["Enums"]["evidence_status"]
          storage_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_controls: {
        Row: {
          company_control_id: string
          evidence_id: string
          tagged_at: string
          tagged_by: string | null
        }
        Insert: {
          company_control_id: string
          evidence_id: string
          tagged_at?: string
          tagged_by?: string | null
        }
        Update: {
          company_control_id?: string
          evidence_id?: string
          tagged_at?: string
          tagged_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_controls_company_control_id_fkey"
            columns: ["company_control_id"]
            isOneToOne: false
            referencedRelation: "company_controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_controls_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      frameworks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          version: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          version?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          version?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_company_id: string | null
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_company_id?: string | null
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_company_id?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_company_fk"
            columns: ["default_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          company_id: string
          control_id: string | null
          created_at: string
          details: string | null
          id: string
          severity: Database["public"]["Enums"]["recommendation_severity"]
          status: Database["public"]["Enums"]["recommendation_status"]
          summary: string
          updated_at: string
        }
        Insert: {
          company_id: string
          control_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["recommendation_severity"]
          status?: Database["public"]["Enums"]["recommendation_status"]
          summary: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          control_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["recommendation_severity"]
          status?: Database["public"]["Enums"]["recommendation_status"]
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          evidence_id: string
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewer_user_id: string | null
          status: Database["public"]["Enums"]["review_status"]
        }
        Insert: {
          created_at?: string
          evidence_id: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          status?: Database["public"]["Enums"]["review_status"]
        }
        Update: {
          created_at?: string
          evidence_id?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          status?: Database["public"]["Enums"]["review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reviews_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_company: {
        Args: {
          p_industry?: string
          p_name: string
          p_notes?: string
          p_slug?: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          industry: string | null
          name: string
          notes: string | null
          slug: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_company_role: {
        Args: {
          p_company_id: string
          p_roles: Database["public"]["Enums"]["company_role"][]
        }
        Returns: boolean
      }
      is_company_member: { Args: { p_company_id: string }; Returns: boolean }
    }
    Enums: {
      company_control_status:
        | "not_started"
        | "in_progress"
        | "implemented"
        | "not_applicable"
      company_role: "owner" | "admin" | "contributor" | "viewer"
      control_type: "parent" | "child" | "standalone"
      crosswalk_mapping_type:
        | "direct"
        | "inherited"
        | "effective"
        | "related"
        | "equivalent"
        | "partial"
      evidence_status: "draft" | "in_review" | "finalized" | "rejected"
      recommendation_severity: "low" | "med" | "high" | "critical"
      recommendation_status: "open" | "in_progress" | "resolved" | "dismissed"
      review_status: "pending" | "approved" | "rejected"
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
    Enums: {
      company_control_status: [
        "not_started",
        "in_progress",
        "implemented",
        "not_applicable",
      ],
      company_role: ["owner", "admin", "contributor", "viewer"],
      control_type: ["parent", "child", "standalone"],
      crosswalk_mapping_type: [
        "direct",
        "inherited",
        "effective",
        "related",
        "equivalent",
        "partial",
      ],
      evidence_status: ["draft", "in_review", "finalized", "rejected"],
      recommendation_severity: ["low", "med", "high", "critical"],
      recommendation_status: ["open", "in_progress", "resolved", "dismissed"],
      review_status: ["pending", "approved", "rejected"],
    },
  },
} as const

