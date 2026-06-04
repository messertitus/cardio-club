export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ClubMemberRole = "admin" | "mod" | "member";
export type SportIntensityLevel = "low" | "medium" | "high";
export type SportLocationType = "indoor" | "outdoor" | "water" | "field" | "flexible";
export type WeeklyEventStatus = "proposing" | "voting" | "decided" | "completed" | "cancelled";
export type AttendanceStatus = "going" | "maybe" | "not_going";
export type ActualAttendanceStatus = "present" | "absent" | "excused" | "unknown";
export type EventDecisionType = "single" | "multi_sport" | "twin" | "none";
export type EventActivityRole = "primary" | "secondary";
export type DirectChatStatus = "open" | "closed";
export type AppRole = "admin" | "member";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          email: string | null;
          phone: string | null;
          postal_code: string | null;
          city: string | null;
          favorite_sports: string | null;
          birth_date: string | null;
          role: AppRole;
          avatar_url: string | null;
          deactivated_at: string | null;
          deactivated_reason: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          email?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          city?: string | null;
          favorite_sports?: string | null;
          birth_date?: string | null;
          role?: AppRole;
          avatar_url?: string | null;
          deactivated_at?: string | null;
          deactivated_reason?: string | null;
          created_at?: string;
        };
        Update: {
          display_name?: string;
          email?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          city?: string | null;
          favorite_sports?: string | null;
          birth_date?: string | null;
          role?: AppRole;
          avatar_url?: string | null;
          deactivated_at?: string | null;
          deactivated_reason?: string | null;
        };
        Relationships: [];
      };
      clubs: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
        };
        Relationships: [];
      };
      club_members: {
        Row: {
          id: string;
          club_id: string;
          user_id: string;
          role: ClubMemberRole;
          joined_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          user_id: string;
          role?: ClubMemberRole;
          joined_at?: string;
        };
        Update: {
          role?: ClubMemberRole;
        };
        Relationships: [];
      };
      sports: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          location_description: string | null;
          category: string;
          icon_name: string | null;
          intensity_level: SportIntensityLevel;
          location_type: SportLocationType;
          combinable_tags: string[];
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          location_description?: string | null;
          category: string;
          icon_name?: string | null;
          intensity_level: SportIntensityLevel;
          location_type: SportLocationType;
          combinable_tags?: string[];
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          location_description?: string | null;
          category?: string;
          icon_name?: string | null;
          intensity_level?: SportIntensityLevel;
          location_type?: SportLocationType;
          combinable_tags?: string[];
          is_active?: boolean;
        };
        Relationships: [];
      };
      sport_profile_sports: {
        Row: {
          profile_id: string;
          sport_id: string;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          sport_id: string;
          created_at?: string;
        };
        Update: {
          profile_id?: string;
          sport_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      sport_profiles: {
        Row: {
          id: string;
          sport_id: string;
          name: string;
          location_name: string | null;
          map_url: string | null;
          postal_code: string | null;
          location_city: string | null;
          latitude: number | null;
          longitude: number | null;
          venue_group_key: string | null;
          location_type: SportLocationType;
          is_indoor: boolean;
          minimum_group_size: number;
          maximum_group_size: number | null;
          required_equipment: string[];
          available_equipment: string[];
          cost_note: string | null;
          opening_notes: string | null;
          lighting_available: boolean | null;
          transit_notes: string | null;
          amenity_notes: string | null;
          reservation_required: boolean | null;
          safety_notes: string | null;
          location_rules: string | null;
          ap_required: boolean;
          ap_contact_id: string | null;
          weather_rules: Json;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sport_id: string;
          name: string;
          location_name?: string | null;
          map_url?: string | null;
          postal_code?: string | null;
          location_city?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          venue_group_key?: string | null;
          location_type?: SportLocationType;
          is_indoor?: boolean;
          minimum_group_size?: number;
          maximum_group_size?: number | null;
          required_equipment?: string[];
          available_equipment?: string[];
          cost_note?: string | null;
          opening_notes?: string | null;
          lighting_available?: boolean | null;
          transit_notes?: string | null;
          amenity_notes?: string | null;
          reservation_required?: boolean | null;
          safety_notes?: string | null;
          location_rules?: string | null;
          ap_required?: boolean;
          ap_contact_id?: string | null;
          weather_rules?: Json;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          sport_id?: string;
          name?: string;
          location_name?: string | null;
          map_url?: string | null;
          postal_code?: string | null;
          location_city?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          venue_group_key?: string | null;
          location_type?: SportLocationType;
          is_indoor?: boolean;
          minimum_group_size?: number;
          maximum_group_size?: number | null;
          required_equipment?: string[];
          available_equipment?: string[];
          cost_note?: string | null;
          opening_notes?: string | null;
          lighting_available?: boolean | null;
          transit_notes?: string | null;
          amenity_notes?: string | null;
          reservation_required?: boolean | null;
          safety_notes?: string | null;
          location_rules?: string | null;
          ap_required?: boolean;
          ap_contact_id?: string | null;
          weather_rules?: Json;
          is_active?: boolean;
        };
        Relationships: [];
      };
      sport_contacts: {
        Row: {
          id: string;
          sport_id: string;
          user_id: string;
          note: string | null;
          is_primary: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sport_id: string;
          user_id: string;
          note?: string | null;
          is_primary?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          note?: string | null;
          is_primary?: boolean;
        };
        Relationships: [];
      };
      weekly_events: {
        Row: {
          id: string;
          club_id: string;
          week_start_date: string;
          selected_sport_id: string | null;
          secondary_sport_id: string | null;
          decision_type: EventDecisionType | null;
          decision_scorecard: Json | null;
          weather_snapshot: Json | null;
          status: WeeklyEventStatus;
          location: string | null;
          starts_at: string | null;
          notes: string | null;
          decision_reason: string | null;
          activity_contact_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          week_start_date: string;
          selected_sport_id?: string | null;
          secondary_sport_id?: string | null;
          decision_type?: EventDecisionType | null;
          decision_scorecard?: Json | null;
          weather_snapshot?: Json | null;
          status?: WeeklyEventStatus;
          location?: string | null;
          starts_at?: string | null;
          notes?: string | null;
          decision_reason?: string | null;
          activity_contact_id?: string | null;
          created_at?: string;
        };
        Update: {
          selected_sport_id?: string | null;
          secondary_sport_id?: string | null;
          decision_type?: EventDecisionType | null;
          decision_scorecard?: Json | null;
          weather_snapshot?: Json | null;
          status?: WeeklyEventStatus;
          location?: string | null;
          starts_at?: string | null;
          notes?: string | null;
          decision_reason?: string | null;
          activity_contact_id?: string | null;
        };
        Relationships: [];
      };
      sport_proposals: {
        Row: {
          id: string;
          event_id: string;
          sport_id: string;
          proposed_by: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          sport_id: string;
          proposed_by: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          note?: string | null;
        };
        Relationships: [];
      };
      sport_votes: {
        Row: {
          id: string;
          event_id: string;
          sport_id: string;
          user_id: string;
          weight: number;
          vote_rank: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          sport_id: string;
          user_id: string;
          weight?: number;
          vote_rank: number;
          created_at?: string;
        };
        Update: {
          weight?: number;
          vote_rank?: number;
        };
        Relationships: [];
      };
      sport_no_gos: {
        Row: {
          id: string;
          event_id: string;
          sport_id: string;
          user_id: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          sport_id: string;
          user_id: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          reason?: string | null;
        };
        Relationships: [];
      };
      attendance: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          status: AttendanceStatus;
          subgroup_id: string | null;
          actual_status: ActualAttendanceStatus | null;
          checked_by: string | null;
          checked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          status?: AttendanceStatus;
          subgroup_id?: string | null;
          actual_status?: ActualAttendanceStatus | null;
          checked_by?: string | null;
          checked_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: AttendanceStatus;
          subgroup_id?: string | null;
          actual_status?: ActualAttendanceStatus | null;
          checked_by?: string | null;
          checked_at?: string | null;
        };
        Relationships: [];
      };
      member_preference_history: {
        Row: {
          id: string;
          club_id: string;
          user_id: string;
          sport_id: string;
          week_start_date: string;
          was_selected: boolean;
          voted_for: boolean;
          vote_rank: number | null;
          covered_by_decision: boolean;
          covered_by_activity_type: EventDecisionType | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          user_id: string;
          sport_id: string;
          week_start_date: string;
          was_selected?: boolean;
          voted_for?: boolean;
          vote_rank?: number | null;
          covered_by_decision?: boolean;
          covered_by_activity_type?: EventDecisionType | null;
          created_at?: string;
        };
        Update: {
          was_selected?: boolean;
          voted_for?: boolean;
          vote_rank?: number | null;
          covered_by_decision?: boolean;
          covered_by_activity_type?: EventDecisionType | null;
        };
        Relationships: [];
      };
      event_activities: {
        Row: {
          id: string;
          event_id: string;
          sport_id: string;
          sport_profile_id: string | null;
          role: EventActivityRole;
          activity_type: EventDecisionType;
          title: string;
          location: string | null;
          starts_at: string | null;
          activity_contact_id: string | null;
          assigned_user_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          sport_id: string;
          sport_profile_id?: string | null;
          role: EventActivityRole;
          activity_type: EventDecisionType;
          title: string;
          location?: string | null;
          starts_at?: string | null;
          activity_contact_id?: string | null;
          assigned_user_ids?: string[];
          created_at?: string;
        };
        Update: {
          sport_id?: string;
          sport_profile_id?: string | null;
          role?: EventActivityRole;
          activity_type?: EventDecisionType;
          title?: string;
          location?: string | null;
          starts_at?: string | null;
          activity_contact_id?: string | null;
          assigned_user_ids?: string[];
        };
        Relationships: [];
      };
      event_subgroups: {
        Row: {
          id: string;
          event_id: string;
          sport_id: string;
          title: string;
          location: string | null;
          starts_at: string | null;
          activity_contact_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          sport_id: string;
          title: string;
          location?: string | null;
          starts_at?: string | null;
          activity_contact_id?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          location?: string | null;
          starts_at?: string | null;
          activity_contact_id?: string | null;
        };
        Relationships: [];
      };
      event_results: {
        Row: {
          id: string;
          event_id: string;
          activity_id: string | null;
          sport_id: string | null;
          result_type: "summary" | "score" | "ranking";
          summary: string;
          scores: Json;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          activity_id?: string | null;
          sport_id?: string | null;
          result_type?: "summary" | "score" | "ranking";
          summary: string;
          scores?: Json;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          activity_id?: string | null;
          sport_id?: string | null;
          result_type?: "summary" | "score" | "ranking";
          summary?: string;
          scores?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      invitation_codes: {
        Row: {
          code: string;
          created_by: string | null;
          used_by: string | null;
          grants_role: AppRole;
          created_at: string;
          used_at: string | null;
          expires_at: string | null;
        };
        Insert: {
          code: string;
          created_by?: string | null;
          used_by?: string | null;
          grants_role?: AppRole;
          created_at?: string;
          used_at?: string | null;
          expires_at?: string | null;
        };
        Update: {
          used_by?: string | null;
          grants_role?: AppRole;
          used_at?: string | null;
          expires_at?: string | null;
        };
        Relationships: [];
      };
      sport_ideas: {
        Row: {
          id: string;
          name: string | null;
          note: string | null;
          location: string | null;
          preferred_time: string | null;
          sport_id: string | null;
          profile_name: string | null;
          location_mode: "fixed" | "flexible";
          postal_code: string | null;
          location_city: string | null;
          map_url: string | null;
          latitude: number | null;
          longitude: number | null;
          location_type: SportLocationType | null;
          minimum_group_size: number | null;
          maximum_group_size: number | null;
          required_equipment: string[];
          available_equipment: string[];
          cost_note: string | null;
          opening_notes: string | null;
          transit_notes: string | null;
          amenity_notes: string | null;
          reservation_required: boolean | null;
          lighting_available: boolean | null;
          safety_notes: string | null;
          location_rules: string | null;
          ap_required: boolean;
          weather_rules: Json;
          is_draft: boolean;
          draft_step: string;
          review_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          suggested_by: string;
          status: "pending" | "approved" | "rejected";
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          note?: string | null;
          location?: string | null;
          preferred_time?: string | null;
          sport_id?: string | null;
          profile_name?: string | null;
          location_mode?: "fixed" | "flexible";
          postal_code?: string | null;
          location_city?: string | null;
          map_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          location_type?: SportLocationType | null;
          minimum_group_size?: number | null;
          maximum_group_size?: number | null;
          required_equipment?: string[];
          available_equipment?: string[];
          cost_note?: string | null;
          opening_notes?: string | null;
          transit_notes?: string | null;
          amenity_notes?: string | null;
          reservation_required?: boolean | null;
          lighting_available?: boolean | null;
          safety_notes?: string | null;
          location_rules?: string | null;
          ap_required?: boolean;
          weather_rules?: Json;
          is_draft?: boolean;
          draft_step?: string;
          review_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          suggested_by: string;
          status?: "pending" | "approved" | "rejected";
          created_at?: string;
        };
        Update: {
          name?: string | null;
          note?: string | null;
          location?: string | null;
          preferred_time?: string | null;
          sport_id?: string | null;
          profile_name?: string | null;
          location_mode?: "fixed" | "flexible";
          postal_code?: string | null;
          location_city?: string | null;
          map_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          location_type?: SportLocationType | null;
          minimum_group_size?: number | null;
          maximum_group_size?: number | null;
          required_equipment?: string[];
          available_equipment?: string[];
          cost_note?: string | null;
          opening_notes?: string | null;
          transit_notes?: string | null;
          amenity_notes?: string | null;
          reservation_required?: boolean | null;
          lighting_available?: boolean | null;
          safety_notes?: string | null;
          location_rules?: string | null;
          ap_required?: boolean;
          weather_rules?: Json;
          is_draft?: boolean;
          draft_step?: string;
          review_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          status?: "pending" | "approved" | "rejected";
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          club_id: string;
          event_id: string | null;
          sport_id: string | null;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          event_id?: string | null;
          sport_id?: string | null;
          user_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          body?: string;
          sport_id?: string | null;
        };
        Relationships: [];
      };
      direct_chats: {
        Row: {
          id: string;
          requester_id: string;
          admin_id: string;
          status: DirectChatStatus;
          closed_by: string | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
          last_message_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          admin_id: string;
          status?: DirectChatStatus;
          closed_by?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          last_message_at?: string;
        };
        Update: {
          status?: DirectChatStatus;
          closed_by?: string | null;
          closed_at?: string | null;
          updated_at?: string;
          last_message_at?: string;
        };
        Relationships: [];
      };
      direct_chat_messages: {
        Row: {
          id: string;
          chat_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id: string;
          user_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          body?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          platform: "web" | "expo";
          endpoint: string;
          subscription: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          platform: "web" | "expo";
          endpoint: string;
          subscription?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          platform?: "web" | "expo";
          endpoint?: string;
          subscription?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      profile_change_requests: {
        Row: {
          id: string;
          user_id: string;
          requested_display_name: string;
          status: "pending" | "approved" | "rejected";
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          requested_display_name: string;
          status?: "pending" | "approved" | "rejected";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          requested_display_name?: string;
          status?: "pending" | "approved" | "rejected";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      validate_invitation_code: {
        Args: { input_code: string };
        Returns: boolean;
      };
      consume_invitation_code: {
        Args: { input_code: string };
        Returns: boolean;
      };
      create_invitation_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      ensure_mcc_week: {
        Args: Record<PropertyKey, never>;
        Returns: { mcc_club_id: string; mcc_event_id: string }[];
      };
      clear_mcc_test_chat: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      clear_mcc_test_data: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      is_current_mcc_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      deactivate_club_member: {
        Args: { target_user_id: string; reason?: string };
        Returns: boolean;
      };
      admin_upsert_sport: {
        Args: {
          target_sport_id: string | null;
          sport_name: string;
          sport_category: string;
          sport_intensity: SportIntensityLevel;
          sport_location_type: SportLocationType;
          sport_tags?: string[];
          sport_description?: string | null;
          sport_location_description?: string | null;
          sport_is_active?: boolean;
        };
        Returns: {
          id: string;
          name: string;
          description: string | null;
          location_description: string | null;
          category: string;
          icon_name: string | null;
          intensity_level: SportIntensityLevel;
          location_type: SportLocationType;
          combinable_tags: string[];
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
      };
      admin_delete_sport: {
        Args: { target_sport_id: string };
        Returns: boolean;
      };
      admin_update_profile_display_name: {
        Args: { target_user_id: string; next_display_name: string };
        Returns: {
          id: string;
          display_name: string;
          email: string | null;
          phone: string | null;
          postal_code: string | null;
          city: string | null;
          favorite_sports: string | null;
          birth_date: string | null;
          role: AppRole;
          avatar_url: string | null;
          deactivated_at: string | null;
          deactivated_reason: string | null;
          created_at: string;
        };
      };
      admin_upsert_sport_contact: {
        Args: {
          target_sport_id: string;
          target_user_id: string;
          contact_note?: string | null;
          primary_contact?: boolean;
        };
        Returns: {
          id: string;
          sport_id: string;
          user_id: string;
          note: string | null;
          is_primary: boolean;
          created_by: string | null;
          created_at: string;
        };
      };
      admin_delete_sport_contact: {
        Args: { target_sport_id: string; target_user_id: string };
        Returns: boolean;
      };
      review_event_attendance: {
        Args: {
          target_event_id: string;
          target_user_id: string;
          next_actual_status: ActualAttendanceStatus;
        };
        Returns: {
          id: string;
          event_id: string;
          user_id: string;
          status: AttendanceStatus;
          subgroup_id: string | null;
          actual_status: ActualAttendanceStatus | null;
          checked_by: string | null;
          checked_at: string | null;
          created_at: string;
        };
      };
      review_profile_name_change: {
        Args: { request_id: string; next_status: string };
        Returns: {
          id: string;
          user_id: string;
          requested_display_name: string;
          status: "pending" | "approved" | "rejected";
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TableName = keyof Database["public"]["Tables"];
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
export type Update<T extends TableName> = Database["public"]["Tables"][T]["Update"];
