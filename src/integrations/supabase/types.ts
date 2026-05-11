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
      conversation_participants: {
        Row: {
          conversation_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          current_uses: number
          expires_at: string | null
          id: string
          max_uses: number | null
          organization_id: string
          role_assigned: Database["public"]["Enums"]["org_role"]
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          organization_id: string
          role_assigned?: Database["public"]["Enums"]["org_role"]
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          organization_id?: string
          role_assigned?: Database["public"]["Enums"]["org_role"]
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_resources: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          resource_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          resource_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          attendee_id: string
          created_at: string
          duration_minutes: number
          host_id: string
          id: string
          location: string | null
          notes: string | null
          organization_id: string
          scheduled_at: string
          status: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at: string
        }
        Insert: {
          attendee_id: string
          created_at?: string
          duration_minutes?: number
          host_id: string
          id?: string
          location?: string | null
          notes?: string | null
          organization_id: string
          scheduled_at: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at?: string
        }
        Update: {
          attendee_id?: string
          created_at?: string
          duration_minutes?: number
          host_id?: string
          id?: string
          location?: string | null
          notes?: string | null
          organization_id?: string
          scheduled_at?: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorships: {
        Row: {
          created_at: string
          id: string
          intro_message: string | null
          mentee_id: string
          mentor_id: string
          organization_id: string
          requested_by: string | null
          status: Database["public"]["Enums"]["mentorship_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          intro_message?: string | null
          mentee_id: string
          mentor_id: string
          organization_id: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["mentorship_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          intro_message?: string | null
          mentee_id?: string
          mentor_id?: string
          organization_id?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["mentorship_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentorships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_resources: {
        Row: {
          created_at: string
          id: string
          message_id: string
          resource_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          resource_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          audio_url: string | null
          body: string
          conversation_id: string
          created_at: string
          duration_seconds: number | null
          id: string
          kind: string
          sender_id: string
        }
        Insert: {
          audio_url?: string | null
          body: string
          conversation_id: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          kind?: string
          sender_id: string
        }
        Update: {
          audio_url?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          kind?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          push_meetings: boolean
          push_mentorship: boolean
          push_messages: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          push_meetings?: boolean
          push_mentorship?: boolean
          push_messages?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          push_meetings?: boolean
          push_mentorship?: boolean
          push_messages?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          organization_id: string
          read: boolean
          related_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          organization_id: string
          read?: boolean
          related_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          organization_id?: string
          read?: boolean
          related_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          org_role: Database["public"]["Enums"]["org_role"]
          organization_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_role?: Database["public"]["Enums"]["org_role"]
          organization_id: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_role?: Database["public"]["Enums"]["org_role"]
          organization_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          invited_email: string | null
          joined_at: string | null
          org_role: Database["public"]["Enums"]["org_role"]
          organization_id: string
          status: Database["public"]["Enums"]["org_member_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          joined_at?: string | null
          org_role?: Database["public"]["Enums"]["org_role"]
          organization_id: string
          status?: Database["public"]["Enums"]["org_member_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          joined_at?: string | null
          org_role?: Database["public"]["Enums"]["org_role"]
          organization_id?: string
          status?: Database["public"]["Enums"]["org_member_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accent_color: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["org_kind"]
          logo_url: string | null
          name: string
          paused: boolean
          paused_at: string | null
          slug: string
          updated_at: string
          website: string | null
          welcome_message: string | null
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["org_kind"]
          logo_url?: string | null
          name: string
          paused?: boolean
          paused_at?: string | null
          slug: string
          updated_at?: string
          website?: string | null
          welcome_message?: string | null
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["org_kind"]
          logo_url?: string | null
          name?: string
          paused?: boolean
          paused_at?: string | null
          slug?: string
          updated_at?: string
          website?: string | null
          welcome_message?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accepting_mentees: boolean
          avatar_url: string | null
          bar_admissions: string[] | null
          bio: string | null
          city: string | null
          communication_prefs: string[]
          created_at: string
          firm: string | null
          full_name: string | null
          headline: string | null
          id: string
          is_mentee: boolean
          is_mentor: boolean
          linkedin_url: string | null
          meeting_cadence: string | null
          onboarded: boolean
          organization_id: string | null
          practice_areas: string[] | null
          state: string | null
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          accepting_mentees?: boolean
          avatar_url?: string | null
          bar_admissions?: string[] | null
          bio?: string | null
          city?: string | null
          communication_prefs?: string[]
          created_at?: string
          firm?: string | null
          full_name?: string | null
          headline?: string | null
          id?: string
          is_mentee?: boolean
          is_mentor?: boolean
          linkedin_url?: string | null
          meeting_cadence?: string | null
          onboarded?: boolean
          organization_id?: string | null
          practice_areas?: string[] | null
          state?: string | null
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          accepting_mentees?: boolean
          avatar_url?: string | null
          bar_admissions?: string[] | null
          bio?: string | null
          city?: string | null
          communication_prefs?: string[]
          created_at?: string
          firm?: string | null
          full_name?: string | null
          headline?: string | null
          id?: string
          is_mentee?: boolean
          is_mentor?: boolean
          linkedin_url?: string | null
          meeting_cadence?: string | null
          onboarded?: boolean
          organization_id?: string | null
          practice_areas?: string[] | null
          state?: string | null
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          category: Database["public"]["Enums"]["resource_category"]
          created_at: string
          description: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          is_featured: boolean
          organization_id: string
          storage_path: string
          title: string
          uploaded_by_user_id: string
          visibility: Database["public"]["Enums"]["resource_visibility"]
        }
        Insert: {
          category?: Database["public"]["Enums"]["resource_category"]
          created_at?: string
          description?: string | null
          file_name: string
          file_size: number
          file_type: string
          id?: string
          is_featured?: boolean
          organization_id: string
          storage_path: string
          title: string
          uploaded_by_user_id: string
          visibility?: Database["public"]["Enums"]["resource_visibility"]
        }
        Update: {
          category?: Database["public"]["Enums"]["resource_category"]
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          is_featured?: boolean
          organization_id?: string
          storage_path?: string
          title?: string
          uploaded_by_user_id?: string
          visibility?: Database["public"]["Enums"]["resource_visibility"]
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          environment: string
          id: string
          max_users: number | null
          organization_id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          price_id: string | null
          seats_purchased: number
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          environment?: string
          id?: string
          max_users?: number | null
          organization_id: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          price_id?: string | null
          seats_purchased?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          environment?: string
          id?: string
          max_users?: number | null
          organization_id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          price_id?: string | null
          seats_purchased?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
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
      create_organization_with_owner: {
        Args: {
          _kind: Database["public"]["Enums"]["org_kind"]
          _max_users: number
          _name: string
          _plan: Database["public"]["Enums"]["subscription_plan"]
          _slug: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_org_admin: { Args: { _org: string; _user: string }; Returns: boolean }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      lookup_invite_code: {
        Args: { _code: string }
        Returns: {
          organization_id: string
          organization_logo: string
          organization_name: string
          role_assigned: Database["public"]["Enums"]["org_role"]
          valid: boolean
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      org_can_write: { Args: { _org: string }; Returns: boolean }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      redeem_invite_code: { Args: { _code: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "member"
      meeting_status: "scheduled" | "completed" | "cancelled"
      mentorship_status: "pending" | "active" | "declined" | "completed"
      org_kind: "firm" | "bar_association"
      org_member_status: "active" | "invited" | "removed"
      org_role: "owner" | "admin" | "member"
      resource_category:
        | "mentorship_guide"
        | "cle"
        | "template"
        | "checklist"
        | "professional_development"
        | "meeting"
        | "other"
      resource_visibility: "organization" | "conversation" | "meeting"
      subscription_plan: "starter" | "pro" | "firm"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "grandfathered"
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
      app_role: ["admin", "member"],
      meeting_status: ["scheduled", "completed", "cancelled"],
      mentorship_status: ["pending", "active", "declined", "completed"],
      org_kind: ["firm", "bar_association"],
      org_member_status: ["active", "invited", "removed"],
      org_role: ["owner", "admin", "member"],
      resource_category: [
        "mentorship_guide",
        "cle",
        "template",
        "checklist",
        "professional_development",
        "meeting",
        "other",
      ],
      resource_visibility: ["organization", "conversation", "meeting"],
      subscription_plan: ["starter", "pro", "firm"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
        "grandfathered",
      ],
    },
  },
} as const
