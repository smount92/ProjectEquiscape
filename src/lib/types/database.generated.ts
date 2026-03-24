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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          horse_id: string | null
          id: string
          image_urls: string[] | null
          likes_count: number | null
          metadata: Json | null
          target_id: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_type: string
          horse_id?: string | null
          id?: string
          image_urls?: string[] | null
          likes_count?: number | null
          metadata?: Json | null
          target_id?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          horse_id?: string | null
          id?: string
          image_urls?: string[] | null
          likes_count?: number | null
          metadata?: Json | null
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_actor_id_users_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_actor_id_users_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_likes: {
        Row: {
          activity_id: string
          created_at: string | null
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string | null
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_likes_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_profiles: {
        Row: {
          accepting_types: string[] | null
          bio_artist: string | null
          created_at: string | null
          max_slots: number | null
          mediums: string[] | null
          paypal_me_link: string | null
          portfolio_visible: boolean | null
          price_range_max: number | null
          price_range_min: number | null
          scales_offered: string[] | null
          specialties: string[] | null
          status: string
          studio_name: string
          studio_slug: string
          terms_text: string | null
          turnaround_max_days: number | null
          turnaround_min_days: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accepting_types?: string[] | null
          bio_artist?: string | null
          created_at?: string | null
          max_slots?: number | null
          mediums?: string[] | null
          paypal_me_link?: string | null
          portfolio_visible?: boolean | null
          price_range_max?: number | null
          price_range_min?: number | null
          scales_offered?: string[] | null
          specialties?: string[] | null
          status?: string
          studio_name: string
          studio_slug: string
          terms_text?: string | null
          turnaround_max_days?: number | null
          turnaround_min_days?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accepting_types?: string[] | null
          bio_artist?: string | null
          created_at?: string | null
          max_slots?: number | null
          mediums?: string[] | null
          paypal_me_link?: string | null
          portfolio_visible?: boolean | null
          price_range_max?: number | null
          price_range_min?: number | null
          scales_offered?: string[] | null
          specialties?: string[] | null
          status?: string
          studio_name?: string
          studio_slug?: string
          terms_text?: string | null
          turnaround_max_days?: number | null
          turnaround_min_days?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          category: string
          created_at: string | null
          description: string
          icon: string
          id: string
          is_active: boolean | null
          name: string
          tier: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          icon: string
          id: string
          is_active?: boolean | null
          name: string
          tier?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          icon?: string
          id?: string
          is_active?: boolean | null
          name?: string
          tier?: number | null
        }
        Relationships: []
      }
      catalog_changelog: {
        Row: {
          approved_by: string | null
          catalog_item_id: string | null
          change_summary: string
          change_type: string
          contributed_by: string | null
          contributor_alias: string
          created_at: string
          id: string
          suggestion_id: string | null
        }
        Insert: {
          approved_by?: string | null
          catalog_item_id?: string | null
          change_summary: string
          change_type: string
          contributed_by?: string | null
          contributor_alias: string
          created_at?: string
          id?: string
          suggestion_id?: string | null
        }
        Update: {
          approved_by?: string | null
          catalog_item_id?: string | null
          change_summary?: string
          change_type?: string
          contributed_by?: string | null
          contributor_alias?: string
          created_at?: string
          id?: string
          suggestion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_changelog_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_changelog_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "catalog_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          attributes: Json | null
          created_at: string
          id: string
          item_type: string
          maker: string
          parent_id: string | null
          scale: string | null
          title: string
        }
        Insert: {
          attributes?: Json | null
          created_at?: string
          id?: string
          item_type: string
          maker: string
          parent_id?: string | null
          scale?: string | null
          title: string
        }
        Update: {
          attributes?: Json | null
          created_at?: string
          id?: string
          item_type?: string
          maker?: string
          parent_id?: string | null
          scale?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_suggestion_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          suggestion_id: string
          user_alias: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          suggestion_id: string
          user_alias: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          suggestion_id?: string
          user_alias?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_suggestion_comments_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "catalog_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_suggestion_votes: {
        Row: {
          created_at: string
          id: string
          suggestion_id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          suggestion_id: string
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          id?: string
          suggestion_id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_suggestion_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "catalog_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_suggestions: {
        Row: {
          admin_notes: string | null
          catalog_item_id: string | null
          created_at: string
          downvotes: number
          field_changes: Json
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggestion_type: string
          updated_at: string
          upvotes: number
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          catalog_item_id?: string | null
          created_at?: string
          downvotes?: number
          field_changes?: Json
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggestion_type: string
          updated_at?: string
          upvotes?: number
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          catalog_item_id?: string | null
          created_at?: string
          downvotes?: number
          field_changes?: Json
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggestion_type?: string
          updated_at?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_suggestions_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_updates: {
        Row: {
          author_id: string
          body: string | null
          commission_id: string
          created_at: string | null
          id: string
          image_urls: string[] | null
          is_visible_to_client: boolean | null
          new_status: string | null
          old_status: string | null
          requires_payment: boolean | null
          title: string | null
          update_type: string
        }
        Insert: {
          author_id: string
          body?: string | null
          commission_id: string
          created_at?: string | null
          id?: string
          image_urls?: string[] | null
          is_visible_to_client?: boolean | null
          new_status?: string | null
          old_status?: string | null
          requires_payment?: boolean | null
          title?: string | null
          update_type: string
        }
        Update: {
          author_id?: string
          body?: string | null
          commission_id?: string
          created_at?: string | null
          id?: string
          image_urls?: string[] | null
          is_visible_to_client?: boolean | null
          new_status?: string | null
          old_status?: string | null
          requires_payment?: boolean | null
          title?: string | null
          update_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_updates_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          actual_completion: string | null
          actual_start: string | null
          artist_id: string
          client_email: string | null
          client_id: string | null
          commission_type: string
          created_at: string | null
          deposit_amount: number | null
          deposit_paid: boolean | null
          description: string
          estimated_completion: string | null
          estimated_start: string | null
          final_paid: boolean | null
          guest_token: string | null
          horse_id: string | null
          id: string
          is_public_in_queue: boolean | null
          last_update_at: string | null
          price_quoted: number | null
          reference_images: string[] | null
          slot_number: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          actual_completion?: string | null
          actual_start?: string | null
          artist_id: string
          client_email?: string | null
          client_id?: string | null
          commission_type: string
          created_at?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          description: string
          estimated_completion?: string | null
          estimated_start?: string | null
          final_paid?: boolean | null
          guest_token?: string | null
          horse_id?: string | null
          id?: string
          is_public_in_queue?: boolean | null
          last_update_at?: string | null
          price_quoted?: number | null
          reference_images?: string[] | null
          slot_number?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          actual_completion?: string | null
          actual_start?: string | null
          artist_id?: string
          client_email?: string | null
          client_id?: string | null
          commission_type?: string
          created_at?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          description?: string
          estimated_completion?: string | null
          estimated_start?: string | null
          final_paid?: boolean | null
          guest_token?: string | null
          horse_id?: string | null
          id?: string
          is_public_in_queue?: boolean | null
          last_update_at?: string | null
          price_quoted?: number | null
          reference_images?: string[] | null
          slot_number?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
        ]
      }
      condition_history: {
        Row: {
          changed_by: string
          created_at: string | null
          horse_id: string
          id: string
          new_condition: string
          note: string | null
          old_condition: string | null
        }
        Insert: {
          changed_by: string
          created_at?: string | null
          horse_id: string
          id?: string
          new_condition: string
          note?: string | null
          old_condition?: string | null
        }
        Update: {
          changed_by?: string
          created_at?: string | null
          horse_id?: string
          id?: string
          new_condition?: string
          note?: string | null
          old_condition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "condition_history_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean
          message: string
          name: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean
          message: string
          name: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean
          message?: string
          name?: string
          subject?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          buyer_id: string
          created_at: string
          horse_id: string | null
          id: string
          seller_id: string
          transaction_status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          horse_id?: string | null
          id?: string
          seller_id: string
          transaction_status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          horse_id?: string | null
          id?: string
          seller_id?: string
          transaction_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
        ]
      }
      customization_logs: {
        Row: {
          artist_alias: string | null
          date_completed: string | null
          horse_id: string
          id: string
          image_urls: string[] | null
          materials_used: string | null
          work_type: string
        }
        Insert: {
          artist_alias?: string | null
          date_completed?: string | null
          horse_id: string
          id?: string
          image_urls?: string[] | null
          materials_used?: string | null
          work_type: string
        }
        Update: {
          artist_alias?: string | null
          date_completed?: string | null
          horse_id?: string
          id?: string
          image_urls?: string[] | null
          materials_used?: string | null
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customization_logs_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
        ]
      }
      database_suggestions: {
        Row: {
          admin_notes: string | null
          created_at: string
          details: string | null
          id: string
          name: string
          status: string
          submitted_by: string
          suggestion_type: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          name: string
          status?: string
          submitted_by: string
          suggestion_type: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          name?: string
          status?: string
          submitted_by?: string
          suggestion_type?: string
        }
        Relationships: []
      }
      event_classes: {
        Row: {
          allowed_scales: string[] | null
          class_number: string | null
          created_at: string | null
          description: string | null
          division_id: string
          id: string
          is_nan_qualifying: boolean | null
          max_entries: number | null
          name: string
          sort_order: number | null
        }
        Insert: {
          allowed_scales?: string[] | null
          class_number?: string | null
          created_at?: string | null
          description?: string | null
          division_id: string
          id?: string
          is_nan_qualifying?: boolean | null
          max_entries?: number | null
          name: string
          sort_order?: number | null
        }
        Update: {
          allowed_scales?: string[] | null
          class_number?: string | null
          created_at?: string | null
          description?: string | null
          division_id?: string
          id?: string
          is_nan_qualifying?: boolean | null
          max_entries?: number | null
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_classes_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "event_divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_comments: {
        Row: {
          content: string
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_divisions: {
        Row: {
          created_at: string | null
          description: string | null
          event_id: string
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_id: string
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_id?: string
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_divisions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_entries: {
        Row: {
          caption: string | null
          class_id: string | null
          class_name: string | null
          created_at: string
          division: string | null
          entry_image_path: string | null
          entry_type: string
          event_id: string
          horse_id: string
          id: string
          judge_critique: string | null
          judge_score: number | null
          notes: string | null
          placing: string | null
          show_string_id: string | null
          time_slot: string | null
          user_id: string
          votes_count: number
        }
        Insert: {
          caption?: string | null
          class_id?: string | null
          class_name?: string | null
          created_at?: string
          division?: string | null
          entry_image_path?: string | null
          entry_type?: string
          event_id: string
          horse_id: string
          id?: string
          judge_critique?: string | null
          judge_score?: number | null
          notes?: string | null
          placing?: string | null
          show_string_id?: string | null
          time_slot?: string | null
          user_id: string
          votes_count?: number
        }
        Update: {
          caption?: string | null
          class_id?: string | null
          class_name?: string | null
          created_at?: string
          division?: string | null
          entry_image_path?: string | null
          entry_type?: string
          event_id?: string
          horse_id?: string
          id?: string
          judge_critique?: string | null
          judge_score?: number | null
          notes?: string | null
          placing?: string | null
          show_string_id?: string | null
          time_slot?: string | null
          user_id?: string
          votes_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_entries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "event_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_entries_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_entries_show_string_id_fkey"
            columns: ["show_string_id"]
            isOneToOne: false
            referencedRelation: "show_strings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_judges: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_judges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_judges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_judges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          event_id: string
          id: string
          image_path: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          image_path: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          image_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          created_at: string | null
          event_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_votes: {
        Row: {
          created_at: string
          entry_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_votes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "event_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          ends_at: string | null
          event_type: string
          group_id: string | null
          id: string
          is_all_day: boolean | null
          is_nan_qualifying: boolean | null
          is_official: boolean | null
          is_virtual: boolean | null
          judging_method: string | null
          location_address: string | null
          location_name: string | null
          name: string
          region: string | null
          rsvp_count: number | null
          sanctioning_body: string | null
          show_id: string | null
          show_status: string | null
          show_theme: string | null
          starts_at: string
          timezone: string | null
          virtual_url: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          ends_at?: string | null
          event_type: string
          group_id?: string | null
          id?: string
          is_all_day?: boolean | null
          is_nan_qualifying?: boolean | null
          is_official?: boolean | null
          is_virtual?: boolean | null
          judging_method?: string | null
          location_address?: string | null
          location_name?: string | null
          name: string
          region?: string | null
          rsvp_count?: number | null
          sanctioning_body?: string | null
          show_id?: string | null
          show_status?: string | null
          show_theme?: string | null
          starts_at: string
          timezone?: string | null
          virtual_url?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          ends_at?: string | null
          event_type?: string
          group_id?: string | null
          id?: string
          is_all_day?: boolean | null
          is_nan_qualifying?: boolean | null
          is_official?: boolean | null
          is_virtual?: boolean | null
          judging_method?: string | null
          location_address?: string | null
          location_name?: string | null
          name?: string
          region?: string | null
          rsvp_count?: number | null
          sanctioning_body?: string | null
          show_id?: string | null
          show_status?: string | null
          show_theme?: string | null
          starts_at?: string
          timezone?: string | null
          virtual_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_horses: {
        Row: {
          created_by: string
          description: string | null
          expires_at: string | null
          featured_at: string
          horse_id: string
          id: string
          title: string
        }
        Insert: {
          created_by: string
          description?: string | null
          expires_at?: string | null
          featured_at?: string
          horse_id: string
          id?: string
          title: string
        }
        Update: {
          created_by?: string
          description?: string | null
          expires_at?: string | null
          featured_at?: string
          horse_id?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_horses_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_vault: {
        Row: {
          estimated_current_value: number | null
          horse_id: string
          id: string
          insurance_notes: string | null
          purchase_date: string | null
          purchase_date_text: string | null
          purchase_price: number | null
        }
        Insert: {
          estimated_current_value?: number | null
          horse_id: string
          id?: string
          insurance_notes?: string | null
          purchase_date?: string | null
          purchase_date_text?: string | null
          purchase_price?: number | null
        }
        Update: {
          estimated_current_value?: number | null
          horse_id?: string
          id?: string
          insurance_notes?: string | null
          purchase_date?: string | null
          purchase_date_text?: string | null
          purchase_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_vault_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: true
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
        ]
      }
      group_channels: {
        Row: {
          created_at: string | null
          description: string | null
          group_id: string
          id: string
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          group_id: string
          id?: string
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          group_id?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_channels_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_files: {
        Row: {
          created_at: string | null
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          group_id: string
          id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          group_id: string
          id?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          group_id?: string
          id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_files_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          group_id: string
          joined_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_post_replies: {
        Row: {
          content: string
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_post_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "group_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_post_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_post_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_posts: {
        Row: {
          content: string
          created_at: string | null
          group_id: string
          horse_id: string | null
          id: string
          image_urls: string[] | null
          is_pinned: boolean | null
          likes_count: number | null
          reply_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          group_id: string
          horse_id?: string | null
          id?: string
          image_urls?: string[] | null
          is_pinned?: boolean | null
          likes_count?: number | null
          reply_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          group_id?: string
          horse_id?: string | null
          id?: string
          image_urls?: string[] | null
          is_pinned?: boolean | null
          likes_count?: number | null
          reply_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_posts_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          banner_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          group_type: string
          icon_url: string | null
          id: string
          member_count: number | null
          name: string
          region: string | null
          slug: string
          updated_at: string | null
          visibility: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          group_type: string
          icon_url?: string | null
          id?: string
          member_count?: number | null
          name: string
          region?: string | null
          slug: string
          updated_at?: string | null
          visibility?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          group_type?: string
          icon_url?: string | null
          id?: string
          member_count?: number | null
          name?: string
          region?: string | null
          slug?: string
          updated_at?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      horse_collections: {
        Row: {
          collection_id: string
          created_at: string
          horse_id: string
          id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          horse_id: string
          id?: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          horse_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "user_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_collections_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
        ]
      }
      horse_favorites: {
        Row: {
          created_at: string
          horse_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          horse_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          horse_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_favorites_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
        ]
      }
      horse_images: {
        Row: {
          angle_profile: Database["public"]["Enums"]["angle_profile"]
          horse_id: string
          id: string
          image_url: string
          sort_order: number
          uploaded_at: string
        }
        Insert: {
          angle_profile: Database["public"]["Enums"]["angle_profile"]
          horse_id: string
          id?: string
          image_url: string
          sort_order?: number
          uploaded_at?: string
        }
        Update: {
          angle_profile?: Database["public"]["Enums"]["angle_profile"]
          horse_id?: string
          id?: string
          image_url?: string
          sort_order?: number
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_images_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
        ]
      }
      horse_ownership_history: {
        Row: {
          acquired_at: string
          acquisition_type: string
          created_at: string
          horse_id: string
          horse_name: string | null
          horse_thumbnail: string | null
          id: string
          is_price_public: boolean | null
          notes: string | null
          owner_alias: string
          owner_id: string | null
          released_at: string | null
          sale_price: number | null
        }
        Insert: {
          acquired_at?: string
          acquisition_type?: string
          created_at?: string
          horse_id: string
          horse_name?: string | null
          horse_thumbnail?: string | null
          id?: string
          is_price_public?: boolean | null
          notes?: string | null
          owner_alias: string
          owner_id?: string | null
          released_at?: string | null
          sale_price?: number | null
        }
        Update: {
          acquired_at?: string
          acquisition_type?: string
          created_at?: string
          horse_id?: string
          horse_name?: string | null
          horse_thumbnail?: string | null
          id?: string
          is_price_public?: boolean | null
          notes?: string | null
          owner_alias?: string
          owner_id?: string | null
          released_at?: string | null
          sale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "horse_ownership_history_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_ownership_history_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_ownership_history_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      horse_pedigrees: {
        Row: {
          cast_number: string | null
          created_at: string
          dam_id: string | null
          dam_name: string | null
          edition_size: string | null
          horse_id: string
          id: string
          lineage_notes: string | null
          sculptor: string | null
          sire_id: string | null
          sire_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cast_number?: string | null
          created_at?: string
          dam_id?: string | null
          dam_name?: string | null
          edition_size?: string | null
          horse_id: string
          id?: string
          lineage_notes?: string | null
          sculptor?: string | null
          sire_id?: string | null
          sire_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cast_number?: string | null
          created_at?: string
          dam_id?: string | null
          dam_name?: string | null
          edition_size?: string | null
          horse_id?: string
          id?: string
          lineage_notes?: string | null
          sculptor?: string | null
          sire_id?: string | null
          sire_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_pedigrees_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_pedigrees_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_pedigrees_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
        ]
      }
      horse_photo_stages: {
        Row: {
          horse_id: string
          id: string
          image_id: string
          stage: string
          stage_label: string | null
          tagged_at: string
        }
        Insert: {
          horse_id: string
          id?: string
          image_id: string
          stage: string
          stage_label?: string | null
          tagged_at?: string
        }
        Update: {
          horse_id?: string
          id?: string
          image_id?: string
          stage?: string
          stage_label?: string | null
          tagged_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_photo_stages_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_photo_stages_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "horse_images"
            referencedColumns: ["id"]
          },
        ]
      }
      horse_transfers: {
        Row: {
          acquisition_type: string
          claim_pin: string | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          expires_at: string
          horse_id: string
          id: string
          is_price_public: boolean | null
          notes: string | null
          sale_price: number | null
          sender_id: string
          status: string
          transfer_code: string
        }
        Insert: {
          acquisition_type?: string
          claim_pin?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          expires_at?: string
          horse_id: string
          id?: string
          is_price_public?: boolean | null
          notes?: string | null
          sale_price?: number | null
          sender_id: string
          status?: string
          transfer_code: string
        }
        Update: {
          acquisition_type?: string
          claim_pin?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          expires_at?: string
          horse_id?: string
          id?: string
          is_price_public?: boolean | null
          notes?: string | null
          sale_price?: number | null
          sender_id?: string
          status?: string
          transfer_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_transfers_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
        ]
      }
      id_requests: {
        Row: {
          accepted_suggestion_id: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string
          status: string
          user_id: string
        }
        Insert: {
          accepted_suggestion_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url: string
          status?: string
          user_id: string
        }
        Update: {
          accepted_suggestion_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      id_suggestions: {
        Row: {
          catalog_id: string | null
          created_at: string | null
          free_text: string | null
          id: string
          request_id: string
          upvotes: number | null
          user_id: string
        }
        Insert: {
          catalog_id?: string | null
          created_at?: string | null
          free_text?: string | null
          id?: string
          request_id: string
          upvotes?: number | null
          user_id: string
        }
        Update: {
          catalog_id?: string | null
          created_at?: string | null
          free_text?: string | null
          id?: string
          request_id?: string
          upvotes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "id_suggestions_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "id_suggestions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "id_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      media_attachments: {
        Row: {
          caption: string | null
          commission_id: string | null
          created_at: string
          event_id: string | null
          help_request_id: string | null
          id: string
          message_id: string | null
          post_id: string | null
          storage_path: string
          uploader_id: string
        }
        Insert: {
          caption?: string | null
          commission_id?: string | null
          created_at?: string
          event_id?: string | null
          help_request_id?: string | null
          id?: string
          message_id?: string | null
          post_id?: string | null
          storage_path: string
          uploader_id: string
        }
        Update: {
          caption?: string | null
          commission_id?: string | null
          created_at?: string
          event_id?: string | null
          help_request_id?: string | null
          id?: string
          message_id?: string | null
          post_id?: string | null
          storage_path?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_attachments_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_help_request_id_fkey"
            columns: ["help_request_id"]
            isOneToOne: false
            referencedRelation: "id_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
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
      notifications: {
        Row: {
          actor_id: string | null
          content: string | null
          conversation_id: string | null
          created_at: string
          horse_id: string | null
          id: string
          is_read: boolean
          link_url: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          horse_id?: string | null
          id?: string
          is_read?: boolean
          link_url?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          horse_id?: string | null
          id?: string
          is_read?: boolean
          link_url?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_users_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_actor_id_users_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          channel_id: string | null
          content: string
          created_at: string
          event_id: string | null
          group_id: string | null
          help_request_id: string | null
          horse_id: string | null
          id: string
          is_pinned: boolean
          likes_count: number
          parent_id: string | null
          replies_count: number
          show_id: string | null
          studio_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          channel_id?: string | null
          content: string
          created_at?: string
          event_id?: string | null
          group_id?: string | null
          help_request_id?: string | null
          horse_id?: string | null
          id?: string
          is_pinned?: boolean
          likes_count?: number
          parent_id?: string | null
          replies_count?: number
          show_id?: string | null
          studio_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          channel_id?: string | null
          content?: string
          created_at?: string
          event_id?: string | null
          group_id?: string | null
          help_request_id?: string | null
          horse_id?: string | null
          id?: string
          is_pinned?: boolean
          likes_count?: number
          parent_id?: string | null
          replies_count?: number
          show_id?: string | null
          studio_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "group_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_help_request_id_fkey"
            columns: ["help_request_id"]
            isOneToOne: false
            referencedRelation: "id_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          attempts: number
          endpoint: string
          id: string
          identifier: string
          window_start: string
        }
        Insert: {
          attempts?: number
          endpoint: string
          id?: string
          identifier: string
          window_start?: string
        }
        Update: {
          attempts?: number
          endpoint?: string
          id?: string
          identifier?: string
          window_start?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          content: string | null
          created_at: string
          id: string
          reviewer_id: string
          stars: number
          target_id: string
          transaction_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          reviewer_id: string
          stars: number
          target_id: string
          transaction_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          reviewer_id?: string
          stars?: number
          target_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      show_records: {
        Row: {
          award_category: string | null
          class_name: string | null
          competition_level: string | null
          created_at: string
          division: string | null
          horse_id: string
          id: string
          is_nan: boolean
          is_nan_qualifying: boolean | null
          judge_critique: string | null
          judge_name: string | null
          judge_notes: string | null
          judge_user_id: string | null
          nan_card_type: string | null
          nan_year: number | null
          notes: string | null
          placing: string | null
          ribbon_color: string | null
          sanctioning_body: string | null
          section_name: string | null
          show_date: string | null
          show_date_text: string | null
          show_location: string | null
          show_name: string
          show_type: string | null
          total_class_entries: number | null
          total_entries: number | null
          user_id: string
          verification_tier: string | null
          verified_by: string | null
        }
        Insert: {
          award_category?: string | null
          class_name?: string | null
          competition_level?: string | null
          created_at?: string
          division?: string | null
          horse_id: string
          id?: string
          is_nan?: boolean
          is_nan_qualifying?: boolean | null
          judge_critique?: string | null
          judge_name?: string | null
          judge_notes?: string | null
          judge_user_id?: string | null
          nan_card_type?: string | null
          nan_year?: number | null
          notes?: string | null
          placing?: string | null
          ribbon_color?: string | null
          sanctioning_body?: string | null
          section_name?: string | null
          show_date?: string | null
          show_date_text?: string | null
          show_location?: string | null
          show_name: string
          show_type?: string | null
          total_class_entries?: number | null
          total_entries?: number | null
          user_id: string
          verification_tier?: string | null
          verified_by?: string | null
        }
        Update: {
          award_category?: string | null
          class_name?: string | null
          competition_level?: string | null
          created_at?: string
          division?: string | null
          horse_id?: string
          id?: string
          is_nan?: boolean
          is_nan_qualifying?: boolean | null
          judge_critique?: string | null
          judge_name?: string | null
          judge_notes?: string | null
          judge_user_id?: string | null
          nan_card_type?: string | null
          nan_year?: number | null
          notes?: string | null
          placing?: string | null
          ribbon_color?: string | null
          sanctioning_body?: string | null
          section_name?: string | null
          show_date?: string | null
          show_date_text?: string | null
          show_location?: string | null
          show_name?: string
          show_type?: string | null
          total_class_entries?: number | null
          total_entries?: number | null
          user_id?: string
          verification_tier?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "show_records_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_records_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_records_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      show_string_entries: {
        Row: {
          class_id: string | null
          class_name: string
          created_at: string | null
          division: string | null
          horse_id: string
          id: string
          notes: string | null
          show_string_id: string
          time_slot: string | null
        }
        Insert: {
          class_id?: string | null
          class_name: string
          created_at?: string | null
          division?: string | null
          horse_id: string
          id?: string
          notes?: string | null
          show_string_id: string
          time_slot?: string | null
        }
        Update: {
          class_id?: string | null
          class_name?: string
          created_at?: string | null
          division?: string | null
          horse_id?: string
          id?: string
          notes?: string | null
          show_string_id?: string
          time_slot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "show_string_entries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "event_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_string_entries_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_string_entries_show_string_id_fkey"
            columns: ["show_string_id"]
            isOneToOne: false
            referencedRelation: "show_strings"
            referencedColumns: ["id"]
          },
        ]
      }
      show_strings: {
        Row: {
          created_at: string | null
          id: string
          name: string
          notes: string | null
          show_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          show_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          show_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_strings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_strings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          accepted_at: string | null
          commission_id: string | null
          completed_at: string | null
          conversation_id: string | null
          created_at: string
          horse_id: string | null
          id: string
          metadata: Json | null
          offer_amount: number | null
          offer_message: string | null
          paid_at: string | null
          party_a_id: string
          party_b_id: string | null
          status: string
          type: string
          verified_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          commission_id?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          horse_id?: string | null
          id?: string
          metadata?: Json | null
          offer_amount?: number | null
          offer_message?: string | null
          paid_at?: string | null
          party_a_id: string
          party_b_id?: string | null
          status?: string
          type: string
          verified_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          commission_id?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          horse_id?: string | null
          id?: string
          metadata?: Json | null
          offer_amount?: number | null
          offer_message?: string | null
          paid_at?: string | null
          party_a_id?: string
          party_b_id?: string | null
          status?: string
          type?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_party_a_id_fkey"
            columns: ["party_a_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_party_a_id_fkey"
            columns: ["party_a_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_party_b_id_fkey"
            columns: ["party_b_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_party_b_id_fkey"
            columns: ["party_b_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      user_horses: {
        Row: {
          asset_category: string
          assigned_age: string | null
          assigned_breed: string | null
          assigned_gender: string | null
          catalog_id: string | null
          collection_id: string | null
          condition_grade: string | null
          created_at: string
          custom_name: string
          deleted_at: string | null
          edition_number: number | null
          edition_size: number | null
          finish_details: string | null
          finish_type: Database["public"]["Enums"]["finish_type"] | null
          finishing_artist: string | null
          finishing_artist_verified: boolean | null
          id: string
          is_for_sale: boolean
          is_public: boolean
          life_stage: string | null
          listing_price: number | null
          marketplace_notes: string | null
          owner_id: string
          public_notes: string | null
          regional_id: string | null
          sculptor: string | null
          trade_status: string
          visibility: string
        }
        Insert: {
          asset_category?: string
          assigned_age?: string | null
          assigned_breed?: string | null
          assigned_gender?: string | null
          catalog_id?: string | null
          collection_id?: string | null
          condition_grade?: string | null
          created_at?: string
          custom_name: string
          deleted_at?: string | null
          edition_number?: number | null
          edition_size?: number | null
          finish_details?: string | null
          finish_type?: Database["public"]["Enums"]["finish_type"] | null
          finishing_artist?: string | null
          finishing_artist_verified?: boolean | null
          id?: string
          is_for_sale?: boolean
          is_public?: boolean
          life_stage?: string | null
          listing_price?: number | null
          marketplace_notes?: string | null
          owner_id: string
          public_notes?: string | null
          regional_id?: string | null
          sculptor?: string | null
          trade_status?: string
          visibility?: string
        }
        Update: {
          asset_category?: string
          assigned_age?: string | null
          assigned_breed?: string | null
          assigned_gender?: string | null
          catalog_id?: string | null
          collection_id?: string | null
          condition_grade?: string | null
          created_at?: string
          custom_name?: string
          deleted_at?: string | null
          edition_number?: number | null
          edition_size?: number | null
          finish_details?: string | null
          finish_type?: Database["public"]["Enums"]["finish_type"] | null
          finishing_artist?: string | null
          finishing_artist_verified?: boolean | null
          id?: string
          is_for_sale?: boolean
          is_public?: boolean
          life_stage?: string | null
          listing_price?: number | null
          marketplace_notes?: string | null
          owner_id?: string
          public_notes?: string | null
          regional_id?: string | null
          sculptor?: string | null
          trade_status?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_horses_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_horses_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "user_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_horses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_horses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reports: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      user_wishlists: {
        Row: {
          catalog_id: string | null
          created_at: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          catalog_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          catalog_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_wishlists_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          account_status: string
          alias_name: string
          approved_suggestions_count: number
          avatar_url: string | null
          bio: string | null
          created_at: string
          currency_symbol: string | null
          default_horse_public: boolean | null
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          is_test_account: boolean
          is_trusted_curator: boolean
          is_verified: boolean
          notification_prefs: Json | null
          pref_simple_mode: boolean
          role: string | null
          show_badges: boolean
          watermark_photos: boolean | null
        }
        Insert: {
          account_status?: string
          alias_name: string
          approved_suggestions_count?: number
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          currency_symbol?: string | null
          default_horse_public?: boolean | null
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_test_account?: boolean
          is_trusted_curator?: boolean
          is_verified?: boolean
          notification_prefs?: Json | null
          pref_simple_mode?: boolean
          role?: string | null
          show_badges?: boolean
          watermark_photos?: boolean | null
        }
        Update: {
          account_status?: string
          alias_name?: string
          approved_suggestions_count?: number
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          currency_symbol?: string | null
          default_horse_public?: boolean | null
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_test_account?: boolean
          is_trusted_curator?: boolean
          is_verified?: boolean
          notification_prefs?: Json | null
          pref_simple_mode?: boolean
          role?: string | null
          show_badges?: boolean
          watermark_photos?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      discover_users_view: {
        Row: {
          alias_name: string | null
          avatar_url: string | null
          avg_rating: number | null
          bio: string | null
          created_at: string | null
          has_studio: boolean | null
          id: string | null
          public_horse_count: number | null
          rating_count: number | null
        }
        Insert: {
          alias_name?: string | null
          avatar_url?: string | null
          avg_rating?: never
          bio?: string | null
          created_at?: string | null
          has_studio?: never
          id?: string | null
          public_horse_count?: never
          rating_count?: never
        }
        Update: {
          alias_name?: string | null
          avatar_url?: string | null
          avg_rating?: never
          bio?: string | null
          created_at?: string | null
          has_studio?: never
          id?: string | null
          public_horse_count?: never
          rating_count?: never
        }
        Relationships: []
      }
      mv_market_prices: {
        Row: {
          average_price: number | null
          catalog_id: string | null
          finish_type: Database["public"]["Enums"]["finish_type"] | null
          highest_price: number | null
          last_sold_at: string | null
          life_stage: string | null
          lowest_price: number | null
          median_price: number | null
          transaction_volume: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_horses_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      v_horse_hoofprint: {
        Row: {
          created_at: string | null
          description: string | null
          event_date: string | null
          event_type: string | null
          horse_id: string | null
          is_public: boolean | null
          metadata: Json | null
          source_id: string | null
          source_table: string | null
          title: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_post_reply: {
        Args: {
          p_author_id: string
          p_content: string
          p_event_id?: string
          p_group_id?: string
          p_horse_id?: string
          p_parent_id: string
        }
        Returns: string
      }
      auto_unpark_expired_transfers: { Args: never; Returns: undefined }
      batch_import_horses: {
        Args: { p_horses: Json; p_user_id: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_max_attempts: number
          p_window_interval: string
        }
        Returns: boolean
      }
      claim_parked_horse_atomic: {
        Args: { p_claimant_id: string; p_pin: string }
        Returns: Json
      }
      claim_transfer_atomic: {
        Args: { p_claimant_id: string; p_code: string }
        Returns: Json
      }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      cleanup_system_garbage: { Args: never; Returns: Json }
      close_virtual_show: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: Json
      }
      increment_approved_suggestions: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      make_offer_atomic: {
        Args: {
          p_buyer_id: string
          p_conversation_id: string
          p_horse_id: string
          p_is_bundle?: boolean
          p_message?: string
          p_offered_price: number
          p_seller_id: string
        }
        Returns: Json
      }
      refresh_market_prices: { Args: never; Returns: undefined }
      respond_to_offer_atomic: {
        Args: {
          p_action: string
          p_seller_id: string
          p_transaction_id: string
        }
        Returns: Json
      }
      search_catalog_fuzzy: {
        Args: { max_results?: number; search_term: string }
        Returns: {
          id: string
          item_type: string
          parent_id: string
          parent_title: string
          similarity: number
          title: string
        }[]
      }
      soft_delete_account: { Args: { target_uid: string }; Returns: undefined }
      toggle_activity_like: {
        Args: { p_activity_id: string; p_user_id: string }
        Returns: Json
      }
      toggle_post_like: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: Json
      }
      toggle_show_vote: {
        Args: { p_entry_id: string; p_user_id: string }
        Returns: Json
      }
      upvote_suggestion: {
        Args: { p_suggestion_id: string }
        Returns: undefined
      }
      vote_for_entry: {
        Args: { p_entry_id: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      angle_profile:
        | "Primary_Thumbnail"
        | "Left_Side"
        | "Right_Side"
        | "Front_Chest"
        | "Back_Hind"
        | "Detail_Face_Eyes"
        | "Detail_Ears"
        | "Detail_Hooves"
        | "Flaw_Rub_Damage"
        | "Other"
        | "Belly_Makers_Mark"
        | "extra_detail"
      finish_type: "OF" | "Custom" | "Artist Resin"
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
      angle_profile: [
        "Primary_Thumbnail",
        "Left_Side",
        "Right_Side",
        "Front_Chest",
        "Back_Hind",
        "Detail_Face_Eyes",
        "Detail_Ears",
        "Detail_Hooves",
        "Flaw_Rub_Damage",
        "Other",
        "Belly_Makers_Mark",
        "extra_detail",
      ],
      finish_type: ["OF", "Custom", "Artist Resin"],
    },
  },
} as const
