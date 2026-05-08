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
          created_at: string
          deposit_paid: boolean | null
          dress_code_items: string[] | null
          dress_code_notes: string | null
          duration_hours: number
          expires_at: string
          id: string
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
          notes: string | null
          piercings_allowed: string | null
          professional_profile: string | null
          required_skills: string[] | null
          restaurant_id: string
          service_date: string
          service_time: string
          speed: Database["public"]["Enums"]["service_speed"]
          status: Database["public"]["Enums"]["announcement_status"]
          tariff_amount: number
          tariff_type: Database["public"]["Enums"]["tariff_type"]
          tattoos_allowed: string | null
        }
        Insert: {
          assigned_worker_id?: string | null
          beard_allowed?: string | null
          created_at?: string
          deposit_paid?: boolean | null
          dress_code_items?: string[] | null
          dress_code_notes?: string | null
          duration_hours?: number
          expires_at?: string
          id?: string
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
          notes?: string | null
          piercings_allowed?: string | null
          professional_profile?: string | null
          required_skills?: string[] | null
          restaurant_id: string
          service_date: string
          service_time: string
          speed?: Database["public"]["Enums"]["service_speed"]
          status?: Database["public"]["Enums"]["announcement_status"]
          tariff_amount: number
          tariff_type?: Database["public"]["Enums"]["tariff_type"]
          tattoos_allowed?: string | null
        }
        Update: {
          assigned_worker_id?: string | null
          beard_allowed?: string | null
          created_at?: string
          deposit_paid?: boolean | null
          dress_code_items?: string[] | null
          dress_code_notes?: string | null
          duration_hours?: number
          expires_at?: string
          id?: string
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
          notes?: string | null
          piercings_allowed?: string | null
          professional_profile?: string | null
          required_skills?: string[] | null
          restaurant_id?: string
          service_date?: string
          service_time?: string
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
          proposed_tariff: number | null
          response_deadline: string
          restaurant_id: string
          status: Database["public"]["Enums"]["application_status"]
          worker_id: string
          worker_response_at: string | null
        }
        Insert: {
          announcement_id: string
          binding_offer?: boolean | null
          created_at?: string
          id?: string
          proposed_tariff?: number | null
          response_deadline?: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["application_status"]
          worker_id: string
          worker_response_at?: string | null
        }
        Update: {
          announcement_id?: string
          binding_offer?: boolean | null
          created_at?: string
          id?: string
          proposed_tariff?: number | null
          response_deadline?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["application_status"]
          worker_id?: string
          worker_response_at?: string | null
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
      favorites: {
        Row: {
          announcement_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          id?: string
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
          country: string | null
          created_at: string
          description: string | null
          district: string | null
          dress_code_items: string[]
          dress_code_notes: string | null
          end_time: string
          hourly_rate: number
          id: string
          language_requirements: string[]
          latitude: number | null
          license_requirement: string | null
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
          shift_date: string
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
          country?: string | null
          created_at?: string
          description?: string | null
          district?: string | null
          dress_code_items?: string[]
          dress_code_notes?: string | null
          end_time: string
          hourly_rate: number
          id?: string
          language_requirements?: string[]
          latitude?: number | null
          license_requirement?: string | null
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
          shift_date: string
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
          country?: string | null
          created_at?: string
          description?: string | null
          district?: string | null
          dress_code_items?: string[]
          dress_code_notes?: string | null
          end_time?: string
          hourly_rate?: number
          id?: string
          language_requirements?: string[]
          latitude?: number | null
          license_requirement?: string | null
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
          shift_date?: string
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
          application_id: string
          body: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          application_id: string
          body: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          application_id?: string
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean | null
          read_at?: string | null
          title?: string
          user_id?: string
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
          badge: Database["public"]["Enums"]["worker_badge"] | null
          birth_date: string | null
          business_name: string | null
          busy_days: string[] | null
          city: string | null
          completed_shifts: number | null
          contact_person_email: string | null
          contact_person_first_name: string | null
          contact_person_last_name: string | null
          contact_person_phone: string | null
          contact_person_role: string | null
          country: string | null
          created_at: string
          credits: number | null
          default_beard_allowed: string | null
          default_dress_code_items: string[] | null
          default_dress_code_notes: string | null
          default_language_requirements: string[] | null
          default_license_requirement: string | null
          default_piercings_allowed: string | null
          default_required_skills: string[] | null
          default_tattoos_allowed: string | null
          email: string | null
          employees_count: number | null
          experience_level:
            | Database["public"]["Enums"]["experience_level"]
            | null
          experience_years: number | null
          full_name: string | null
          hourly_availability: string | null
          hourly_rate: number | null
          id: string
          is_motorized: boolean | null
          languages: string[] | null
          last_active_at: string | null
          latitude: number | null
          location_notes: string | null
          longitude: number | null
          neighborhood: string | null
          no_shows: number | null
          opening_hours: string | null
          phone: string | null
          plan: Database["public"]["Enums"]["user_plan"] | null
          postal_code: string | null
          price_range: string | null
          primary_role: string | null
          professional_profile: string | null
          profile_completed: boolean | null
          province: string | null
          rating_avg: number | null
          reliability_pct: number | null
          representative_age: number | null
          reviews_count: number | null
          secondary_roles: string[] | null
          service_area_lat: number | null
          service_area_lng: number | null
          service_area_radius_m: number | null
          short_bio: string | null
          street: string | null
          street_number: string | null
          terms_accepted: boolean | null
          updated_at: string
          vat_company_name: string | null
          vat_number: string | null
          vat_status: Database["public"]["Enums"]["vat_status"] | null
          vat_verified_at: string | null
          venue_type: string | null
          weekly_availability: string[] | null
          whatsapp_connected: boolean | null
        }
        Insert: {
          access_restrictions?: string | null
          account_status?: Database["public"]["Enums"]["account_status"] | null
          additional_directions?: string | null
          address?: string | null
          age?: number | null
          age_verified?: boolean
          age_verified_at?: string | null
          badge?: Database["public"]["Enums"]["worker_badge"] | null
          birth_date?: string | null
          business_name?: string | null
          busy_days?: string[] | null
          city?: string | null
          completed_shifts?: number | null
          contact_person_email?: string | null
          contact_person_first_name?: string | null
          contact_person_last_name?: string | null
          contact_person_phone?: string | null
          contact_person_role?: string | null
          country?: string | null
          created_at?: string
          credits?: number | null
          default_beard_allowed?: string | null
          default_dress_code_items?: string[] | null
          default_dress_code_notes?: string | null
          default_language_requirements?: string[] | null
          default_license_requirement?: string | null
          default_piercings_allowed?: string | null
          default_required_skills?: string[] | null
          default_tattoos_allowed?: string | null
          email?: string | null
          employees_count?: number | null
          experience_level?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          experience_years?: number | null
          full_name?: string | null
          hourly_availability?: string | null
          hourly_rate?: number | null
          id: string
          is_motorized?: boolean | null
          languages?: string[] | null
          last_active_at?: string | null
          latitude?: number | null
          location_notes?: string | null
          longitude?: number | null
          neighborhood?: string | null
          no_shows?: number | null
          opening_hours?: string | null
          phone?: string | null
          plan?: Database["public"]["Enums"]["user_plan"] | null
          postal_code?: string | null
          price_range?: string | null
          primary_role?: string | null
          professional_profile?: string | null
          profile_completed?: boolean | null
          province?: string | null
          rating_avg?: number | null
          reliability_pct?: number | null
          representative_age?: number | null
          reviews_count?: number | null
          secondary_roles?: string[] | null
          service_area_lat?: number | null
          service_area_lng?: number | null
          service_area_radius_m?: number | null
          short_bio?: string | null
          street?: string | null
          street_number?: string | null
          terms_accepted?: boolean | null
          updated_at?: string
          vat_company_name?: string | null
          vat_number?: string | null
          vat_status?: Database["public"]["Enums"]["vat_status"] | null
          vat_verified_at?: string | null
          venue_type?: string | null
          weekly_availability?: string[] | null
          whatsapp_connected?: boolean | null
        }
        Update: {
          access_restrictions?: string | null
          account_status?: Database["public"]["Enums"]["account_status"] | null
          additional_directions?: string | null
          address?: string | null
          age?: number | null
          age_verified?: boolean
          age_verified_at?: string | null
          badge?: Database["public"]["Enums"]["worker_badge"] | null
          birth_date?: string | null
          business_name?: string | null
          busy_days?: string[] | null
          city?: string | null
          completed_shifts?: number | null
          contact_person_email?: string | null
          contact_person_first_name?: string | null
          contact_person_last_name?: string | null
          contact_person_phone?: string | null
          contact_person_role?: string | null
          country?: string | null
          created_at?: string
          credits?: number | null
          default_beard_allowed?: string | null
          default_dress_code_items?: string[] | null
          default_dress_code_notes?: string | null
          default_language_requirements?: string[] | null
          default_license_requirement?: string | null
          default_piercings_allowed?: string | null
          default_required_skills?: string[] | null
          default_tattoos_allowed?: string | null
          email?: string | null
          employees_count?: number | null
          experience_level?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          experience_years?: number | null
          full_name?: string | null
          hourly_availability?: string | null
          hourly_rate?: number | null
          id?: string
          is_motorized?: boolean | null
          languages?: string[] | null
          last_active_at?: string | null
          latitude?: number | null
          location_notes?: string | null
          longitude?: number | null
          neighborhood?: string | null
          no_shows?: number | null
          opening_hours?: string | null
          phone?: string | null
          plan?: Database["public"]["Enums"]["user_plan"] | null
          postal_code?: string | null
          price_range?: string | null
          primary_role?: string | null
          professional_profile?: string | null
          profile_completed?: boolean | null
          province?: string | null
          rating_avg?: number | null
          reliability_pct?: number | null
          representative_age?: number | null
          reviews_count?: number | null
          secondary_roles?: string[] | null
          service_area_lat?: number | null
          service_area_lng?: number | null
          service_area_radius_m?: number | null
          short_bio?: string | null
          street?: string | null
          street_number?: string | null
          terms_accepted?: boolean | null
          updated_at?: string
          vat_company_name?: string | null
          vat_number?: string | null
          vat_status?: Database["public"]["Enums"]["vat_status"] | null
          vat_verified_at?: string | null
          venue_type?: string | null
          weekly_availability?: string[] | null
          whatsapp_connected?: boolean | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          shift_id: string | null
          target_id: string
        }
        Insert: {
          author_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          shift_id?: string | null
          target_id: string
        }
        Update: {
          author_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          shift_id?: string | null
          target_id?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          amount: number | null
          announcement_id: string | null
          created_at: string
          hours: number
          id: string
          restaurant_id: string
          shift_date: string
          status: Database["public"]["Enums"]["shift_status"]
          worker_id: string
        }
        Insert: {
          amount?: number | null
          announcement_id?: string | null
          created_at?: string
          hours?: number
          id?: string
          restaurant_id: string
          shift_date: string
          status?: Database["public"]["Enums"]["shift_status"]
          worker_id: string
        }
        Update: {
          amount?: number | null
          announcement_id?: string | null
          created_at?: string
          hours?: number
          id?: string
          restaurant_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_credits: {
        Args: { _amount: number; _reason: string; _reference_id?: string }
        Returns: boolean
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
      credit_tx_kind: "purchase" | "grant" | "consume" | "refund" | "plan_bonus"
      experience_level: "junior" | "intermediate" | "senior"
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
      ],
      credit_tx_kind: ["purchase", "grant", "consume", "refund", "plan_bonus"],
      experience_level: ["junior", "intermediate", "senior"],
      service_speed: ["normal", "fast", "flash"],
      shift_status: ["scheduled", "completed", "no_show", "cancelled"],
      tariff_type: ["hourly", "flat"],
      user_plan: ["free", "credits", "premium", "pro", "business"],
      vat_status: ["pending", "valid", "invalid", "error"],
      worker_badge: ["basic", "pro", "elite"],
    },
  },
} as const
