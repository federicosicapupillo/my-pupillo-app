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
      account_deletion_feedback: {
        Row: {
          created_at: string
          custom_reason: string | null
          id: string
          profile_id: string | null
          reason: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          custom_reason?: string | null
          id?: string
          profile_id?: string | null
          reason?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          custom_reason?: string | null
          id?: string
          profile_id?: string | null
          reason?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          assigned_worker_id: string | null
          beard_allowed: string | null
          cancellation_note: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          deposit_paid: boolean | null
          dress_code_items: string[] | null
          dress_code_notes: string | null
          duration_hours: number
          end_date: string | null
          end_time: string | null
          expires_at: string
          id: string
          is_demo: boolean
          is_long_shift: boolean
          job_access_restrictions: string | null
          job_additional_directions: string | null
          job_address: string | null
          job_city: string | null
          job_contact_person_email: string | null
          job_contact_person_name: string | null
          job_contact_person_phone: string | null
          job_country: string | null
          job_latitude: number | null
          job_location_notes: string | null
          job_longitude: number | null
          job_postal_code: string | null
          job_province: string | null
          language_requirements: string[] | null
          languages: string[] | null
          license_requirement: string | null
          location_address: string
          location_lat: number | null
          location_lng: number | null
          long_shift_reason: string | null
          notes: string | null
          piercings_allowed: string | null
          professional_profile: string | null
          reopened_after_worker_cancellation: boolean
          reopened_at: string | null
          required_skills: string[] | null
          restaurant_id: string
          reused_from_announcement_id: string | null
          seed_batch_id: string | null
          service_date: string
          service_time: string
          shift_duration_hours: number | null
          speed: Database["public"]["Enums"]["service_speed"]
          status: Database["public"]["Enums"]["announcement_status"]
          tariff_amount: number
          tariff_type: Database["public"]["Enums"]["tariff_type"]
          tattoos_allowed: string | null
        }
        Insert: {
          assigned_worker_id?: string | null
          beard_allowed?: string | null
          cancellation_note?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          deposit_paid?: boolean | null
          dress_code_items?: string[] | null
          dress_code_notes?: string | null
          duration_hours?: number
          end_date?: string | null
          end_time?: string | null
          expires_at?: string
          id?: string
          is_demo?: boolean
          is_long_shift?: boolean
          job_access_restrictions?: string | null
          job_additional_directions?: string | null
          job_address?: string | null
          job_city?: string | null
          job_contact_person_email?: string | null
          job_contact_person_name?: string | null
          job_contact_person_phone?: string | null
          job_country?: string | null
          job_latitude?: number | null
          job_location_notes?: string | null
          job_longitude?: number | null
          job_postal_code?: string | null
          job_province?: string | null
          language_requirements?: string[] | null
          languages?: string[] | null
          license_requirement?: string | null
          location_address: string
          location_lat?: number | null
          location_lng?: number | null
          long_shift_reason?: string | null
          notes?: string | null
          piercings_allowed?: string | null
          professional_profile?: string | null
          reopened_after_worker_cancellation?: boolean
          reopened_at?: string | null
          required_skills?: string[] | null
          restaurant_id: string
          reused_from_announcement_id?: string | null
          seed_batch_id?: string | null
          service_date: string
          service_time: string
          shift_duration_hours?: number | null
          speed?: Database["public"]["Enums"]["service_speed"]
          status?: Database["public"]["Enums"]["announcement_status"]
          tariff_amount: number
          tariff_type?: Database["public"]["Enums"]["tariff_type"]
          tattoos_allowed?: string | null
        }
        Update: {
          assigned_worker_id?: string | null
          beard_allowed?: string | null
          cancellation_note?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          deposit_paid?: boolean | null
          dress_code_items?: string[] | null
          dress_code_notes?: string | null
          duration_hours?: number
          end_date?: string | null
          end_time?: string | null
          expires_at?: string
          id?: string
          is_demo?: boolean
          is_long_shift?: boolean
          job_access_restrictions?: string | null
          job_additional_directions?: string | null
          job_address?: string | null
          job_city?: string | null
          job_contact_person_email?: string | null
          job_contact_person_name?: string | null
          job_contact_person_phone?: string | null
          job_country?: string | null
          job_latitude?: number | null
          job_location_notes?: string | null
          job_longitude?: number | null
          job_postal_code?: string | null
          job_province?: string | null
          language_requirements?: string[] | null
          languages?: string[] | null
          license_requirement?: string | null
          location_address?: string
          location_lat?: number | null
          location_lng?: number | null
          long_shift_reason?: string | null
          notes?: string | null
          piercings_allowed?: string | null
          professional_profile?: string | null
          reopened_after_worker_cancellation?: boolean
          reopened_at?: string | null
          required_skills?: string[] | null
          restaurant_id?: string
          reused_from_announcement_id?: string | null
          seed_batch_id?: string | null
          service_date?: string
          service_time?: string
          shift_duration_hours?: number | null
          speed?: Database["public"]["Enums"]["service_speed"]
          status?: Database["public"]["Enums"]["announcement_status"]
          tariff_amount?: number
          tariff_type?: Database["public"]["Enums"]["tariff_type"]
          tattoos_allowed?: string | null
        }
        Relationships: []
      }
      applications: {
        Row: {
          announcement_id: string
          binding_offer: boolean | null
          created_at: string
          id: string
          is_demo: boolean
          last_message_at: string | null
          last_message_preview: string | null
          proposed_tariff: number | null
          response_deadline: string
          restaurant_id: string
          seed_batch_id: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          worker_id: string
          worker_response_at: string | null
        }
        Insert: {
          announcement_id: string
          binding_offer?: boolean | null
          created_at?: string
          id?: string
          is_demo?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          proposed_tariff?: number | null
          response_deadline?: string
          restaurant_id: string
          seed_batch_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          worker_id: string
          worker_response_at?: string | null
        }
        Update: {
          announcement_id?: string
          binding_offer?: boolean | null
          created_at?: string
          id?: string
          is_demo?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          proposed_tariff?: number | null
          response_deadline?: string
          restaurant_id?: string
          seed_batch_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          worker_id?: string
          worker_response_at?: string | null
        }
        Relationships: []
      }
      backup_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          database_backup_status: string | null
          error_message: string | null
          file_url: string | null
          github_backup_status: string | null
          github_commit_url: string | null
          id: string
          metadata: Json
          started_at: string | null
          status: string
          storage_backup_status: string | null
          triggered_by: string | null
          type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          database_backup_status?: string | null
          error_message?: string | null
          file_url?: string | null
          github_backup_status?: string | null
          github_commit_url?: string | null
          id?: string
          metadata?: Json
          started_at?: string | null
          status?: string
          storage_backup_status?: string | null
          triggered_by?: string | null
          type?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          database_backup_status?: string | null
          error_message?: string | null
          file_url?: string | null
          github_backup_status?: string | null
          github_commit_url?: string | null
          id?: string
          metadata?: Json
          started_at?: string | null
          status?: string
          storage_backup_status?: string | null
          triggered_by?: string | null
          type?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          balance_after: number
          created_at: string
          delta: number
          id: string
          kind: Database["public"]["Enums"]["credit_tx_kind"]
          metadata: Json | null
          reason: string | null
          reference_id: string | null
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          delta: number
          id?: string
          kind: Database["public"]["Enums"]["credit_tx_kind"]
          metadata?: Json | null
          reason?: string | null
          reference_id?: string | null
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          delta?: number
          id?: string
          kind?: Database["public"]["Enums"]["credit_tx_kind"]
          metadata?: Json | null
          reason?: string | null
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          applies_to: Database["public"]["Enums"]["discount_applies_to"]
          code: string
          created_at: string
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          updated_at: string
          used_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["discount_applies_to"]
          code: string
          created_at?: string
          description?: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["discount_applies_to"]
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      discount_redemptions: {
        Row: {
          discount_amount: number | null
          discount_code_id: string
          id: string
          order_id: string | null
          used_at: string
          user_id: string
        }
        Insert: {
          discount_amount?: number | null
          discount_code_id: string
          id?: string
          order_id?: string | null
          used_at?: string
          user_id: string
        }
        Update: {
          discount_amount?: number | null
          discount_code_id?: string
          id?: string
          order_id?: string | null
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_redemptions_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          announcement_id: string
          created_at: string
          id: string
          is_demo: boolean
          seed_batch_id: string | null
          user_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          id?: string
          is_demo?: boolean
          seed_batch_id?: string | null
          user_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          seed_batch_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      job_requests: {
        Row: {
          access_restrictions: string | null
          additional_directions: string | null
          address: string
          announcement_id: string | null
          beard_allowed: string | null
          break_included: boolean
          city: string | null
          contact_person_email: string | null
          contact_person_name: string | null
          contact_person_phone: string | null
          contact_person_role: string | null
          contact_person_role_other: string | null
          country: string | null
          created_at: string
          description: string | null
          district: string | null
          dress_code_items: string[]
          dress_code_notes: string | null
          end_date: string | null
          end_time: string
          hourly_rate: number
          id: string
          is_demo: boolean
          is_long_shift: boolean
          language_requirements: string[]
          latitude: number | null
          license_requirement: string | null
          long_shift_reason: string | null
          longitude: number | null
          operational_notes: string | null
          piercings_allowed: string | null
          postal_code: string | null
          province: string | null
          required_skills: string[]
          restaurant_id: string
          restaurant_name: string | null
          restaurant_profile_id: string
          role_required: string
          seed_batch_id: string | null
          shift_date: string
          shift_duration_hours: number | null
          start_time: string
          status: string
          tasks: string | null
          tattoos_allowed: string | null
          title: string
          updated_at: string
          user_id: string
          worker_notes: string | null
          workers_needed: number
        }
        Insert: {
          access_restrictions?: string | null
          additional_directions?: string | null
          address: string
          announcement_id?: string | null
          beard_allowed?: string | null
          break_included?: boolean
          city?: string | null
          contact_person_email?: string | null
          contact_person_name?: string | null
          contact_person_phone?: string | null
          contact_person_role?: string | null
          contact_person_role_other?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          district?: string | null
          dress_code_items?: string[]
          dress_code_notes?: string | null
          end_date?: string | null
          end_time: string
          hourly_rate: number
          id?: string
          is_demo?: boolean
          is_long_shift?: boolean
          language_requirements?: string[]
          latitude?: number | null
          license_requirement?: string | null
          long_shift_reason?: string | null
          longitude?: number | null
          operational_notes?: string | null
          piercings_allowed?: string | null
          postal_code?: string | null
          province?: string | null
          required_skills?: string[]
          restaurant_id: string
          restaurant_name?: string | null
          restaurant_profile_id: string
          role_required: string
          seed_batch_id?: string | null
          shift_date: string
          shift_duration_hours?: number | null
          start_time: string
          status?: string
          tasks?: string | null
          tattoos_allowed?: string | null
          title: string
          updated_at?: string
          user_id: string
          worker_notes?: string | null
          workers_needed?: number
        }
        Update: {
          access_restrictions?: string | null
          additional_directions?: string | null
          address?: string
          announcement_id?: string | null
          beard_allowed?: string | null
          break_included?: boolean
          city?: string | null
          contact_person_email?: string | null
          contact_person_name?: string | null
          contact_person_phone?: string | null
          contact_person_role?: string | null
          contact_person_role_other?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          district?: string | null
          dress_code_items?: string[]
          dress_code_notes?: string | null
          end_date?: string | null
          end_time?: string
          hourly_rate?: number
          id?: string
          is_demo?: boolean
          is_long_shift?: boolean
          language_requirements?: string[]
          latitude?: number | null
          license_requirement?: string | null
          long_shift_reason?: string | null
          longitude?: number | null
          operational_notes?: string | null
          piercings_allowed?: string | null
          postal_code?: string | null
          province?: string | null
          required_skills?: string[]
          restaurant_id?: string
          restaurant_name?: string | null
          restaurant_profile_id?: string
          role_required?: string
          seed_batch_id?: string | null
          shift_date?: string
          shift_duration_hours?: number | null
          start_time?: string
          status?: string
          tasks?: string | null
          tattoos_allowed?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          worker_notes?: string | null
          workers_needed?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_requests_restaurant_profile_id_fkey"
            columns: ["restaurant_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          action_type: string | null
          application_id: string
          body: string
          created_at: string
          id: string
          is_demo: boolean
          message_type: string
          read_at: string | null
          receiver_id: string | null
          seed_batch_id: string | null
          sender_id: string
          template_id: string | null
        }
        Insert: {
          action_type?: string | null
          application_id: string
          body: string
          created_at?: string
          id?: string
          is_demo?: boolean
          message_type?: string
          read_at?: string | null
          receiver_id?: string | null
          seed_batch_id?: string | null
          sender_id: string
          template_id?: string | null
        }
        Update: {
          action_type?: string | null
          application_id?: string
          body?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          message_type?: string
          read_at?: string | null
          receiver_id?: string | null
          seed_batch_id?: string | null
          sender_id?: string
          template_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_demo: boolean
          link: string | null
          metadata: Json | null
          read: boolean | null
          read_at: string | null
          seed_batch_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          link?: string | null
          metadata?: Json | null
          read?: boolean | null
          read_at?: string | null
          seed_batch_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          link?: string | null
          metadata?: Json | null
          read?: boolean | null
          read_at?: string | null
          seed_batch_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      phone_verifications: {
        Row: {
          attempts_count: number
          created_at: string
          expires_at: string
          id: string
          otp_code_hash: string
          phone_full: string
          status: Database["public"]["Enums"]["phone_verification_status"]
          user_id: string
          verified_at: string | null
        }
        Insert: {
          attempts_count?: number
          created_at?: string
          expires_at: string
          id?: string
          otp_code_hash: string
          phone_full: string
          status?: Database["public"]["Enums"]["phone_verification_status"]
          user_id: string
          verified_at?: string | null
        }
        Update: {
          attempts_count?: number
          created_at?: string
          expires_at?: string
          id?: string
          otp_code_hash?: string
          phone_full?: string
          status?: Database["public"]["Enums"]["phone_verification_status"]
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_restrictions: string | null
          account_status: Database["public"]["Enums"]["account_status"] | null
          additional_directions: string | null
          address: string | null
          age: number | null
          age_verified: boolean
          age_verified_at: string | null
          all_zones: boolean
          available_now_until: string | null
          avatar_url: string | null
          avg_competence: number
          avg_professionalism: number
          avg_punctuality: number
          avg_reliability: number
          avg_response_minutes: number | null
          avg_teamwork: number
          badge: Database["public"]["Enums"]["worker_badge"] | null
          birth_date: string | null
          birth_place: string | null
          business_name: string | null
          business_status: string | null
          busy_days: string[] | null
          cancellation_count: number
          city: string | null
          city_code: string | null
          clean_shifts_after_penalty: number
          company_tax_code: string | null
          completed_shifts: number | null
          completion_pct: number
          contact_person_email: string | null
          contact_person_first_name: string | null
          contact_person_last_name: string | null
          contact_person_phone: string | null
          contact_person_role: string | null
          contact_person_role_other: string | null
          country: string | null
          created_at: string
          credits: number | null
          default_arrival_advance_minutes: number | null
          default_arrival_advance_reason: string | null
          default_beard_allowed: string | null
          default_contact_person_name: string | null
          default_dress_code_items: string[] | null
          default_dress_code_notes: string | null
          default_language_requirements: string[] | null
          default_license_requirement: string | null
          default_piercings_allowed: string | null
          default_required_skills: string[] | null
          default_settings_updated_at: string | null
          default_tattoos_allowed: string | null
          delay_count: number
          deleted_at: string | null
          deletion_reason: string | null
          distinct_restaurants_count: number
          email: string | null
          email_summary_sent_at: string | null
          email_summary_status: string | null
          employees_count: number | null
          experience_level:
            | Database["public"]["Enums"]["experience_level"]
            | null
          experience_years: number | null
          first_name: string | null
          full_name: string | null
          hourly_availability: string | null
          hourly_rate: number | null
          id: string
          id_document_back_path: string | null
          id_document_expires_at: string | null
          id_document_issued_at: string | null
          id_document_issuer: string | null
          id_document_number: string | null
          id_document_path: string | null
          id_document_type: string | null
          is_deleted: boolean
          is_demo: boolean
          is_motorized: boolean | null
          languages: string[] | null
          last_active_at: string | null
          last_name: string | null
          last_review_at: string | null
          last_review_reminder_at: string | null
          late_cancel_count: number
          latitude: number | null
          location_notes: string | null
          longitude: number | null
          nationality: string | null
          neighborhood: string | null
          no_show_count: number
          no_shows: number | null
          opening_hours: string | null
          overdue_reviews_count: number
          pec_email: string | null
          phone: string | null
          phone_country_code: string | null
          phone_full: string | null
          phone_number: string | null
          phone_verified: boolean
          phone_verified_at: string | null
          plan: Database["public"]["Enums"]["user_plan"] | null
          postal_code: string | null
          price_range: string | null
          primary_role: string | null
          professional_profile: string | null
          profile_completed: boolean | null
          province: string | null
          province_code: string | null
          punctuality_pct: number
          rating_avg: number | null
          referral_code: string | null
          referral_credits_earned: number
          referred_by_user_id: string | null
          registered_office_address: string | null
          registered_office_city: string | null
          registered_office_postal_code: string | null
          registered_office_province: string | null
          rehire_restaurants_count: number
          rehire_total_answers: number
          rehire_yes_count: number
          reliability_pct: number | null
          representative_age: number | null
          reputation_level: string
          reputation_score: number
          reputation_updated_at: string | null
          residence_address: string | null
          residence_city: string | null
          residence_number: string | null
          residence_postal_code: string | null
          residence_province: string | null
          residence_street: string | null
          review_blocked: boolean
          review_blocked_at: string | null
          reviews_count: number | null
          sdi_code: string | null
          search_penalty_active: boolean
          search_penalty_reason: string | null
          search_penalty_started_at: string | null
          search_penalty_until: string | null
          secondary_roles: string[] | null
          seed_batch_id: string | null
          selected_zones: string[]
          service_area_city: string | null
          service_area_district: string | null
          service_area_lat: number | null
          service_area_lng: number | null
          service_area_radius_m: number | null
          short_bio: string | null
          spoken_languages: Json
          street: string | null
          street_number: string | null
          stripe_customer_id: string | null
          tax_code: string | null
          terms_accepted: boolean | null
          updated_at: string
          vat_company_name: string | null
          vat_number: string | null
          vat_status: Database["public"]["Enums"]["vat_status"] | null
          vat_verified_at: string | null
          venue_type: string | null
          venue_type_other: string | null
          weekly_availability: string[] | null
          whatsapp_confirmation_sent_at: string | null
          whatsapp_confirmation_status: string | null
          whatsapp_connected: boolean | null
          work_area_mode: string | null
        }
        Insert: {
          access_restrictions?: string | null
          account_status?: Database["public"]["Enums"]["account_status"] | null
          additional_directions?: string | null
          address?: string | null
          age?: number | null
          age_verified?: boolean
          age_verified_at?: string | null
          all_zones?: boolean
          available_now_until?: string | null
          avatar_url?: string | null
          avg_competence?: number
          avg_professionalism?: number
          avg_punctuality?: number
          avg_reliability?: number
          avg_response_minutes?: number | null
          avg_teamwork?: number
          badge?: Database["public"]["Enums"]["worker_badge"] | null
          birth_date?: string | null
          birth_place?: string | null
          business_name?: string | null
          business_status?: string | null
          busy_days?: string[] | null
          cancellation_count?: number
          city?: string | null
          city_code?: string | null
          clean_shifts_after_penalty?: number
          company_tax_code?: string | null
          completed_shifts?: number | null
          completion_pct?: number
          contact_person_email?: string | null
          contact_person_first_name?: string | null
          contact_person_last_name?: string | null
          contact_person_phone?: string | null
          contact_person_role?: string | null
          contact_person_role_other?: string | null
          country?: string | null
          created_at?: string
          credits?: number | null
          default_arrival_advance_minutes?: number | null
          default_arrival_advance_reason?: string | null
          default_beard_allowed?: string | null
          default_contact_person_name?: string | null
          default_dress_code_items?: string[] | null
          default_dress_code_notes?: string | null
          default_language_requirements?: string[] | null
          default_license_requirement?: string | null
          default_piercings_allowed?: string | null
          default_required_skills?: string[] | null
          default_settings_updated_at?: string | null
          default_tattoos_allowed?: string | null
          delay_count?: number
          deleted_at?: string | null
          deletion_reason?: string | null
          distinct_restaurants_count?: number
          email?: string | null
          email_summary_sent_at?: string | null
          email_summary_status?: string | null
          employees_count?: number | null
          experience_level?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          experience_years?: number | null
          first_name?: string | null
          full_name?: string | null
          hourly_availability?: string | null
          hourly_rate?: number | null
          id: string
          id_document_back_path?: string | null
          id_document_expires_at?: string | null
          id_document_issued_at?: string | null
          id_document_issuer?: string | null
          id_document_number?: string | null
          id_document_path?: string | null
          id_document_type?: string | null
          is_deleted?: boolean
          is_demo?: boolean
          is_motorized?: boolean | null
          languages?: string[] | null
          last_active_at?: string | null
          last_name?: string | null
          last_review_at?: string | null
          last_review_reminder_at?: string | null
          late_cancel_count?: number
          latitude?: number | null
          location_notes?: string | null
          longitude?: number | null
          nationality?: string | null
          neighborhood?: string | null
          no_show_count?: number
          no_shows?: number | null
          opening_hours?: string | null
          overdue_reviews_count?: number
          pec_email?: string | null
          phone?: string | null
          phone_country_code?: string | null
          phone_full?: string | null
          phone_number?: string | null
          phone_verified?: boolean
          phone_verified_at?: string | null
          plan?: Database["public"]["Enums"]["user_plan"] | null
          postal_code?: string | null
          price_range?: string | null
          primary_role?: string | null
          professional_profile?: string | null
          profile_completed?: boolean | null
          province?: string | null
          province_code?: string | null
          punctuality_pct?: number
          rating_avg?: number | null
          referral_code?: string | null
          referral_credits_earned?: number
          referred_by_user_id?: string | null
          registered_office_address?: string | null
          registered_office_city?: string | null
          registered_office_postal_code?: string | null
          registered_office_province?: string | null
          rehire_restaurants_count?: number
          rehire_total_answers?: number
          rehire_yes_count?: number
          reliability_pct?: number | null
          representative_age?: number | null
          reputation_level?: string
          reputation_score?: number
          reputation_updated_at?: string | null
          residence_address?: string | null
          residence_city?: string | null
          residence_number?: string | null
          residence_postal_code?: string | null
          residence_province?: string | null
          residence_street?: string | null
          review_blocked?: boolean
          review_blocked_at?: string | null
          reviews_count?: number | null
          sdi_code?: string | null
          search_penalty_active?: boolean
          search_penalty_reason?: string | null
          search_penalty_started_at?: string | null
          search_penalty_until?: string | null
          secondary_roles?: string[] | null
          seed_batch_id?: string | null
          selected_zones?: string[]
          service_area_city?: string | null
          service_area_district?: string | null
          service_area_lat?: number | null
          service_area_lng?: number | null
          service_area_radius_m?: number | null
          short_bio?: string | null
          spoken_languages?: Json
          street?: string | null
          street_number?: string | null
          stripe_customer_id?: string | null
          tax_code?: string | null
          terms_accepted?: boolean | null
          updated_at?: string
          vat_company_name?: string | null
          vat_number?: string | null
          vat_status?: Database["public"]["Enums"]["vat_status"] | null
          vat_verified_at?: string | null
          venue_type?: string | null
          venue_type_other?: string | null
          weekly_availability?: string[] | null
          whatsapp_confirmation_sent_at?: string | null
          whatsapp_confirmation_status?: string | null
          whatsapp_connected?: boolean | null
          work_area_mode?: string | null
        }
        Update: {
          access_restrictions?: string | null
          account_status?: Database["public"]["Enums"]["account_status"] | null
          additional_directions?: string | null
          address?: string | null
          age?: number | null
          age_verified?: boolean
          age_verified_at?: string | null
          all_zones?: boolean
          available_now_until?: string | null
          avatar_url?: string | null
          avg_competence?: number
          avg_professionalism?: number
          avg_punctuality?: number
          avg_reliability?: number
          avg_response_minutes?: number | null
          avg_teamwork?: number
          badge?: Database["public"]["Enums"]["worker_badge"] | null
          birth_date?: string | null
          birth_place?: string | null
          business_name?: string | null
          business_status?: string | null
          busy_days?: string[] | null
          cancellation_count?: number
          city?: string | null
          city_code?: string | null
          clean_shifts_after_penalty?: number
          company_tax_code?: string | null
          completed_shifts?: number | null
          completion_pct?: number
          contact_person_email?: string | null
          contact_person_first_name?: string | null
          contact_person_last_name?: string | null
          contact_person_phone?: string | null
          contact_person_role?: string | null
          contact_person_role_other?: string | null
          country?: string | null
          created_at?: string
          credits?: number | null
          default_arrival_advance_minutes?: number | null
          default_arrival_advance_reason?: string | null
          default_beard_allowed?: string | null
          default_contact_person_name?: string | null
          default_dress_code_items?: string[] | null
          default_dress_code_notes?: string | null
          default_language_requirements?: string[] | null
          default_license_requirement?: string | null
          default_piercings_allowed?: string | null
          default_required_skills?: string[] | null
          default_settings_updated_at?: string | null
          default_tattoos_allowed?: string | null
          delay_count?: number
          deleted_at?: string | null
          deletion_reason?: string | null
          distinct_restaurants_count?: number
          email?: string | null
          email_summary_sent_at?: string | null
          email_summary_status?: string | null
          employees_count?: number | null
          experience_level?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          experience_years?: number | null
          first_name?: string | null
          full_name?: string | null
          hourly_availability?: string | null
          hourly_rate?: number | null
          id?: string
          id_document_back_path?: string | null
          id_document_expires_at?: string | null
          id_document_issued_at?: string | null
          id_document_issuer?: string | null
          id_document_number?: string | null
          id_document_path?: string | null
          id_document_type?: string | null
          is_deleted?: boolean
          is_demo?: boolean
          is_motorized?: boolean | null
          languages?: string[] | null
          last_active_at?: string | null
          last_name?: string | null
          last_review_at?: string | null
          last_review_reminder_at?: string | null
          late_cancel_count?: number
          latitude?: number | null
          location_notes?: string | null
          longitude?: number | null
          nationality?: string | null
          neighborhood?: string | null
          no_show_count?: number
          no_shows?: number | null
          opening_hours?: string | null
          overdue_reviews_count?: number
          pec_email?: string | null
          phone?: string | null
          phone_country_code?: string | null
          phone_full?: string | null
          phone_number?: string | null
          phone_verified?: boolean
          phone_verified_at?: string | null
          plan?: Database["public"]["Enums"]["user_plan"] | null
          postal_code?: string | null
          price_range?: string | null
          primary_role?: string | null
          professional_profile?: string | null
          profile_completed?: boolean | null
          province?: string | null
          province_code?: string | null
          punctuality_pct?: number
          rating_avg?: number | null
          referral_code?: string | null
          referral_credits_earned?: number
          referred_by_user_id?: string | null
          registered_office_address?: string | null
          registered_office_city?: string | null
          registered_office_postal_code?: string | null
          registered_office_province?: string | null
          rehire_restaurants_count?: number
          rehire_total_answers?: number
          rehire_yes_count?: number
          reliability_pct?: number | null
          representative_age?: number | null
          reputation_level?: string
          reputation_score?: number
          reputation_updated_at?: string | null
          residence_address?: string | null
          residence_city?: string | null
          residence_number?: string | null
          residence_postal_code?: string | null
          residence_province?: string | null
          residence_street?: string | null
          review_blocked?: boolean
          review_blocked_at?: string | null
          reviews_count?: number | null
          sdi_code?: string | null
          search_penalty_active?: boolean
          search_penalty_reason?: string | null
          search_penalty_started_at?: string | null
          search_penalty_until?: string | null
          secondary_roles?: string[] | null
          seed_batch_id?: string | null
          selected_zones?: string[]
          service_area_city?: string | null
          service_area_district?: string | null
          service_area_lat?: number | null
          service_area_lng?: number | null
          service_area_radius_m?: number | null
          short_bio?: string | null
          spoken_languages?: Json
          street?: string | null
          street_number?: string | null
          stripe_customer_id?: string | null
          tax_code?: string | null
          terms_accepted?: boolean | null
          updated_at?: string
          vat_company_name?: string | null
          vat_number?: string | null
          vat_status?: Database["public"]["Enums"]["vat_status"] | null
          vat_verified_at?: string | null
          venue_type?: string | null
          venue_type_other?: string | null
          weekly_availability?: string[] | null
          whatsapp_confirmation_sent_at?: string | null
          whatsapp_confirmation_status?: string | null
          whatsapp_connected?: boolean | null
          work_area_mode?: string | null
        }
        Relationships: []
      }
      proposal_responses: {
        Row: {
          application_id: string
          created_at: string
          id: string
          message_id: string
          responder_id: string
          status: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          message_id: string
          responder_id: string
          status: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          message_id?: string
          responder_id?: string
          status?: string
        }
        Relationships: []
      }
      referral_invites: {
        Row: {
          completed_at: string | null
          created_at: string
          credits_amount: number
          credits_awarded: boolean
          id: string
          referral_code: string
          referred_email: string | null
          referred_user_id: string | null
          referrer_user_id: string
          status: Database["public"]["Enums"]["referral_status"]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          credits_amount?: number
          credits_awarded?: boolean
          id?: string
          referral_code: string
          referred_email?: string | null
          referred_user_id?: string | null
          referrer_user_id: string
          status?: Database["public"]["Enums"]["referral_status"]
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          credits_amount?: number
          credits_awarded?: boolean
          id?: string
          referral_code?: string
          referred_email?: string | null
          referred_user_id?: string | null
          referrer_user_id?: string
          status?: Database["public"]["Enums"]["referral_status"]
        }
        Relationships: []
      }
      required_reviews: {
        Row: {
          announcement_id: string | null
          application_id: string | null
          completed_at: string | null
          created_at: string
          due_date: string
          id: string
          restaurant_user_id: string
          review_id: string | null
          shift_id: string | null
          status: string
          updated_at: string
          worker_user_id: string
        }
        Insert: {
          announcement_id?: string | null
          application_id?: string | null
          completed_at?: string | null
          created_at?: string
          due_date: string
          id?: string
          restaurant_user_id: string
          review_id?: string | null
          shift_id?: string | null
          status?: string
          updated_at?: string
          worker_user_id: string
        }
        Update: {
          announcement_id?: string | null
          application_id?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          restaurant_user_id?: string
          review_id?: string | null
          shift_id?: string | null
          status?: string
          updated_at?: string
          worker_user_id?: string
        }
        Relationships: []
      }
      restaurant_worker_favorites: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          restaurant_id: string
          seed_batch_id: string | null
          worker_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          restaurant_id: string
          seed_batch_id?: string | null
          worker_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          restaurant_id?: string
          seed_batch_id?: string | null
          worker_id?: string
        }
        Relationships: []
      }
      review_revision_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          reason: string
          requester_id: string
          resolved_at: string | null
          review_id: string
          status: string
          support_ticket_id: string | null
          target_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reason: string
          requester_id: string
          resolved_at?: string | null
          review_id: string
          status?: string
          support_ticket_id?: string | null
          target_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reason?: string
          requester_id?: string
          resolved_at?: string | null
          review_id?: string
          status?: string
          support_ticket_id?: string | null
          target_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          announcement_id: string | null
          appearance: number | null
          application_id: string | null
          author_id: string
          comment: string | null
          communication: number | null
          competence: number | null
          created_at: string
          id: string
          is_demo: boolean
          is_visible_to_restaurants: boolean
          is_visible_to_worker: boolean
          negative_tags: string[]
          positive_tags: string[]
          professionalism: number | null
          punctuality: number | null
          rating: number
          reliability: number | null
          seed_batch_id: string | null
          seen_by_worker_at: string | null
          shift_id: string | null
          staff_collaboration: number | null
          tags: string[]
          target_id: string
          teamwork: number | null
          updated_at: string
          would_rehire: string | null
        }
        Insert: {
          announcement_id?: string | null
          appearance?: number | null
          application_id?: string | null
          author_id: string
          comment?: string | null
          communication?: number | null
          competence?: number | null
          created_at?: string
          id?: string
          is_demo?: boolean
          is_visible_to_restaurants?: boolean
          is_visible_to_worker?: boolean
          negative_tags?: string[]
          positive_tags?: string[]
          professionalism?: number | null
          punctuality?: number | null
          rating: number
          reliability?: number | null
          seed_batch_id?: string | null
          seen_by_worker_at?: string | null
          shift_id?: string | null
          staff_collaboration?: number | null
          tags?: string[]
          target_id: string
          teamwork?: number | null
          updated_at?: string
          would_rehire?: string | null
        }
        Update: {
          announcement_id?: string | null
          appearance?: number | null
          application_id?: string | null
          author_id?: string
          comment?: string | null
          communication?: number | null
          competence?: number | null
          created_at?: string
          id?: string
          is_demo?: boolean
          is_visible_to_restaurants?: boolean
          is_visible_to_worker?: boolean
          negative_tags?: string[]
          positive_tags?: string[]
          professionalism?: number | null
          punctuality?: number | null
          rating?: number
          reliability?: number | null
          seed_batch_id?: string | null
          seen_by_worker_at?: string | null
          shift_id?: string | null
          staff_collaboration?: number | null
          tags?: string[]
          target_id?: string
          teamwork?: number | null
          updated_at?: string
          would_rehire?: string | null
        }
        Relationships: []
      }
      shifts: {
        Row: {
          amount: number | null
          announcement_id: string | null
          completed_at: string | null
          created_at: string
          hours: number
          id: string
          is_demo: boolean
          restaurant_id: string
          reviewed_at: string | null
          reviewed_by_restaurant_user_id: string | null
          seed_batch_id: string | null
          shift_date: string
          status: Database["public"]["Enums"]["shift_status"]
          worker_id: string
        }
        Insert: {
          amount?: number | null
          announcement_id?: string | null
          completed_at?: string | null
          created_at?: string
          hours?: number
          id?: string
          is_demo?: boolean
          restaurant_id: string
          reviewed_at?: string | null
          reviewed_by_restaurant_user_id?: string | null
          seed_batch_id?: string | null
          shift_date: string
          status?: Database["public"]["Enums"]["shift_status"]
          worker_id: string
        }
        Update: {
          amount?: number | null
          announcement_id?: string | null
          completed_at?: string | null
          created_at?: string
          hours?: number
          id?: string
          is_demo?: boolean
          restaurant_id?: string
          reviewed_at?: string | null
          reviewed_by_restaurant_user_id?: string | null
          seed_batch_id?: string | null
          shift_date?: string
          status?: Database["public"]["Enums"]["shift_status"]
          worker_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          page_url: string | null
          status: string
          updated_at: string
          user_id: string
          user_role: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          message: string
          page_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
          user_role?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          page_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          user_role?: string | null
        }
        Relationships: []
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
      worker_availability: {
        Row: {
          city: string | null
          created_at: string
          day_of_week: number
          district: string | null
          end_time: string | null
          id: string
          is_flexible: boolean
          is_last_minute: boolean
          latitude: number | null
          longitude: number | null
          notes: string | null
          province: string | null
          radius_km: number | null
          start_time: string | null
          time_slot: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          day_of_week: number
          district?: string | null
          end_time?: string | null
          id?: string
          is_flexible?: boolean
          is_last_minute?: boolean
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          province?: string | null
          radius_km?: number | null
          start_time?: string | null
          time_slot: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          day_of_week?: number
          district?: string | null
          end_time?: string | null
          id?: string
          is_flexible?: boolean
          is_last_minute?: boolean
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          province?: string | null
          radius_km?: number | null
          start_time?: string | null
          time_slot?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: []
      }
      worker_availability_exceptions: {
        Row: {
          city: string | null
          created_at: string
          date: string
          district: string | null
          end_time: string | null
          id: string
          is_available: boolean
          latitude: number | null
          longitude: number | null
          notes: string | null
          province: string | null
          radius_km: number | null
          start_time: string | null
          time_slot: string | null
          updated_at: string
          worker_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          date: string
          district?: string | null
          end_time?: string | null
          id?: string
          is_available: boolean
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          province?: string | null
          radius_km?: number | null
          start_time?: string | null
          time_slot?: string | null
          updated_at?: string
          worker_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          date?: string
          district?: string | null
          end_time?: string | null
          id?: string
          is_available?: boolean
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          province?: string | null
          radius_km?: number | null
          start_time?: string | null
          time_slot?: string | null
          updated_at?: string
          worker_id?: string
        }
        Relationships: []
      }
      worker_badges: {
        Row: {
          awarded_at: string
          badge: string
          id: string
          is_demo: boolean
          seed_batch_id: string | null
          worker_id: string
        }
        Insert: {
          awarded_at?: string
          badge: string
          id?: string
          is_demo?: boolean
          seed_batch_id?: string | null
          worker_id: string
        }
        Update: {
          awarded_at?: string
          badge?: string
          id?: string
          is_demo?: boolean
          seed_batch_id?: string | null
          worker_id?: string
        }
        Relationships: []
      }
      worker_incidents: {
        Row: {
          actual_delay_minutes: number | null
          affects_compensation: boolean
          affects_reputation: boolean
          application_id: string | null
          confirmed_by_restaurant_at: string | null
          created_at: string
          custom_reason: string | null
          description: string | null
          estimated_delay_minutes: number | null
          id: string
          incident_type: string | null
          is_demo: boolean
          job_request_id: string | null
          kind: string
          reason: string | null
          restaurant_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          seed_batch_id: string | null
          shift_id: string | null
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          actual_delay_minutes?: number | null
          affects_compensation?: boolean
          affects_reputation?: boolean
          application_id?: string | null
          confirmed_by_restaurant_at?: string | null
          created_at?: string
          custom_reason?: string | null
          description?: string | null
          estimated_delay_minutes?: number | null
          id?: string
          incident_type?: string | null
          is_demo?: boolean
          job_request_id?: string | null
          kind: string
          reason?: string | null
          restaurant_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          seed_batch_id?: string | null
          shift_id?: string | null
          status?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          actual_delay_minutes?: number | null
          affects_compensation?: boolean
          affects_reputation?: boolean
          application_id?: string | null
          confirmed_by_restaurant_at?: string | null
          created_at?: string
          custom_reason?: string | null
          description?: string | null
          estimated_delay_minutes?: number | null
          id?: string
          incident_type?: string | null
          is_demo?: boolean
          job_request_id?: string | null
          kind?: string
          reason?: string | null
          restaurant_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          seed_batch_id?: string | null
          shift_id?: string | null
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      announcements_public: {
        Row: {
          assigned_worker_id: string | null
          beard_allowed: string | null
          created_at: string | null
          deposit_paid: boolean | null
          dress_code_items: string[] | null
          dress_code_notes: string | null
          duration_hours: number | null
          end_date: string | null
          end_time: string | null
          expires_at: string | null
          id: string | null
          is_demo: boolean | null
          is_long_shift: boolean | null
          job_city: string | null
          job_country: string | null
          job_location_notes: string | null
          job_postal_code: string | null
          job_province: string | null
          language_requirements: string[] | null
          languages: string[] | null
          license_requirement: string | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          long_shift_reason: string | null
          notes: string | null
          piercings_allowed: string | null
          professional_profile: string | null
          required_skills: string[] | null
          restaurant_id: string | null
          reused_from_announcement_id: string | null
          seed_batch_id: string | null
          service_date: string | null
          service_time: string | null
          shift_duration_hours: number | null
          speed: Database["public"]["Enums"]["service_speed"] | null
          status: Database["public"]["Enums"]["announcement_status"] | null
          tariff_amount: number | null
          tariff_type: Database["public"]["Enums"]["tariff_type"] | null
          tattoos_allowed: string | null
        }
        Insert: {
          assigned_worker_id?: string | null
          beard_allowed?: string | null
          created_at?: string | null
          deposit_paid?: boolean | null
          dress_code_items?: string[] | null
          dress_code_notes?: string | null
          duration_hours?: number | null
          end_date?: string | null
          end_time?: string | null
          expires_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          is_long_shift?: boolean | null
          job_city?: string | null
          job_country?: string | null
          job_location_notes?: string | null
          job_postal_code?: string | null
          job_province?: string | null
          language_requirements?: string[] | null
          languages?: string[] | null
          license_requirement?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          long_shift_reason?: string | null
          notes?: string | null
          piercings_allowed?: string | null
          professional_profile?: string | null
          required_skills?: string[] | null
          restaurant_id?: string | null
          reused_from_announcement_id?: string | null
          seed_batch_id?: string | null
          service_date?: string | null
          service_time?: string | null
          shift_duration_hours?: number | null
          speed?: Database["public"]["Enums"]["service_speed"] | null
          status?: Database["public"]["Enums"]["announcement_status"] | null
          tariff_amount?: number | null
          tariff_type?: Database["public"]["Enums"]["tariff_type"] | null
          tattoos_allowed?: string | null
        }
        Update: {
          assigned_worker_id?: string | null
          beard_allowed?: string | null
          created_at?: string | null
          deposit_paid?: boolean | null
          dress_code_items?: string[] | null
          dress_code_notes?: string | null
          duration_hours?: number | null
          end_date?: string | null
          end_time?: string | null
          expires_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          is_long_shift?: boolean | null
          job_city?: string | null
          job_country?: string | null
          job_location_notes?: string | null
          job_postal_code?: string | null
          job_province?: string | null
          language_requirements?: string[] | null
          languages?: string[] | null
          license_requirement?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          long_shift_reason?: string | null
          notes?: string | null
          piercings_allowed?: string | null
          professional_profile?: string | null
          required_skills?: string[] | null
          restaurant_id?: string | null
          reused_from_announcement_id?: string | null
          seed_batch_id?: string | null
          service_date?: string | null
          service_time?: string | null
          shift_duration_hours?: number | null
          speed?: Database["public"]["Enums"]["service_speed"] | null
          status?: Database["public"]["Enums"]["announcement_status"] | null
          tariff_amount?: number | null
          tariff_type?: Database["public"]["Enums"]["tariff_type"] | null
          tattoos_allowed?: string | null
        }
        Relationships: []
      }
      job_requests_public: {
        Row: {
          announcement_id: string | null
          beard_allowed: string | null
          break_included: boolean | null
          city: string | null
          contact_person_role: string | null
          contact_person_role_other: string | null
          country: string | null
          created_at: string | null
          description: string | null
          district: string | null
          dress_code_items: string[] | null
          dress_code_notes: string | null
          end_date: string | null
          end_time: string | null
          hourly_rate: number | null
          id: string | null
          is_demo: boolean | null
          is_long_shift: boolean | null
          language_requirements: string[] | null
          license_requirement: string | null
          long_shift_reason: string | null
          operational_notes: string | null
          piercings_allowed: string | null
          postal_code: string | null
          province: string | null
          required_skills: string[] | null
          restaurant_id: string | null
          restaurant_name: string | null
          restaurant_profile_id: string | null
          role_required: string | null
          seed_batch_id: string | null
          shift_date: string | null
          shift_duration_hours: number | null
          start_time: string | null
          status: string | null
          tasks: string | null
          tattoos_allowed: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          worker_notes: string | null
          workers_needed: number | null
        }
        Insert: {
          announcement_id?: string | null
          beard_allowed?: string | null
          break_included?: boolean | null
          city?: string | null
          contact_person_role?: string | null
          contact_person_role_other?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          district?: string | null
          dress_code_items?: string[] | null
          dress_code_notes?: string | null
          end_date?: string | null
          end_time?: string | null
          hourly_rate?: number | null
          id?: string | null
          is_demo?: boolean | null
          is_long_shift?: boolean | null
          language_requirements?: string[] | null
          license_requirement?: string | null
          long_shift_reason?: string | null
          operational_notes?: string | null
          piercings_allowed?: string | null
          postal_code?: string | null
          province?: string | null
          required_skills?: string[] | null
          restaurant_id?: string | null
          restaurant_name?: string | null
          restaurant_profile_id?: string | null
          role_required?: string | null
          seed_batch_id?: string | null
          shift_date?: string | null
          shift_duration_hours?: number | null
          start_time?: string | null
          status?: string | null
          tasks?: string | null
          tattoos_allowed?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          worker_notes?: string | null
          workers_needed?: number | null
        }
        Update: {
          announcement_id?: string | null
          beard_allowed?: string | null
          break_included?: boolean | null
          city?: string | null
          contact_person_role?: string | null
          contact_person_role_other?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          district?: string | null
          dress_code_items?: string[] | null
          dress_code_notes?: string | null
          end_date?: string | null
          end_time?: string | null
          hourly_rate?: number | null
          id?: string | null
          is_demo?: boolean | null
          is_long_shift?: boolean | null
          language_requirements?: string[] | null
          license_requirement?: string | null
          long_shift_reason?: string | null
          operational_notes?: string | null
          piercings_allowed?: string | null
          postal_code?: string | null
          province?: string | null
          required_skills?: string[] | null
          restaurant_id?: string | null
          restaurant_name?: string | null
          restaurant_profile_id?: string | null
          role_required?: string | null
          seed_batch_id?: string | null
          shift_date?: string | null
          shift_duration_hours?: number | null
          start_time?: string | null
          status?: string | null
          tasks?: string | null
          tattoos_allowed?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          worker_notes?: string | null
          workers_needed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_requests_restaurant_profile_id_fkey"
            columns: ["restaurant_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      announcement_effective_end: {
        Args: { p_announcement_id: string }
        Returns: string
      }
      award_referral_credits: {
        Args: { _referred_user_id: string }
        Returns: undefined
      }
      can_read_application: {
        Args: {
          _announcement_id: string
          _restaurant_id: string
          _worker_id: string
        }
        Returns: boolean
      }
      can_update_application: {
        Args: {
          _announcement_id: string
          _restaurant_id: string
          _worker_id: string
        }
        Returns: boolean
      }
      can_worker_insert_application: {
        Args: {
          _announcement_id: string
          _restaurant_id: string
          _status: Database["public"]["Enums"]["application_status"]
          _worker_id: string
        }
        Returns: boolean
      }
      consume_credits: {
        Args: { _amount: number; _reason: string; _reference_id?: string }
        Returns: boolean
      }
      delete_my_account: {
        Args: { _custom_reason?: string; _reason?: string }
        Returns: Json
      }
      generate_referral_code: { Args: never; Returns: string }
      get_announcement_contact: {
        Args: { _announcement_id: string }
        Returns: {
          job_contact_person_email: string
          job_contact_person_name: string
          job_contact_person_phone: string
        }[]
      }
      get_application_availability: {
        Args: { _announcement_id: string }
        Returns: {
          accepted_count: number
          is_full: boolean
          restaurant_id: string
          workers_needed: number
        }[]
      }
      get_my_job_request: {
        Args: { _announcement_id: string }
        Returns: {
          access_restrictions: string | null
          additional_directions: string | null
          address: string
          announcement_id: string | null
          beard_allowed: string | null
          break_included: boolean
          city: string | null
          contact_person_email: string | null
          contact_person_name: string | null
          contact_person_phone: string | null
          contact_person_role: string | null
          contact_person_role_other: string | null
          country: string | null
          created_at: string
          description: string | null
          district: string | null
          dress_code_items: string[]
          dress_code_notes: string | null
          end_date: string | null
          end_time: string
          hourly_rate: number
          id: string
          is_demo: boolean
          is_long_shift: boolean
          language_requirements: string[]
          latitude: number | null
          license_requirement: string | null
          long_shift_reason: string | null
          longitude: number | null
          operational_notes: string | null
          piercings_allowed: string | null
          postal_code: string | null
          province: string | null
          required_skills: string[]
          restaurant_id: string
          restaurant_name: string | null
          restaurant_profile_id: string
          role_required: string
          seed_batch_id: string | null
          shift_date: string
          shift_duration_hours: number | null
          start_time: string
          status: string
          tasks: string | null
          tattoos_allowed: string | null
          title: string
          updated_at: string
          user_id: string
          worker_notes: string | null
          workers_needed: number
        }
        SetofOptions: {
          from: "*"
          to: "job_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_my_profile: {
        Args: never
        Returns: {
          access_restrictions: string | null
          account_status: Database["public"]["Enums"]["account_status"] | null
          additional_directions: string | null
          address: string | null
          age: number | null
          age_verified: boolean
          age_verified_at: string | null
          all_zones: boolean
          available_now_until: string | null
          avatar_url: string | null
          avg_competence: number
          avg_professionalism: number
          avg_punctuality: number
          avg_reliability: number
          avg_response_minutes: number | null
          avg_teamwork: number
          badge: Database["public"]["Enums"]["worker_badge"] | null
          birth_date: string | null
          birth_place: string | null
          business_name: string | null
          business_status: string | null
          busy_days: string[] | null
          cancellation_count: number
          city: string | null
          city_code: string | null
          clean_shifts_after_penalty: number
          company_tax_code: string | null
          completed_shifts: number | null
          completion_pct: number
          contact_person_email: string | null
          contact_person_first_name: string | null
          contact_person_last_name: string | null
          contact_person_phone: string | null
          contact_person_role: string | null
          contact_person_role_other: string | null
          country: string | null
          created_at: string
          credits: number | null
          default_arrival_advance_minutes: number | null
          default_arrival_advance_reason: string | null
          default_beard_allowed: string | null
          default_contact_person_name: string | null
          default_dress_code_items: string[] | null
          default_dress_code_notes: string | null
          default_language_requirements: string[] | null
          default_license_requirement: string | null
          default_piercings_allowed: string | null
          default_required_skills: string[] | null
          default_settings_updated_at: string | null
          default_tattoos_allowed: string | null
          delay_count: number
          deleted_at: string | null
          deletion_reason: string | null
          distinct_restaurants_count: number
          email: string | null
          email_summary_sent_at: string | null
          email_summary_status: string | null
          employees_count: number | null
          experience_level:
            | Database["public"]["Enums"]["experience_level"]
            | null
          experience_years: number | null
          first_name: string | null
          full_name: string | null
          hourly_availability: string | null
          hourly_rate: number | null
          id: string
          id_document_back_path: string | null
          id_document_expires_at: string | null
          id_document_issued_at: string | null
          id_document_issuer: string | null
          id_document_number: string | null
          id_document_path: string | null
          id_document_type: string | null
          is_deleted: boolean
          is_demo: boolean
          is_motorized: boolean | null
          languages: string[] | null
          last_active_at: string | null
          last_name: string | null
          last_review_at: string | null
          last_review_reminder_at: string | null
          late_cancel_count: number
          latitude: number | null
          location_notes: string | null
          longitude: number | null
          nationality: string | null
          neighborhood: string | null
          no_show_count: number
          no_shows: number | null
          opening_hours: string | null
          overdue_reviews_count: number
          pec_email: string | null
          phone: string | null
          phone_country_code: string | null
          phone_full: string | null
          phone_number: string | null
          phone_verified: boolean
          phone_verified_at: string | null
          plan: Database["public"]["Enums"]["user_plan"] | null
          postal_code: string | null
          price_range: string | null
          primary_role: string | null
          professional_profile: string | null
          profile_completed: boolean | null
          province: string | null
          province_code: string | null
          punctuality_pct: number
          rating_avg: number | null
          referral_code: string | null
          referral_credits_earned: number
          referred_by_user_id: string | null
          registered_office_address: string | null
          registered_office_city: string | null
          registered_office_postal_code: string | null
          registered_office_province: string | null
          rehire_restaurants_count: number
          rehire_total_answers: number
          rehire_yes_count: number
          reliability_pct: number | null
          representative_age: number | null
          reputation_level: string
          reputation_score: number
          reputation_updated_at: string | null
          residence_address: string | null
          residence_city: string | null
          residence_number: string | null
          residence_postal_code: string | null
          residence_province: string | null
          residence_street: string | null
          review_blocked: boolean
          review_blocked_at: string | null
          reviews_count: number | null
          sdi_code: string | null
          search_penalty_active: boolean
          search_penalty_reason: string | null
          search_penalty_started_at: string | null
          search_penalty_until: string | null
          secondary_roles: string[] | null
          seed_batch_id: string | null
          selected_zones: string[]
          service_area_city: string | null
          service_area_district: string | null
          service_area_lat: number | null
          service_area_lng: number | null
          service_area_radius_m: number | null
          short_bio: string | null
          spoken_languages: Json
          street: string | null
          street_number: string | null
          stripe_customer_id: string | null
          tax_code: string | null
          terms_accepted: boolean | null
          updated_at: string
          vat_company_name: string | null
          vat_number: string | null
          vat_status: Database["public"]["Enums"]["vat_status"] | null
          vat_verified_at: string | null
          venue_type: string | null
          venue_type_other: string | null
          weekly_availability: string[] | null
          whatsapp_confirmation_sent_at: string | null
          whatsapp_confirmation_status: string | null
          whatsapp_connected: boolean | null
          work_area_mode: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      grant_credits: {
        Args: {
          _amount: number
          _kind: Database["public"]["Enums"]["credit_tx_kind"]
          _reason: string
          _reference_id?: string
          _user_id: string
        }
        Returns: number
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_worker_restaurant_relationship: {
        Args: { _restaurant: string; _worker: string }
        Returns: boolean
      }
      is_confirmed_delay: { Args: { _status: string }; Returns: boolean }
      list_worker_user_ids: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      log_profile_date_validation_failure: {
        Args: { _payload: Json; _reason: string }
        Returns: string
      }
      mark_overdue_required_reviews: { Args: never; Returns: number }
      normalize_vat: { Args: { _v: string }; Returns: string }
      recompute_review_block: {
        Args: { _restaurant_id: string }
        Returns: undefined
      }
      recompute_worker_penalty: {
        Args: { _worker: string }
        Returns: undefined
      }
      recompute_worker_reputation: {
        Args: { _worker: string }
        Returns: undefined
      }
      redeem_discount_code: {
        Args: {
          _applies_to: string
          _code: string
          _discount_amount: number
          _order_id: string
        }
        Returns: Json
      }
      register_referral: {
        Args: { _code: string; _new_user: string }
        Returns: string
      }
      resolve_current_user_role: {
        Args: never
        Returns: {
          email: string
          final_role: string
          final_route: string
          metadata_role: string
          profile_error: string
          profile_role: string
          user_id: string
          user_role: string
          user_roles_error: string
        }[]
      }
      send_required_review_reminders: { Args: never; Returns: number }
      unseed_demo: {
        Args: { _batch: string }
        Returns: {
          rows_affected: number
          step: string
        }[]
      }
      validate_discount_code: {
        Args: { _applies_to?: string; _code: string }
        Returns: Json
      }
    }
    Enums: {
      account_status: "active" | "pending" | "suspended"
      announcement_status:
        | "draft"
        | "active"
        | "expired"
        | "assigned"
        | "cancelled"
        | "completed"
      app_role: "admin" | "restaurant" | "worker"
      application_status:
        | "pending"
        | "interested"
        | "not_interested"
        | "counter_offer"
        | "accepted"
        | "rejected"
        | "expired"
        | "cancelled"
      credit_tx_kind: "purchase" | "grant" | "consume" | "refund" | "plan_bonus"
      discount_applies_to: "credits" | "premium" | "all"
      discount_type: "percentage" | "fixed_amount" | "free_credits"
      experience_level: "junior" | "intermediate" | "senior"
      phone_verification_status:
        | "pending"
        | "sent"
        | "verified"
        | "expired"
        | "failed"
      referral_status:
        | "pending"
        | "registered"
        | "verified"
        | "completed"
        | "rejected"
      service_speed: "normal" | "fast" | "flash"
      shift_status: "scheduled" | "completed" | "no_show" | "cancelled"
      tariff_type: "hourly" | "flat"
      user_plan: "free" | "credits" | "premium" | "pro" | "business"
      vat_status: "pending" | "valid" | "invalid" | "error"
      worker_badge: "basic" | "pro" | "elite"
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
      account_status: ["active", "pending", "suspended"],
      announcement_status: [
        "draft",
        "active",
        "expired",
        "assigned",
        "cancelled",
        "completed",
      ],
      app_role: ["admin", "restaurant", "worker"],
      application_status: [
        "pending",
        "interested",
        "not_interested",
        "counter_offer",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
      ],
      credit_tx_kind: ["purchase", "grant", "consume", "refund", "plan_bonus"],
      discount_applies_to: ["credits", "premium", "all"],
      discount_type: ["percentage", "fixed_amount", "free_credits"],
      experience_level: ["junior", "intermediate", "senior"],
      phone_verification_status: [
        "pending",
        "sent",
        "verified",
        "expired",
        "failed",
      ],
      referral_status: [
        "pending",
        "registered",
        "verified",
        "completed",
        "rejected",
      ],
      service_speed: ["normal", "fast", "flash"],
      shift_status: ["scheduled", "completed", "no_show", "cancelled"],
      tariff_type: ["hourly", "flat"],
      user_plan: ["free", "credits", "premium", "pro", "business"],
      vat_status: ["pending", "valid", "invalid", "error"],
      worker_badge: ["basic", "pro", "elite"],
    },
  },
} as const
