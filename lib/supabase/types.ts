export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Database types for inventory project `qunnxsxeevoeflqfrzwz`.
 * Default PostgREST schema is `ads` (see lib/supabase client factories).
 * `public.user_roles` is queried explicitly via `.schema("public")`.
 *
 * Regenerate when ads is exposed in Supabase API settings:
 *   npx supabase gen types typescript --project-id qunnxsxeevoeflqfrzwz --schema ads --schema public
 */

export type Database = {
  ads: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          slug: string;
          owner_email: string;
          // Migration: alter table companies add column if not exists status text default 'setup';
          // Status values: setup | active | paused | cancelled
          status: string;
          plan: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          owner_email: string;
          status?: string;
          plan?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          owner_email?: string;
          status?: string;
          plan?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      brand_configs: {
        Row: {
          id: string;
          company_id: string;
          // Migration: alter table brand_configs alter column industry type text[]
          //   using string_to_array(industry, ',');
          industry: string[];
          target_audience: string;
          unique_selling_point: string;
          tone: string;
          brand_voice_doc: string | null;
          topics_to_cover: string[];
          topics_to_avoid: string[];
          hashtag_sets: Json;
          competitor_handles: string[];
          primary_color: string;
          secondary_color: string;
          accent_color: string;
          logo_url: string | null;
          image_style: string;
          visual_references: Json;
          active_platforms: string[];
          zernio_profile_id: string | null;
          zernio_account_ids: Json;
          post_frequency: number;
          preferred_times: Json;
          timezone: string;
          country?: string | null;
          promotional_pct: number;
          educational_pct: number;
          engagement_pct: number;
          ga_property_id: string | null;
          // Migration: alter table brand_configs add column if not exists
          //   visual_audience_profile jsonb default '{"demographic": "local", "local_pct": 100}'::jsonb;
          visual_audience_profile?: Json;
          // Migration: alter table brand_configs add column if not exists
          //   sections_confirmed jsonb default '{}';
          sections_confirmed?: Json;
          // Migration: alter table brand_configs add column if not exists
          //   notification_emails text[] default '{}';
          notification_emails?: string[];
          // Migration: 20260806120000_seed_tropical_battery_brand_bible.sql
          brand_typography?: string | null;
          brand_color_palette?: Json;
          visual_guidelines?: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          industry: string[];
          target_audience: string;
          unique_selling_point: string;
          tone: string;
          brand_voice_doc?: string | null;
          topics_to_cover?: string[];
          topics_to_avoid?: string[];
          hashtag_sets?: Json;
          competitor_handles?: string[];
          primary_color: string;
          secondary_color: string;
          accent_color: string;
          logo_url?: string | null;
          image_style: string;
          visual_references?: Json;
          active_platforms?: string[];
          zernio_profile_id?: string | null;
          zernio_account_ids?: Json;
          post_frequency: number;
          preferred_times?: Json;
          timezone: string;
          country?: string | null;
          promotional_pct: number;
          educational_pct: number;
          engagement_pct: number;
          ga_property_id?: string | null;
          visual_audience_profile?: Json;
          sections_confirmed?: Json;
          notification_emails?: string[];
          brand_typography?: string | null;
          brand_color_palette?: Json;
          visual_guidelines?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          industry?: string[];
          target_audience?: string;
          unique_selling_point?: string;
          tone?: string;
          brand_voice_doc?: string | null;
          topics_to_cover?: string[];
          topics_to_avoid?: string[];
          hashtag_sets?: Json;
          competitor_handles?: string[];
          primary_color?: string;
          secondary_color?: string;
          accent_color?: string;
          logo_url?: string | null;
          image_style?: string;
          visual_references?: Json;
          active_platforms?: string[];
          zernio_profile_id?: string | null;
          zernio_account_ids?: Json;
          post_frequency?: number;
          preferred_times?: Json;
          timezone?: string;
          country?: string | null;
          promotional_pct?: number;
          educational_pct?: number;
          engagement_pct?: number;
          ga_property_id?: string | null;
          visual_audience_profile?: Json;
          sections_confirmed?: Json;
          notification_emails?: string[];
          brand_typography?: string | null;
          brand_color_palette?: Json;
          visual_guidelines?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_configs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          id: string;
          company_id: string;
          platform: string;
          content_type: string;
          content_category: string | null;
          concept: string | null;
          caption: string | null;
          hashtags: string[];
          image_url: string | null;
          video_url: string | null;
          video_operation_id: string | null;
          branded_video_url: string | null;
          scheduled_at: string | null;
          suggested_time_tag: string | null;
          suggested_scheduled_at: string | null;
          published_at: string | null;
          zernio_post_id: string | null;
          run_id: string | null;
          gate1_status: string;
          gate2_status: string;
          gate1_reviewed_at: string | null;
          gate2_reviewed_at: string | null;
          edit_feedback: string | null;
          paperclip_job_id: string | null;
          pipeline_stage: string;
          error_message: string | null;
          visual_prompt: string | null;
          media_provider: string | null;
          media_generation_attempts: number;
          impressions: number | null;
          reach: number | null;
          engagement: number | null;
          clicks: number | null;
          analytics_pulled_at: string | null;
          featured_product_id: string | null;
          voice_over_script: string | null;
          overstock_recommendation_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          platform: string;
          content_type: string;
          content_category?: string | null;
          concept?: string | null;
          caption?: string | null;
          hashtags?: string[];
          image_url?: string | null;
          video_url?: string | null;
          video_operation_id?: string | null;
          branded_video_url?: string | null;
          scheduled_at?: string | null;
          suggested_time_tag?: string | null;
          suggested_scheduled_at?: string | null;
          published_at?: string | null;
          zernio_post_id?: string | null;
          run_id?: string | null;
          gate1_status?: string;
          gate2_status?: string;
          gate1_reviewed_at?: string | null;
          gate2_reviewed_at?: string | null;
          edit_feedback?: string | null;
          paperclip_job_id?: string | null;
          pipeline_stage?: string;
          error_message?: string | null;
          visual_prompt?: string | null;
          media_provider?: string | null;
          media_generation_attempts?: number;
          impressions?: number | null;
          reach?: number | null;
          engagement?: number | null;
          clicks?: number | null;
          analytics_pulled_at?: string | null;
          featured_product_id?: string | null;
          voice_over_script?: string | null;
          overstock_recommendation_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          platform?: string;
          content_type?: string;
          content_category?: string | null;
          concept?: string | null;
          caption?: string | null;
          hashtags?: string[];
          image_url?: string | null;
          video_url?: string | null;
          video_operation_id?: string | null;
          branded_video_url?: string | null;
          scheduled_at?: string | null;
          suggested_time_tag?: string | null;
          suggested_scheduled_at?: string | null;
          published_at?: string | null;
          zernio_post_id?: string | null;
          run_id?: string | null;
          gate1_status?: string;
          gate2_status?: string;
          gate1_reviewed_at?: string | null;
          gate2_reviewed_at?: string | null;
          edit_feedback?: string | null;
          paperclip_job_id?: string | null;
          pipeline_stage?: string;
          error_message?: string | null;
          visual_prompt?: string | null;
          media_provider?: string | null;
          media_generation_attempts?: number;
          impressions?: number | null;
          reach?: number | null;
          engagement?: number | null;
          clicks?: number | null;
          analytics_pulled_at?: string | null;
          featured_product_id?: string | null;
          voice_over_script?: string | null;
          overstock_recommendation_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_featured_product_id_fkey";
            columns: ["featured_product_id"];
            isOneToOne: false;
            referencedRelation: "product_photos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_overstock_recommendation_id_fkey";
            columns: ["overstock_recommendation_id"];
            isOneToOne: false;
            referencedRelation: "overstock_selections";
            referencedColumns: ["id"];
          },
        ];
      };
      product_photos: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          description: string | null;
          photo_url: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          description?: string | null;
          photo_url: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          description?: string | null;
          photo_url?: string;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_photos_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      holidays: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          month: number;
          day: number | null;
          week_of_month: number | null;
          day_of_week: number | null;
          country_codes: string[];
          category: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          month: number;
          day?: number | null;
          week_of_month?: number | null;
          day_of_week?: number | null;
          country_codes?: string[];
          category: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          month?: number;
          day?: number | null;
          week_of_month?: number | null;
          day_of_week?: number | null;
          country_codes?: string[];
          category?: string;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      company_holidays: {
        Row: {
          id: string;
          company_id: string;
          holiday_id: string;
          enabled: boolean;
          custom_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          holiday_id: string;
          enabled?: boolean;
          custom_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          holiday_id?: string;
          enabled?: boolean;
          custom_name?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_holidays_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_holidays_holiday_id_fkey";
            columns: ["holiday_id"];
            isOneToOne: false;
            referencedRelation: "holidays";
            referencedColumns: ["id"];
          },
        ];
      };
      cycles: {
        Row: {
          id: string;
          company_id: string;
          week_start: string;
          status: string;
          concepts_generated: number;
          concepts_approved: number;
          posts_published: number;
          api_cost_usd: number;
          triggered_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          week_start: string;
          status?: string;
          concepts_generated?: number;
          concepts_approved?: number;
          posts_published?: number;
          api_cost_usd?: number;
          triggered_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          week_start?: string;
          status?: string;
          concepts_generated?: number;
          concepts_approved?: number;
          posts_published?: number;
          api_cost_usd?: number;
          triggered_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cycles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          id: string;
          email: string;
          role: "admin" | "client";
          company_id: string | null;
          full_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role?: "admin" | "client";
          company_id?: string | null;
          full_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: "admin" | "client";
          company_id?: string | null;
          full_name?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          company_id: string;
          type: string;
          channel: string;
          sent_at: string;
          payload: Json;
        };
        Insert: {
          id?: string;
          company_id: string;
          type: string;
          channel: string;
          sent_at?: string;
          payload?: Json;
        };
        Update: {
          id?: string;
          company_id?: string;
          type?: string;
          channel?: string;
          sent_at?: string;
          payload?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      content_runs: {
        Row: {
          id: string;
          company_id: string;
          week_start: string;
          status: string;
          trend_brief: Json | null;
          locked_at: string | null;
          locked_by: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          week_start: string;
          status?: string;
          trend_brief?: Json | null;
          locked_at?: string | null;
          locked_by?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          week_start?: string;
          status?: string;
          trend_brief?: Json | null;
          locked_at?: string | null;
          locked_by?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_runs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      run_steps: {
        Row: {
          id: string;
          run_id: string;
          step_name: string;
          status: string;
          attempt_count: number;
          input_json: Json | null;
          output_json: Json | null;
          error_message: string | null;
          cost_usd: number;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          step_name: string;
          status?: string;
          attempt_count?: number;
          input_json?: Json | null;
          output_json?: Json | null;
          error_message?: string | null;
          cost_usd?: number;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          step_name?: string;
          status?: string;
          attempt_count?: number;
          input_json?: Json | null;
          output_json?: Json | null;
          error_message?: string | null;
          cost_usd?: number;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "run_steps_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "content_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      cost_events: {
        Row: {
          id: string;
          company_id: string;
          run_id: string | null;
          post_id: string | null;
          provider: string;
          model: string | null;
          step_name: string;
          estimated_cost_usd: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          run_id?: string | null;
          post_id?: string | null;
          provider: string;
          model?: string | null;
          step_name: string;
          estimated_cost_usd?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          run_id?: string | null;
          post_id?: string | null;
          provider?: string;
          model?: string | null;
          step_name?: string;
          estimated_cost_usd?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cost_events_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cost_events_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "content_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cost_events_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      rejection_feedback: {
        Row: {
          id: string;
          company_id: string;
          post_id: string;
          gate: string;
          reasons: string[];
          free_text: string | null;
          concept_snapshot: string | null;
          caption_snapshot: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          post_id: string;
          gate: string;
          reasons?: string[];
          free_text?: string | null;
          concept_snapshot?: string | null;
          caption_snapshot?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          post_id?: string;
          gate?: string;
          reasons?: string[];
          free_text?: string | null;
          concept_snapshot?: string | null;
          caption_snapshot?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rejection_feedback_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rejection_feedback_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_settings: {
        Row: {
          id: string;
          key: string;
          value: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      overstock_selections: {
        Row: {
          id: string;
          company_id: string;
          skus: string[];
          post_count: number;
          status: string;
          created_at: string;
          created_by_email: string | null;
          consumed_at: string | null;
          consumed_by_run_id: string | null;
          opportunity_score: number | null;
          score_breakdown: Record<string, number> | null;
          rank: number | null;
          product_group: string | null;
          selection_reason: string | null;
          eligibility_status: string | null;
          inventory_snapshot: Record<string, unknown> | null;
          source_type: string;
          analysis_generated_at: string | null;
          ai_review: Record<string, unknown> | null;
          source_recommendation_id: string | null;
          campaign_strategy: Record<string, unknown> | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          skus: string[];
          post_count: number;
          status?: string;
          created_at?: string;
          created_by_email?: string | null;
          consumed_at?: string | null;
          consumed_by_run_id?: string | null;
          opportunity_score?: number | null;
          score_breakdown?: Record<string, number> | null;
          rank?: number | null;
          product_group?: string | null;
          selection_reason?: string | null;
          eligibility_status?: string | null;
          inventory_snapshot?: Record<string, unknown> | null;
          source_type?: string;
          analysis_generated_at?: string | null;
          ai_review?: Record<string, unknown> | null;
          source_recommendation_id?: string | null;
          campaign_strategy?: Record<string, unknown> | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          skus?: string[];
          post_count?: number;
          status?: string;
          created_at?: string;
          created_by_email?: string | null;
          consumed_at?: string | null;
          consumed_by_run_id?: string | null;
          opportunity_score?: number | null;
          score_breakdown?: Record<string, number> | null;
          rank?: number | null;
          product_group?: string | null;
          selection_reason?: string | null;
          eligibility_status?: string | null;
          inventory_snapshot?: Record<string, unknown> | null;
          source_type?: string;
          analysis_generated_at?: string | null;
          ai_review?: Record<string, unknown> | null;
          source_recommendation_id?: string | null;
          campaign_strategy?: Record<string, unknown> | null;
        };
        Relationships: [
          {
            foreignKeyName: "overstock_selections_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "overstock_selections_consumed_by_run_id_fkey";
            columns: ["consumed_by_run_id"];
            isOneToOne: false;
            referencedRelation: "content_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "overstock_selections_source_recommendation_id_fkey";
            columns: ["source_recommendation_id"];
            isOneToOne: false;
            referencedRelation: "overstock_selections";
            referencedColumns: ["id"];
          },
        ];
      };
      promotions: {
        Row: {
          id: string;
          company_id: string;
          title: string;
          description: string | null;
          discount_type:
            | "percentage"
            | "fixed"
            | "bogo"
            | "free_item"
            | "other"
            | null;
          discount_value: string | null;
          promo_code: string | null;
          start_date: string;
          end_date: string;
          platforms: string[];
          status: "active" | "scheduled" | "expired";
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          title: string;
          description?: string | null;
          discount_type?:
            | "percentage"
            | "fixed"
            | "bogo"
            | "free_item"
            | "other"
            | null;
          discount_value?: string | null;
          promo_code?: string | null;
          start_date: string;
          end_date: string;
          platforms?: string[];
          status?: "active" | "scheduled" | "expired";
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          title?: string;
          description?: string | null;
          discount_type?:
            | "percentage"
            | "fixed"
            | "bogo"
            | "free_item"
            | "other"
            | null;
          discount_value?: string | null;
          promo_code?: string | null;
          start_date?: string;
          end_date?: string;
          platforms?: string[];
          status?: "active" | "scheduled" | "expired";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promotions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
  public: {
    Tables: {
      user_roles: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          email: string;
          role: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          email?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          tenant_id: string;
          sku: string | null;
          name: string | null;
          external_id: string;
          item_class: string | null;
        };
        Insert: {
          tenant_id: string;
          sku?: string | null;
          name?: string | null;
          external_id: string;
          item_class?: string | null;
        };
        Update: {
          tenant_id?: string;
          sku?: string | null;
          name?: string | null;
          external_id?: string;
          item_class?: string | null;
        };
        Relationships: [];
      };
      item_costing: {
        Row: {
          tenant_id: string;
          sku: string | null;
          product_external_id: string | null;
          annual_demand_units: number | null;
          avg_daily_demand_units: number | null;
          current_cost_local: number | null;
          source_updated_at: string | null;
        };
        Insert: {
          tenant_id: string;
          sku?: string | null;
          product_external_id?: string | null;
          annual_demand_units?: number | null;
          avg_daily_demand_units?: number | null;
          current_cost_local?: number | null;
          source_updated_at?: string | null;
        };
        Update: {
          tenant_id?: string;
          sku?: string | null;
          product_external_id?: string | null;
          annual_demand_units?: number | null;
          avg_daily_demand_units?: number | null;
          current_cost_local?: number | null;
          source_updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      vw_overstock: {
        Row: {
          tenant_id: string;
          sku: string;
          product_name: string | null;
          quantity_available: number | null;
          stock_position: number | null;
          avg_monthly_demand: number | null;
          months_of_cover: number | null;
          excess_units: number | null;
          excess_value_local: number | null;
        };
        Relationships: [];
      };
      mv_inventory_aggregates_by_sku: {
        Row: {
          tenant_id: string;
          sku: string | null;
          quantity_on_hand: number | null;
          quantity_available: number | null;
          quantity_in_transit: number | null;
          quantity_in_bond: number | null;
          quantity_at_port: number | null;
          quantity_in_clearing: number | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type UserRoleRow = Database["public"]["Tables"]["user_roles"]["Row"];
export type OverstockSelection =
  Database["ads"]["Tables"]["overstock_selections"]["Row"];

export type UserProfile = Database["ads"]["Tables"]["users"]["Row"];
export type Company = Database["ads"]["Tables"]["companies"]["Row"];
export type BrandConfig = Database["ads"]["Tables"]["brand_configs"]["Row"];
export type Post = Database["ads"]["Tables"]["posts"]["Row"];
export type Cycle = Database["ads"]["Tables"]["cycles"]["Row"];
export type Notification =
  Database["ads"]["Tables"]["notifications"]["Row"];
export type ContentRun =
  Database["ads"]["Tables"]["content_runs"]["Row"];
export type RunStep = Database["ads"]["Tables"]["run_steps"]["Row"];
export type CostEvent = Database["ads"]["Tables"]["cost_events"]["Row"];
export type RejectionFeedback =
  Database["ads"]["Tables"]["rejection_feedback"]["Row"];
export type Promotion = Database["ads"]["Tables"]["promotions"]["Row"];
export type ProductPhoto = Database["ads"]["Tables"]["product_photos"]["Row"];
export type Holiday = Database["ads"]["Tables"]["holidays"]["Row"];
export type CompanyHoliday =
  Database["ads"]["Tables"]["company_holidays"]["Row"];

export type UserProfileInsert =
  Database["ads"]["Tables"]["users"]["Insert"];
export type CompanyInsert =
  Database["ads"]["Tables"]["companies"]["Insert"];
export type BrandConfigInsert =
  Database["ads"]["Tables"]["brand_configs"]["Insert"];
export type PostInsert = Database["ads"]["Tables"]["posts"]["Insert"];
export type CycleInsert = Database["ads"]["Tables"]["cycles"]["Insert"];
export type NotificationInsert =
  Database["ads"]["Tables"]["notifications"]["Insert"];
export type ContentRunInsert =
  Database["ads"]["Tables"]["content_runs"]["Insert"];
export type RunStepInsert =
  Database["ads"]["Tables"]["run_steps"]["Insert"];
export type CostEventInsert =
  Database["ads"]["Tables"]["cost_events"]["Insert"];
export type RejectionFeedbackInsert =
  Database["ads"]["Tables"]["rejection_feedback"]["Insert"];

export type UserProfileUpdate =
  Database["ads"]["Tables"]["users"]["Update"];
export type CompanyUpdate =
  Database["ads"]["Tables"]["companies"]["Update"];
export type BrandConfigUpdate =
  Database["ads"]["Tables"]["brand_configs"]["Update"];
export type PostUpdate = Database["ads"]["Tables"]["posts"]["Update"];
export type CycleUpdate = Database["ads"]["Tables"]["cycles"]["Update"];
export type NotificationUpdate =
  Database["ads"]["Tables"]["notifications"]["Update"];
export type ContentRunUpdate =
  Database["ads"]["Tables"]["content_runs"]["Update"];
export type RunStepUpdate =
  Database["ads"]["Tables"]["run_steps"]["Update"];
export type CostEventUpdate =
  Database["ads"]["Tables"]["cost_events"]["Update"];
export type RejectionFeedbackUpdate =
  Database["ads"]["Tables"]["rejection_feedback"]["Update"];
