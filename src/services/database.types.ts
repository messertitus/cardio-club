export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ClubMemberRole = "admin" | "mod" | "member";
export type SportIntensityLevel = "low" | "medium" | "high";
export type SportLocationType = "indoor" | "outdoor" | "water" | "field" | "flexible";
export type WeeklyEventStatus = "proposing" | "voting" | "decided" | "completed" | "cancelled";
export type AttendanceStatus = "going" | "maybe" | "not_going";
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
          role: AppRole;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          email?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          city?: string | null;
          role?: AppRole;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          display_name?: string;
          email?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          city?: string | null;
          role?: AppRole;
          avatar_url?: string | null;
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
          category: string;
          intensity_level: SportIntensityLevel;
          location_type: SportLocationType;
          combinable_tags: string[];
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          intensity_level: SportIntensityLevel;
          location_type: SportLocationType;
          combinable_tags?: string[];
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          category?: string;
          intensity_level?: SportIntensityLevel;
          location_type?: SportLocationType;
          combinable_tags?: string[];
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
      attendance: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          status: AttendanceStatus;
          subgroup_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          status?: AttendanceStatus;
          subgroup_id?: string | null;
          created_at?: string;
        };
        Update: {
          status?: AttendanceStatus;
          subgroup_id?: string | null;
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
          created_at?: string;
        };
        Update: {
          was_selected?: boolean;
          voted_for?: boolean;
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
          name: string;
          note: string | null;
          location: string | null;
          preferred_time: string | null;
          suggested_by: string;
          status: "pending" | "approved" | "rejected";
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          note?: string | null;
          location?: string | null;
          preferred_time?: string | null;
          suggested_by: string;
          status?: "pending" | "approved" | "rejected";
          created_at?: string;
        };
        Update: {
          name?: string;
          note?: string | null;
          location?: string | null;
          preferred_time?: string | null;
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TableName = keyof Database["public"]["Tables"];
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
export type Update<T extends TableName> = Database["public"]["Tables"][T]["Update"];
