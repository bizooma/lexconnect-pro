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
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      ce_assignments: {
        Row: {
          assigned_by: string
          assignee_role: Database["public"]["Enums"]["org_role"] | null
          assignee_user_id: string | null
          course_id: string
          created_at: string
          due_at: string | null
          id: string
          required: boolean
        }
        Insert: {
          assigned_by: string
          assignee_role?: Database["public"]["Enums"]["org_role"] | null
          assignee_user_id?: string | null
          course_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          required?: boolean
        }
        Update: {
          assigned_by?: string
          assignee_role?: Database["public"]["Enums"]["org_role"] | null
          assignee_user_id?: string | null
          course_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ce_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "ce_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      ce_courses: {
        Row: {
          allow_self_enroll: boolean
          cover_image_url: string | null
          created_at: string
          created_by: string
          credit_hours: number
          description: string | null
          id: string
          organization_id: string
          slug: string
          status: Database["public"]["Enums"]["ce_course_status"]
          title: string
          updated_at: string
        }
        Insert: {
          allow_self_enroll?: boolean
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          credit_hours?: number
          description?: string | null
          id?: string
          organization_id: string
          slug: string
          status?: Database["public"]["Enums"]["ce_course_status"]
          title: string
          updated_at?: string
        }
        Update: {
          allow_self_enroll?: boolean
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          credit_hours?: number
          description?: string | null
          id?: string
          organization_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["ce_course_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ce_courses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ce_enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          enrolled_at: string
          id: string
          status: Database["public"]["Enums"]["ce_enrollment_status"]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          enrolled_at?: string
          id?: string
          status?: Database["public"]["Enums"]["ce_enrollment_status"]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          enrolled_at?: string
          id?: string
          status?: Database["public"]["Enums"]["ce_enrollment_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ce_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "ce_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      ce_lesson_progress: {
        Row: {
          best_score_pct: number | null
          enrollment_id: string
          id: string
          lesson_id: string
          passed_at: string | null
          updated_at: string
          video_watched_at: string | null
        }
        Insert: {
          best_score_pct?: number | null
          enrollment_id: string
          id?: string
          lesson_id: string
          passed_at?: string | null
          updated_at?: string
          video_watched_at?: string | null
        }
        Update: {
          best_score_pct?: number | null
          enrollment_id?: string
          id?: string
          lesson_id?: string
          passed_at?: string | null
          updated_at?: string
          video_watched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ce_lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "ce_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ce_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "ce_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      ce_lessons: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          display_order: number
          duration_seconds: number | null
          has_quiz: boolean
          id: string
          required: boolean
          title: string
          updated_at: string
          youtube_url: string
          youtube_video_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          duration_seconds?: number | null
          has_quiz?: boolean
          id?: string
          required?: boolean
          title: string
          updated_at?: string
          youtube_url: string
          youtube_video_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          duration_seconds?: number | null
          has_quiz?: boolean
          id?: string
          required?: boolean
          title?: string
          updated_at?: string
          youtube_url?: string
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ce_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "ce_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      ce_quiz_attempts: {
        Row: {
          answers_json: Json
          attempt_no: number
          enrollment_id: string
          id: string
          lesson_id: string
          passed: boolean
          score_pct: number
          started_at: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          answers_json: Json
          attempt_no: number
          enrollment_id: string
          id?: string
          lesson_id: string
          passed: boolean
          score_pct: number
          started_at?: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          answers_json?: Json
          attempt_no?: number
          enrollment_id?: string
          id?: string
          lesson_id?: string
          passed?: boolean
          score_pct?: number
          started_at?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ce_quiz_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "ce_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ce_quiz_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "ce_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      ce_quiz_options: {
        Row: {
          display_order: number
          id: string
          is_correct: boolean
          label: string
          question_id: string
        }
        Insert: {
          display_order?: number
          id?: string
          is_correct?: boolean
          label: string
          question_id: string
        }
        Update: {
          display_order?: number
          id?: string
          is_correct?: boolean
          label?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ce_quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ce_quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      ce_quiz_questions: {
        Row: {
          created_at: string
          display_order: number
          explanation: string | null
          id: string
          kind: Database["public"]["Enums"]["ce_question_kind"]
          lesson_id: string
          multi_select: boolean
          prompt: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          explanation?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["ce_question_kind"]
          lesson_id: string
          multi_select?: boolean
          prompt: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          explanation?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["ce_question_kind"]
          lesson_id?: string
          multi_select?: boolean
          prompt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ce_quiz_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "ce_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      ce_quiz_settings: {
        Row: {
          lesson_id: string
          max_attempts: number | null
          passing_score_pct: number
          shuffle_questions: boolean
          updated_at: string
        }
        Insert: {
          lesson_id: string
          max_attempts?: number | null
          passing_score_pct?: number
          shuffle_questions?: boolean
          updated_at?: string
        }
        Update: {
          lesson_id?: string
          max_attempts?: number | null
          passing_score_pct?: number
          shuffle_questions?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ce_quiz_settings_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "ce_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
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
      qa_bookmarks: {
        Row: {
          created_at: string
          organization_id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "qa_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_categories: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          name: string
          organization_id: string
          slug: string
          sort_order: number
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          name: string
          organization_id: string
          slug: string
          sort_order?: number
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      qa_follows: {
        Row: {
          created_at: string
          organization_id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_follows_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "qa_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_notification_prefs: {
        Row: {
          category_ids: string[]
          mode: Database["public"]["Enums"]["qa_notif_mode"]
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_ids?: string[]
          mode?: Database["public"]["Enums"]["qa_notif_mode"]
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_ids?: string[]
          mode?: Database["public"]["Enums"]["qa_notif_mode"]
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qa_post_attachments: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          post_id: string
          resource_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          post_id: string
          resource_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          post_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_post_attachments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "qa_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_post_attachments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_posts: {
        Row: {
          allow_private_replies: boolean
          author_id: string
          best_answer_id: string | null
          body: string
          category_id: string | null
          created_at: string
          id: string
          is_anonymous: boolean
          is_pinned: boolean
          is_urgent: boolean
          last_activity_at: string
          organization_id: string
          reply_count: number
          search_tsv: unknown
          status: Database["public"]["Enums"]["qa_post_status"]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          allow_private_replies?: boolean
          author_id: string
          best_answer_id?: string | null
          body: string
          category_id?: string | null
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_pinned?: boolean
          is_urgent?: boolean
          last_activity_at?: string
          organization_id: string
          reply_count?: number
          search_tsv?: unknown
          status?: Database["public"]["Enums"]["qa_post_status"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          allow_private_replies?: boolean
          author_id?: string
          best_answer_id?: string | null
          body?: string
          category_id?: string | null
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_pinned?: boolean
          is_urgent?: boolean
          last_activity_at?: string
          organization_id?: string
          reply_count?: number
          search_tsv?: unknown
          status?: Database["public"]["Enums"]["qa_post_status"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_posts_best_answer_fk"
            columns: ["best_answer_id"]
            isOneToOne: false
            referencedRelation: "qa_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "qa_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_reactions: {
        Row: {
          created_at: string
          id: string
          kind: string
          organization_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["qa_target_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          organization_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["qa_target_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          organization_id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["qa_target_type"]
          user_id?: string
        }
        Relationships: []
      }
      qa_replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          helpful_count: number
          id: string
          is_private: boolean
          organization_id: string
          parent_reply_id: string | null
          post_id: string
          search_tsv: unknown
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          helpful_count?: number
          id?: string
          is_private?: boolean
          organization_id: string
          parent_reply_id?: string | null
          post_id: string
          search_tsv?: unknown
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          helpful_count?: number
          id?: string
          is_private?: boolean
          organization_id?: string
          parent_reply_id?: string | null
          post_id?: string
          search_tsv?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "qa_replies_parent_reply_id_fkey"
            columns: ["parent_reply_id"]
            isOneToOne: false
            referencedRelation: "qa_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "qa_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_reply_attachments: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          reply_id: string
          resource_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          reply_id: string
          resource_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          reply_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_reply_attachments_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "qa_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_reply_attachments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
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
      website_ai_generations: {
        Row: {
          created_at: string
          generated_content_json: Json
          id: string
          kind: Database["public"]["Enums"]["website_ai_generation_kind"]
          model: string | null
          organization_id: string
          prompt: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_content_json?: Json
          id?: string
          kind: Database["public"]["Enums"]["website_ai_generation_kind"]
          model?: string | null
          organization_id: string
          prompt: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          generated_content_json?: Json
          id?: string
          kind?: Database["public"]["Enums"]["website_ai_generation_kind"]
          model?: string | null
          organization_id?: string
          prompt?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      website_brand_settings: {
        Row: {
          accent_color: string | null
          body_font: string | null
          border_radius: string | null
          button_style: string | null
          contact_info: Json
          created_at: string
          favicon_url: string | null
          footer_text: string | null
          heading_font: string | null
          logo_url: string | null
          organization_id: string
          page_width: string | null
          primary_color: string | null
          secondary_color: string | null
          seo_title_suffix: string | null
          social_links: Json
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          body_font?: string | null
          border_radius?: string | null
          button_style?: string | null
          contact_info?: Json
          created_at?: string
          favicon_url?: string | null
          footer_text?: string | null
          heading_font?: string | null
          logo_url?: string | null
          organization_id: string
          page_width?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          seo_title_suffix?: string | null
          social_links?: Json
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          body_font?: string | null
          border_radius?: string | null
          button_style?: string | null
          contact_info?: Json
          created_at?: string
          favicon_url?: string | null
          footer_text?: string | null
          heading_font?: string | null
          logo_url?: string | null
          organization_id?: string
          page_width?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          seo_title_suffix?: string | null
          social_links?: Json
          updated_at?: string
        }
        Relationships: []
      }
      website_custom_domains: {
        Row: {
          created_at: string
          created_by: string | null
          default_page_slug: string | null
          domain: string
          id: string
          is_primary: boolean
          organization_id: string
          updated_at: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_page_slug?: string | null
          domain: string
          id?: string
          is_primary?: boolean
          organization_id: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_page_slug?: string | null
          domain?: string
          id?: string
          is_primary?: boolean
          organization_id?: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      website_form_submissions: {
        Row: {
          created_at: string
          data: Json
          form_kind: string
          id: string
          organization_id: string
          page_id: string | null
          referrer: string | null
          section_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          form_kind: string
          id?: string
          organization_id: string
          page_id?: string | null
          referrer?: string | null
          section_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          form_kind?: string
          id?: string
          organization_id?: string
          page_id?: string | null
          referrer?: string | null
          section_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_form_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_form_submissions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "website_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_form_submissions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "website_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      website_page_views: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          page_id: string
          referrer: string | null
          user_agent: string | null
          visitor_hash: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          page_id: string
          referrer?: string | null
          user_agent?: string | null
          visitor_hash?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          page_id?: string
          referrer?: string | null
          user_agent?: string | null
          visitor_hash?: string | null
        }
        Relationships: []
      }
      website_pages: {
        Row: {
          archived_at: string | null
          content_html: string | null
          content_json: Json
          created_at: string
          created_by: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          og_description: string | null
          og_image: string | null
          og_title: string | null
          organization_id: string
          page_type: Database["public"]["Enums"]["website_page_type"]
          published_at: string | null
          scheduled_at: string | null
          slug: string
          status: Database["public"]["Enums"]["website_page_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          content_html?: string | null
          content_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_description?: string | null
          og_image?: string | null
          og_title?: string | null
          organization_id: string
          page_type?: Database["public"]["Enums"]["website_page_type"]
          published_at?: string | null
          scheduled_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["website_page_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          content_html?: string | null
          content_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_description?: string | null
          og_image?: string | null
          og_title?: string | null
          organization_id?: string
          page_type?: Database["public"]["Enums"]["website_page_type"]
          published_at?: string | null
          scheduled_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["website_page_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      website_publish_history: {
        Row: {
          action: Database["public"]["Enums"]["website_publish_action"]
          id: string
          organization_id: string
          page_id: string
          published_at: string
          published_by: string | null
          version_snapshot_json: Json
        }
        Insert: {
          action: Database["public"]["Enums"]["website_publish_action"]
          id?: string
          organization_id: string
          page_id: string
          published_at?: string
          published_by?: string | null
          version_snapshot_json?: Json
        }
        Update: {
          action?: Database["public"]["Enums"]["website_publish_action"]
          id?: string
          organization_id?: string
          page_id?: string
          published_at?: string
          published_by?: string | null
          version_snapshot_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "website_publish_history_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "website_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      website_saved_sections: {
        Row: {
          content_json: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          section_type: Database["public"]["Enums"]["website_section_type"]
          settings_json: Json
          updated_at: string
        }
        Insert: {
          content_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          section_type: Database["public"]["Enums"]["website_section_type"]
          settings_json?: Json
          updated_at?: string
        }
        Update: {
          content_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          section_type?: Database["public"]["Enums"]["website_section_type"]
          settings_json?: Json
          updated_at?: string
        }
        Relationships: []
      }
      website_sections: {
        Row: {
          content_json: Json
          created_at: string
          display_order: number
          id: string
          organization_id: string
          page_id: string
          responsive_json: Json
          section_type: Database["public"]["Enums"]["website_section_type"]
          settings_json: Json
          updated_at: string
          visible: boolean
        }
        Insert: {
          content_json?: Json
          created_at?: string
          display_order?: number
          id?: string
          organization_id: string
          page_id: string
          responsive_json?: Json
          section_type: Database["public"]["Enums"]["website_section_type"]
          settings_json?: Json
          updated_at?: string
          visible?: boolean
        }
        Update: {
          content_json?: Json
          created_at?: string
          display_order?: number
          id?: string
          organization_id?: string
          page_id?: string
          responsive_json?: Json
          section_type?: Database["public"]["Enums"]["website_section_type"]
          settings_json?: Json
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "website_sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "website_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      website_templates: {
        Row: {
          created_at: string
          created_by: string | null
          default_sections_json: Json
          description: string | null
          id: string
          is_global: boolean
          name: string
          organization_id: string | null
          page_type: Database["public"]["Enums"]["website_page_type"]
          preview_image: string | null
          suggested_copy_json: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_sections_json?: Json
          description?: string | null
          id?: string
          is_global?: boolean
          name: string
          organization_id?: string | null
          page_type?: Database["public"]["Enums"]["website_page_type"]
          preview_image?: string | null
          suggested_copy_json?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_sections_json?: Json
          description?: string | null
          id?: string
          is_global?: boolean
          name?: string
          organization_id?: string | null
          page_type?: Database["public"]["Enums"]["website_page_type"]
          preview_image?: string | null
          suggested_copy_json?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_website: {
        Args: { _org: string; _user: string }
        Returns: boolean
      }
      ce_org_of_course: { Args: { _course_id: string }; Returns: string }
      ce_org_of_lesson: { Args: { _lesson_id: string }; Returns: string }
      ce_user_can_access_course: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
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
      email_queue_dispatch: { Args: never; Returns: undefined }
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
      ce_course_status: "draft" | "published" | "archived"
      ce_enrollment_status: "in_progress" | "completed"
      ce_question_kind: "multiple_choice" | "true_false"
      meeting_status: "scheduled" | "completed" | "cancelled"
      mentorship_status: "pending" | "active" | "declined" | "completed"
      org_kind: "firm" | "bar_association"
      org_member_status: "active" | "invited" | "removed"
      org_role: "owner" | "admin" | "member" | "content_editor"
      qa_notif_mode: "all" | "my_posts" | "followed" | "digest" | "muted"
      qa_post_status: "open" | "resolved" | "closed"
      qa_target_type: "post" | "reply"
      resource_category:
        | "mentorship_guide"
        | "cle"
        | "template"
        | "checklist"
        | "professional_development"
        | "meeting"
        | "other"
      resource_visibility: "organization" | "conversation" | "meeting" | "qa"
      subscription_plan: "starter" | "pro" | "firm"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "grandfathered"
      website_ai_generation_kind:
        | "page_draft"
        | "section_rewrite"
        | "copy_rewrite"
        | "seo"
        | "accessibility"
        | "faq"
        | "cta"
      website_page_status:
        | "draft"
        | "ready_for_review"
        | "scheduled"
        | "published"
        | "archived"
      website_page_type:
        | "home"
        | "landing"
        | "event"
        | "sponsor"
        | "committee"
        | "mentorship"
        | "cle"
        | "resource"
        | "blog"
        | "legal_aid"
        | "custom"
      website_publish_action: "publish" | "unpublish" | "schedule" | "archive"
      website_section_type:
        | "hero"
        | "text"
        | "image_text"
        | "cta"
        | "event_details"
        | "sponsor_grid"
        | "speaker_cards"
        | "member_directory"
        | "committee_cards"
        | "resource_cards"
        | "faq"
        | "testimonials"
        | "contact_form"
        | "newsletter"
        | "video"
        | "pricing_tiers"
        | "feature_grid"
        | "stats"
        | "timeline"
        | "custom_html"
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
      ce_course_status: ["draft", "published", "archived"],
      ce_enrollment_status: ["in_progress", "completed"],
      ce_question_kind: ["multiple_choice", "true_false"],
      meeting_status: ["scheduled", "completed", "cancelled"],
      mentorship_status: ["pending", "active", "declined", "completed"],
      org_kind: ["firm", "bar_association"],
      org_member_status: ["active", "invited", "removed"],
      org_role: ["owner", "admin", "member", "content_editor"],
      qa_notif_mode: ["all", "my_posts", "followed", "digest", "muted"],
      qa_post_status: ["open", "resolved", "closed"],
      qa_target_type: ["post", "reply"],
      resource_category: [
        "mentorship_guide",
        "cle",
        "template",
        "checklist",
        "professional_development",
        "meeting",
        "other",
      ],
      resource_visibility: ["organization", "conversation", "meeting", "qa"],
      subscription_plan: ["starter", "pro", "firm"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
        "grandfathered",
      ],
      website_ai_generation_kind: [
        "page_draft",
        "section_rewrite",
        "copy_rewrite",
        "seo",
        "accessibility",
        "faq",
        "cta",
      ],
      website_page_status: [
        "draft",
        "ready_for_review",
        "scheduled",
        "published",
        "archived",
      ],
      website_page_type: [
        "home",
        "landing",
        "event",
        "sponsor",
        "committee",
        "mentorship",
        "cle",
        "resource",
        "blog",
        "legal_aid",
        "custom",
      ],
      website_publish_action: ["publish", "unpublish", "schedule", "archive"],
      website_section_type: [
        "hero",
        "text",
        "image_text",
        "cta",
        "event_details",
        "sponsor_grid",
        "speaker_cards",
        "member_directory",
        "committee_cards",
        "resource_cards",
        "faq",
        "testimonials",
        "contact_form",
        "newsletter",
        "video",
        "pricing_tiers",
        "feature_grid",
        "stats",
        "timeline",
        "custom_html",
      ],
    },
  },
} as const
