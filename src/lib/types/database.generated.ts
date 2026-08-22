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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
          {
            foreignKeyName: "activity_events_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
      announcements: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          link_url: string | null
          message: string
          placement: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          link_url?: string | null
          message: string
          placement?: string
          starts_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          link_url?: string | null
          message?: string
          placement?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_profiles: {
        Row: {
          accepting_types: string[] | null
          accepts_rush: boolean | null
          bio_artist: string | null
          client_ships_model: boolean | null
          created_at: string | null
          deposit_percent: number | null
          deposit_refundable_before_start: boolean | null
          extra_revision_fee: number | null
          kill_fee_percent: number | null
          max_slots: number | null
          mediums: string[] | null
          paypal_me_link: string | null
          portfolio_visible: boolean | null
          price_range_max: number | null
          price_range_min: number | null
          revisions_included: number | null
          scales_offered: string[] | null
          services: Json
          shipping_note: string | null
          specialties: string[] | null
          status: string
          status_note: string | null
          studio_name: string
          studio_slug: string
          terms_text: string | null
          terms_updated_at: string | null
          turnaround_max_days: number | null
          turnaround_min_days: number | null
          updated_at: string | null
          user_id: string
          waitlist_open: boolean
        }
        Insert: {
          accepting_types?: string[] | null
          accepts_rush?: boolean | null
          bio_artist?: string | null
          client_ships_model?: boolean | null
          created_at?: string | null
          deposit_percent?: number | null
          deposit_refundable_before_start?: boolean | null
          extra_revision_fee?: number | null
          kill_fee_percent?: number | null
          max_slots?: number | null
          mediums?: string[] | null
          paypal_me_link?: string | null
          portfolio_visible?: boolean | null
          price_range_max?: number | null
          price_range_min?: number | null
          revisions_included?: number | null
          scales_offered?: string[] | null
          services?: Json
          shipping_note?: string | null
          specialties?: string[] | null
          status?: string
          status_note?: string | null
          studio_name: string
          studio_slug: string
          terms_text?: string | null
          terms_updated_at?: string | null
          turnaround_max_days?: number | null
          turnaround_min_days?: number | null
          updated_at?: string | null
          user_id: string
          waitlist_open?: boolean
        }
        Update: {
          accepting_types?: string[] | null
          accepts_rush?: boolean | null
          bio_artist?: string | null
          client_ships_model?: boolean | null
          created_at?: string | null
          deposit_percent?: number | null
          deposit_refundable_before_start?: boolean | null
          extra_revision_fee?: number | null
          kill_fee_percent?: number | null
          max_slots?: number | null
          mediums?: string[] | null
          paypal_me_link?: string | null
          portfolio_visible?: boolean | null
          price_range_max?: number | null
          price_range_min?: number | null
          revisions_included?: number | null
          scales_offered?: string[] | null
          services?: Json
          shipping_note?: string | null
          specialties?: string[] | null
          status?: string
          status_note?: string | null
          studio_name?: string
          studio_slug?: string
          terms_text?: string | null
          terms_updated_at?: string | null
          turnaround_max_days?: number | null
          turnaround_min_days?: number | null
          updated_at?: string | null
          user_id?: string
          waitlist_open?: boolean
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
      barn_join_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          group_id: string
          message: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          group_id: string
          message?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          group_id?: string
          message?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barn_join_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barn_join_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "barn_join_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barn_join_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barn_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barn_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "barn_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          artist: string | null
          attributes: Json | null
          created_at: string
          id: string
          item_type: string
          maker: string
          maker_slug: string | null
          manufacturer: string | null
          parent_id: string | null
          scale: string | null
          slug: string | null
          title: string
        }
        Insert: {
          artist?: string | null
          attributes?: Json | null
          created_at?: string
          id?: string
          item_type: string
          maker: string
          maker_slug?: string | null
          manufacturer?: string | null
          parent_id?: string | null
          scale?: string | null
          slug?: string | null
          title: string
        }
        Update: {
          artist?: string | null
          attributes?: Json | null
          created_at?: string
          id?: string
          item_type?: string
          maker?: string
          maker_slug?: string | null
          manufacturer?: string | null
          parent_id?: string | null
          scale?: string | null
          slug?: string | null
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
          accepted_at: string | null
          actual_completion: string | null
          actual_start: string | null
          agreed_price: number | null
          artist_id: string
          budget_amount: number | null
          client_email: string | null
          client_id: string | null
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          commission_type: string
          completed_at: string | null
          created_at: string | null
          deposit_amount: number | null
          deposit_paid: boolean | null
          deposit_paid_at: string | null
          description: string
          estimated_completion: string | null
          estimated_start: string | null
          final_paid: boolean | null
          final_paid_at: string | null
          guest_token: string | null
          horse_id: string | null
          id: string
          is_public_in_queue: boolean | null
          is_waitlist: boolean
          last_update_at: string | null
          model_received: boolean
          model_received_at: string | null
          payment_note: string | null
          price_quoted: number | null
          queue_position: number | null
          quote_note: string | null
          quoted_at: string | null
          reference_images: string[] | null
          revisions_included: number | null
          revisions_used: number
          service_scale: string | null
          shipped_at: string | null
          slot_number: number | null
          started_at: string | null
          status: string
          terms_snapshot: Json | null
          tracking_note: string | null
          updated_at: string | null
          vault_recorded_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          actual_completion?: string | null
          actual_start?: string | null
          agreed_price?: number | null
          artist_id: string
          budget_amount?: number | null
          client_email?: string | null
          client_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          commission_type: string
          completed_at?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          deposit_paid_at?: string | null
          description: string
          estimated_completion?: string | null
          estimated_start?: string | null
          final_paid?: boolean | null
          final_paid_at?: string | null
          guest_token?: string | null
          horse_id?: string | null
          id?: string
          is_public_in_queue?: boolean | null
          is_waitlist?: boolean
          last_update_at?: string | null
          model_received?: boolean
          model_received_at?: string | null
          payment_note?: string | null
          price_quoted?: number | null
          queue_position?: number | null
          quote_note?: string | null
          quoted_at?: string | null
          reference_images?: string[] | null
          revisions_included?: number | null
          revisions_used?: number
          service_scale?: string | null
          shipped_at?: string | null
          slot_number?: number | null
          started_at?: string | null
          status?: string
          terms_snapshot?: Json | null
          tracking_note?: string | null
          updated_at?: string | null
          vault_recorded_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          actual_completion?: string | null
          actual_start?: string | null
          agreed_price?: number | null
          artist_id?: string
          budget_amount?: number | null
          client_email?: string | null
          client_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          commission_type?: string
          completed_at?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          deposit_paid_at?: string | null
          description?: string
          estimated_completion?: string | null
          estimated_start?: string | null
          final_paid?: boolean | null
          final_paid_at?: string | null
          guest_token?: string | null
          horse_id?: string | null
          id?: string
          is_public_in_queue?: boolean | null
          is_waitlist?: boolean
          last_update_at?: string | null
          model_received?: boolean
          model_received_at?: string | null
          payment_note?: string | null
          price_quoted?: number | null
          queue_position?: number | null
          quote_note?: string | null
          quoted_at?: string | null
          reference_images?: string[] | null
          revisions_included?: number | null
          revisions_used?: number
          service_scale?: string | null
          shipped_at?: string | null
          slot_number?: number | null
          started_at?: string | null
          status?: string
          terms_snapshot?: Json | null
          tracking_note?: string | null
          updated_at?: string | null
          vault_recorded_at?: string | null
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "commissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "commissions_closed_by_fkey"
            columns: ["closed_by"]
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
          {
            foreignKeyName: "commissions_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
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
          {
            foreignKeyName: "condition_history_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
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
      conversation_participants: {
        Row: {
          archived: boolean
          conversation_id: string
          joined_at: string
          last_read_at: string | null
          muted: boolean
          party: string | null
          role: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          conversation_id: string
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          party?: string | null
          role?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          conversation_id?: string
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          party?: string | null
          role?: string
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
          buyer_id: string
          commission_id: string | null
          completion_confirmed_by_buyer_at: string | null
          completion_confirmed_by_seller_at: string | null
          created_at: string
          deal_kind: string | null
          deal_terms: Json | null
          dispute_reason: string | null
          disputed_at: string | null
          disputed_by: string | null
          horse_id: string | null
          id: string
          last_message_at: string | null
          last_message_kind: string | null
          last_message_preview: string | null
          last_message_sender: string | null
          seller_id: string
          transaction_status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          commission_id?: string | null
          completion_confirmed_by_buyer_at?: string | null
          completion_confirmed_by_seller_at?: string | null
          created_at?: string
          deal_kind?: string | null
          deal_terms?: Json | null
          dispute_reason?: string | null
          disputed_at?: string | null
          disputed_by?: string | null
          horse_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_kind?: string | null
          last_message_preview?: string | null
          last_message_sender?: string | null
          seller_id: string
          transaction_status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          commission_id?: string | null
          completion_confirmed_by_buyer_at?: string | null
          completion_confirmed_by_seller_at?: string | null
          created_at?: string
          deal_kind?: string | null
          deal_terms?: Json | null
          dispute_reason?: string | null
          disputed_at?: string | null
          disputed_by?: string | null
          horse_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_kind?: string | null
          last_message_preview?: string | null
          last_message_sender?: string | null
          seller_id?: string
          transaction_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
          },
        ]
      }
      customization_logs: {
        Row: {
          artist_alias: string | null
          artist_user_id: string | null
          commission_id: string | null
          created_at: string
          date_completed: string | null
          horse_id: string
          id: string
          image_urls: string[] | null
          materials_used: string | null
          work_type: string
        }
        Insert: {
          artist_alias?: string | null
          artist_user_id?: string | null
          commission_id?: string | null
          created_at?: string
          date_completed?: string | null
          horse_id: string
          id?: string
          image_urls?: string[] | null
          materials_used?: string | null
          work_type: string
        }
        Update: {
          artist_alias?: string | null
          artist_user_id?: string | null
          commission_id?: string | null
          created_at?: string
          date_completed?: string | null
          horse_id?: string
          id?: string
          image_urls?: string[] | null
          materials_used?: string | null
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customization_logs_artist_user_id_fkey"
            columns: ["artist_user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customization_logs_artist_user_id_fkey"
            columns: ["artist_user_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customization_logs_artist_user_id_fkey"
            columns: ["artist_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customization_logs_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customization_logs_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customization_logs_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
          non_horse: boolean | null
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
          non_horse?: boolean | null
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
          non_horse?: boolean | null
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
            foreignKeyName: "event_entries_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
      exhibitor_career: {
        Row: {
          career_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          career_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          career_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibitor_career_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_career_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "exhibitor_career_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibitor_distinctions: {
        Row: {
          distinction_code: string
          evidence: Json | null
          granted_at: string
          user_id: string
        }
        Insert: {
          distinction_code: string
          evidence?: Json | null
          granted_at?: string
          user_id: string
        }
        Update: {
          distinction_code?: string
          evidence?: Json | null
          granted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibitor_distinctions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_distinctions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "exhibitor_distinctions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      external_shows: {
        Row: {
          created_at: string
          description: string
          entries_close_on: string | null
          host_name: string
          id: string
          location: string | null
          platform: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          starts_on: string
          status: string
          submitted_by: string
          title: string
          url: string
          venue_type: string
        }
        Insert: {
          created_at?: string
          description?: string
          entries_close_on?: string | null
          host_name: string
          id?: string
          location?: string | null
          platform: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          starts_on: string
          status?: string
          submitted_by: string
          title: string
          url: string
          venue_type: string
        }
        Update: {
          created_at?: string
          description?: string
          entries_close_on?: string | null
          host_name?: string
          id?: string
          location?: string | null
          platform?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          starts_on?: string
          status?: string
          submitted_by?: string
          title?: string
          url?: string
          venue_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_shows_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_shows_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "external_shows_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_shows_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_shows_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "external_shows_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
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
          {
            foreignKeyName: "featured_horses_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
          },
        ]
      }
      financial_vault: {
        Row: {
          commission_cost: number | null
          commission_notes: string | null
          estimated_current_value: number | null
          horse_id: string
          id: string
          insurance_notes: string | null
          is_trade: boolean
          purchase_date: string | null
          purchase_date_text: string | null
          purchase_price: number | null
        }
        Insert: {
          commission_cost?: number | null
          commission_notes?: string | null
          estimated_current_value?: number | null
          horse_id: string
          id?: string
          insurance_notes?: string | null
          is_trade?: boolean
          purchase_date?: string | null
          purchase_date_text?: string | null
          purchase_price?: number | null
        }
        Update: {
          commission_cost?: number | null
          commission_notes?: string | null
          estimated_current_value?: number | null
          horse_id?: string
          id?: string
          insurance_notes?: string | null
          is_trade?: boolean
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
          {
            foreignKeyName: "financial_vault_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: true
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
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
      group_last_read: {
        Row: {
          group_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_last_read_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_last_read_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_last_read_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "group_last_read_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            foreignKeyName: "group_posts_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
          is_private: boolean
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
          is_private?: boolean
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
          is_private?: boolean
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
      horse_career: {
        Row: {
          career_points: number
          horse_id: string
          updated_at: string
        }
        Insert: {
          career_points?: number
          horse_id: string
          updated_at?: string
        }
        Update: {
          career_points?: number
          horse_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_career_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: true
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_career_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: true
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
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
          {
            foreignKeyName: "horse_collections_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
          },
        ]
      }
      horse_documents: {
        Row: {
          body_md: string
          created_at: string
          horse_id: string
          id: string
          kind: string
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body_md: string
          created_at?: string
          horse_id: string
          id?: string
          kind?: string
          owner_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body_md?: string
          created_at?: string
          horse_id?: string
          id?: string
          kind?: string
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_documents_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_documents_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
          },
          {
            foreignKeyName: "horse_documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "horse_documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          {
            foreignKeyName: "horse_favorites_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
          },
        ]
      }
      horse_images: {
        Row: {
          angle_profile: Database["public"]["Enums"]["angle_profile"]
          horse_id: string
          id: string
          image_url: string
          short_slug: string | null
          sort_order: number
          uploaded_at: string
        }
        Insert: {
          angle_profile: Database["public"]["Enums"]["angle_profile"]
          horse_id: string
          id?: string
          image_url: string
          short_slug?: string | null
          sort_order?: number
          uploaded_at?: string
        }
        Update: {
          angle_profile?: Database["public"]["Enums"]["angle_profile"]
          horse_id?: string
          id?: string
          image_url?: string
          short_slug?: string | null
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
          {
            foreignKeyName: "horse_images_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
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
            foreignKeyName: "horse_ownership_history_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            foreignKeyName: "horse_pedigrees_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
          },
          {
            foreignKeyName: "horse_pedigrees_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_pedigrees_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
          },
          {
            foreignKeyName: "horse_pedigrees_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_pedigrees_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
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
            foreignKeyName: "horse_photo_stages_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
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
      horse_titles: {
        Row: {
          evidence: Json | null
          granted_at: string
          horse_id: string
          id: string
          show_year: number | null
          title_code: string
        }
        Insert: {
          evidence?: Json | null
          granted_at?: string
          horse_id: string
          id?: string
          show_year?: number | null
          title_code: string
        }
        Update: {
          evidence?: Json | null
          granted_at?: string
          horse_id?: string
          id?: string
          show_year?: number | null
          title_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_titles_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_titles_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
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
          {
            foreignKeyName: "horse_transfers_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_read: boolean
          kind: string
          payload: Json | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_read?: boolean
          kind?: string
          payload?: Json | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_read?: boolean
          kind?: string
          payload?: Json | null
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
          {
            foreignKeyName: "notifications_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
          },
        ]
      }
      object_view_daily: {
        Row: {
          day: string
          entity_id: string
          entity_type: string
          unique_viewers: number
          views: number
        }
        Insert: {
          day: string
          entity_id: string
          entity_type: string
          unique_viewers?: number
          views?: number
        }
        Update: {
          day?: string
          entity_id?: string
          entity_type?: string
          unique_viewers?: number
          views?: number
        }
        Relationships: []
      }
      object_view_scratch: {
        Row: {
          day: string
          entity_id: string
          entity_type: string
          hits: number
          viewer_hash: string
        }
        Insert: {
          day: string
          entity_id: string
          entity_type: string
          hits?: number
          viewer_hash: string
        }
        Update: {
          day?: string
          entity_id?: string
          entity_type?: string
          hits?: number
          viewer_hash?: string
        }
        Relationships: []
      }
      payment_installments: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          conversation_id: string
          created_at: string
          due_date: string | null
          id: string
          marked_sent_at: string | null
          marked_sent_by: string | null
          note: string | null
          seq: number
          transaction_id: string | null
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          conversation_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          marked_sent_at?: string | null
          marked_sent_by?: string | null
          note?: string | null
          seq: number
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          conversation_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          marked_sent_at?: string | null
          marked_sent_by?: string | null
          note?: string | null
          seq?: number
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_installments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          bumped_at: string
          channel_id: string | null
          content: string
          created_at: string
          event_id: string | null
          group_id: string | null
          help_request_id: string | null
          horse_id: string | null
          id: string
          is_pinned: boolean
          kind: string
          likes_count: number
          parent_id: string | null
          replies_count: number
          show_id: string | null
          studio_id: string | null
          title: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id: string
          bumped_at?: string
          channel_id?: string | null
          content: string
          created_at?: string
          event_id?: string | null
          group_id?: string | null
          help_request_id?: string | null
          horse_id?: string | null
          id?: string
          is_pinned?: boolean
          kind?: string
          likes_count?: number
          parent_id?: string | null
          replies_count?: number
          show_id?: string | null
          studio_id?: string | null
          title?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string
          bumped_at?: string
          channel_id?: string | null
          content?: string
          created_at?: string
          event_id?: string | null
          group_id?: string | null
          help_request_id?: string | null
          horse_id?: string | null
          id?: string
          is_pinned?: boolean
          kind?: string
          likes_count?: number
          parent_id?: string | null
          replies_count?: number
          show_id?: string | null
          studio_id?: string | null
          title?: string | null
          updated_at?: string
          visibility?: string
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            foreignKeyName: "posts_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
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
      purchased_reports: {
        Row: {
          horse_id: string
          id: string
          purchased_at: string
          report_type: string
          user_id: string
        }
        Insert: {
          horse_id: string
          id?: string
          purchased_at?: string
          report_type?: string
          user_id: string
        }
        Update: {
          horse_id?: string
          id?: string
          purchased_at?: string
          report_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchased_reports_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchased_reports_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
          },
        ]
      }
      qualification_cards: {
        Row: {
          class_entry_count: number | null
          class_exhibitor_count: number | null
          class_id: string
          current_owner_id: string
          earned_by_owner_id: string
          earned_place: number
          horse_id: string
          id: string
          is_stakes: boolean
          issued_at: string
          show_id: string
          show_year: number | null
          status: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          class_entry_count?: number | null
          class_exhibitor_count?: number | null
          class_id: string
          current_owner_id: string
          earned_by_owner_id: string
          earned_place: number
          horse_id: string
          id: string
          is_stakes?: boolean
          issued_at?: string
          show_id: string
          show_year?: number | null
          status?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          class_entry_count?: number | null
          class_exhibitor_count?: number | null
          class_id?: string
          current_owner_id?: string
          earned_by_owner_id?: string
          earned_place?: number
          horse_id?: string
          id?: string
          is_stakes?: boolean
          issued_at?: string
          show_id?: string
          show_year?: number | null
          status?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qualification_cards_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "show_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_cards_current_owner_id_fkey"
            columns: ["current_owner_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_cards_current_owner_id_fkey"
            columns: ["current_owner_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "qualification_cards_current_owner_id_fkey"
            columns: ["current_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_cards_earned_by_owner_id_fkey"
            columns: ["earned_by_owner_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_cards_earned_by_owner_id_fkey"
            columns: ["earned_by_owner_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "qualification_cards_earned_by_owner_id_fkey"
            columns: ["earned_by_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_cards_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_cards_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
          },
          {
            foreignKeyName: "qualification_cards_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_cards_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_cards_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "qualification_cards_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
      show_barred_entrants: {
        Row: {
          barred_by: string | null
          created_at: string
          reason: string | null
          show_id: string
          user_id: string
        }
        Insert: {
          barred_by?: string | null
          created_at?: string
          reason?: string | null
          show_id: string
          user_id: string
        }
        Update: {
          barred_by?: string | null
          created_at?: string
          reason?: string | null
          show_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_barred_entrants_barred_by_fkey"
            columns: ["barred_by"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_barred_entrants_barred_by_fkey"
            columns: ["barred_by"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "show_barred_entrants_barred_by_fkey"
            columns: ["barred_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_barred_entrants_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_barred_entrants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_barred_entrants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "show_barred_entrants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      show_callbacks: {
        Row: {
          champion_entry_id: string | null
          created_at: string
          id: string
          judge_id: string | null
          reserve_entry_id: string | null
          scope: string
          scope_id: string | null
          show_id: string
        }
        Insert: {
          champion_entry_id?: string | null
          created_at?: string
          id?: string
          judge_id?: string | null
          reserve_entry_id?: string | null
          scope: string
          scope_id?: string | null
          show_id: string
        }
        Update: {
          champion_entry_id?: string | null
          created_at?: string
          id?: string
          judge_id?: string | null
          reserve_entry_id?: string | null
          scope?: string
          scope_id?: string | null
          show_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_callbacks_champion_entry_id_fkey"
            columns: ["champion_entry_id"]
            isOneToOne: false
            referencedRelation: "show_class_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_callbacks_judge_id_fkey"
            columns: ["judge_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_callbacks_judge_id_fkey"
            columns: ["judge_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "show_callbacks_judge_id_fkey"
            columns: ["judge_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_callbacks_reserve_entry_id_fkey"
            columns: ["reserve_entry_id"]
            isOneToOne: false
            referencedRelation: "show_class_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_callbacks_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      show_class_entries: {
        Row: {
          class_id: string
          created_at: string
          critique_at: string | null
          critique_by: string | null
          critique_photo_text: string | null
          critique_text: string | null
          document_id: string | null
          entry_number: number | null
          handler_id: string | null
          horse_id: string
          id: string
          note: string | null
          owner_id: string
          photo_id: string | null
          show_id: string
          status: string
        }
        Insert: {
          class_id: string
          created_at?: string
          critique_at?: string | null
          critique_by?: string | null
          critique_photo_text?: string | null
          critique_text?: string | null
          document_id?: string | null
          entry_number?: number | null
          handler_id?: string | null
          horse_id: string
          id?: string
          note?: string | null
          owner_id: string
          photo_id?: string | null
          show_id: string
          status?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          critique_at?: string | null
          critique_by?: string | null
          critique_photo_text?: string | null
          critique_text?: string | null
          document_id?: string | null
          entry_number?: number | null
          handler_id?: string | null
          horse_id?: string
          id?: string
          note?: string | null
          owner_id?: string
          photo_id?: string | null
          show_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_class_entries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "show_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_class_entries_critique_by_fkey"
            columns: ["critique_by"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_class_entries_critique_by_fkey"
            columns: ["critique_by"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "show_class_entries_critique_by_fkey"
            columns: ["critique_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_class_entries_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "horse_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_class_entries_handler_id_fkey"
            columns: ["handler_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_class_entries_handler_id_fkey"
            columns: ["handler_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "show_class_entries_handler_id_fkey"
            columns: ["handler_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_class_entries_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "user_horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_class_entries_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
          },
          {
            foreignKeyName: "show_class_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_class_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "show_class_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_class_entries_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "horse_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_class_entries_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      show_classes: {
        Row: {
          allowed_finishes: string[] | null
          allowed_scales: string[] | null
          class_number: string | null
          combined_into_class_id: string | null
          created_at: string
          id: string
          is_qualifying: boolean
          max_per_entrant: number | null
          name: string
          results_published_at: string | null
          section_id: string
          sort_order: number
          split_from_class_id: string | null
          status: string
        }
        Insert: {
          allowed_finishes?: string[] | null
          allowed_scales?: string[] | null
          class_number?: string | null
          combined_into_class_id?: string | null
          created_at?: string
          id?: string
          is_qualifying?: boolean
          max_per_entrant?: number | null
          name: string
          results_published_at?: string | null
          section_id: string
          sort_order?: number
          split_from_class_id?: string | null
          status?: string
        }
        Update: {
          allowed_finishes?: string[] | null
          allowed_scales?: string[] | null
          class_number?: string | null
          combined_into_class_id?: string | null
          created_at?: string
          id?: string
          is_qualifying?: boolean
          max_per_entrant?: number | null
          name?: string
          results_published_at?: string | null
          section_id?: string
          sort_order?: number
          split_from_class_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_classes_combined_into_class_id_fkey"
            columns: ["combined_into_class_id"]
            isOneToOne: false
            referencedRelation: "show_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_classes_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "show_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_classes_split_from_class_id_fkey"
            columns: ["split_from_class_id"]
            isOneToOne: false
            referencedRelation: "show_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      show_divisions: {
        Row: {
          axis: string
          created_at: string
          id: string
          name: string
          show_id: string
          sort_order: number
        }
        Insert: {
          axis?: string
          created_at?: string
          id?: string
          name: string
          show_id: string
          sort_order?: number
        }
        Update: {
          axis?: string
          created_at?: string
          id?: string
          name?: string
          show_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "show_divisions_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      show_entry_votes: {
        Row: {
          created_at: string
          entry_id: string
          id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          id?: string
          voter_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_entry_votes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "show_class_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_entry_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_entry_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "show_entry_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      show_fee_payments: {
        Row: {
          marked_by: string
          paid_at: string
          show_id: string
          user_id: string
        }
        Insert: {
          marked_by: string
          paid_at?: string
          show_id: string
          user_id: string
        }
        Update: {
          marked_by?: string
          paid_at?: string
          show_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_fee_payments_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_fee_payments_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "show_fee_payments_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_fee_payments_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_fee_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_fee_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "show_fee_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      show_placings: {
        Row: {
          class_id: string
          created_at: string
          entry_id: string
          id: string
          judge_id: string | null
          note: string | null
          place: number | null
        }
        Insert: {
          class_id: string
          created_at?: string
          entry_id: string
          id?: string
          judge_id?: string | null
          note?: string | null
          place?: number | null
        }
        Update: {
          class_id?: string
          created_at?: string
          entry_id?: string
          id?: string
          judge_id?: string | null
          note?: string | null
          place?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "show_placings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "show_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_placings_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "show_class_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_placings_judge_id_fkey"
            columns: ["judge_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_placings_judge_id_fkey"
            columns: ["judge_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "show_placings_judge_id_fkey"
            columns: ["judge_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          show_id: string | null
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
          show_id?: string | null
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
          show_id?: string | null
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
            foreignKeyName: "show_records_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
          },
          {
            foreignKeyName: "show_records_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
      show_results_docs: {
        Row: {
          format: string
          generated_at: string
          id: string
          show_id: string
          storage_path: string
        }
        Insert: {
          format?: string
          generated_at?: string
          id?: string
          show_id: string
          storage_path: string
        }
        Update: {
          format?: string
          generated_at?: string
          id?: string
          show_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_results_docs_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      show_sections: {
        Row: {
          created_at: string
          division_id: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          division_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          division_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "show_sections_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "show_divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      show_staff: {
        Row: {
          coi_flag: boolean
          coi_note: string | null
          created_at: string
          id: string
          role: string
          show_id: string
          user_id: string
        }
        Insert: {
          coi_flag?: boolean
          coi_note?: string | null
          created_at?: string
          id?: string
          role: string
          show_id: string
          user_id: string
        }
        Update: {
          coi_flag?: boolean
          coi_note?: string | null
          created_at?: string
          id?: string
          role?: string
          show_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_staff_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "show_staff_user_id_fkey"
            columns: ["user_id"]
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
          v2_class_id: string | null
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
          v2_class_id?: string | null
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
          v2_class_id?: string | null
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
            foreignKeyName: "show_string_entries_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
          },
          {
            foreignKeyName: "show_string_entries_show_string_id_fkey"
            columns: ["show_string_id"]
            isOneToOne: false
            referencedRelation: "show_strings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_string_entries_v2_class_id_fkey"
            columns: ["v2_class_id"]
            isOneToOne: false
            referencedRelation: "show_classes"
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
      shows: {
        Row: {
          about_md: string | null
          blind_browsing: boolean
          capacity: number | null
          created_at: string
          entries_close_at: string | null
          entries_open_at: string | null
          fee_info: string | null
          host_id: string
          id: string
          is_mhh_qualifying: boolean
          judging: string
          judging_ends_at: string | null
          mode: string
          rules_md: string | null
          sanctioning_note: string | null
          show_date: string | null
          show_year: number | null
          status: string
          title: string
          updated_at: string
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          about_md?: string | null
          blind_browsing?: boolean
          capacity?: number | null
          created_at?: string
          entries_close_at?: string | null
          entries_open_at?: string | null
          fee_info?: string | null
          host_id: string
          id?: string
          is_mhh_qualifying?: boolean
          judging?: string
          judging_ends_at?: string | null
          mode: string
          rules_md?: string | null
          sanctioning_note?: string | null
          show_date?: string | null
          show_year?: number | null
          status?: string
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          about_md?: string | null
          blind_browsing?: boolean
          capacity?: number | null
          created_at?: string
          entries_close_at?: string | null
          entries_open_at?: string | null
          fee_info?: string | null
          host_id?: string
          id?: string
          is_mhh_qualifying?: boolean
          judging?: string
          judging_ends_at?: string | null
          mode?: string
          rules_md?: string | null
          sanctioning_note?: string | null
          show_date?: string | null
          show_year?: number | null
          status?: string
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shows_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shows_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "shows_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      site_activity_daily: {
        Row: {
          anon_dau: number
          day: string
          member_dau: number
          views: number
        }
        Insert: {
          anon_dau?: number
          day: string
          member_dau?: number
          views?: number
        }
        Update: {
          anon_dau?: number
          day?: string
          member_dau?: number
          views?: number
        }
        Relationships: []
      }
      stable_saved_views: {
        Row: {
          created_at: string
          id: string
          name: string
          params: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          params: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          params?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stable_saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stable_saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "stable_saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_state: {
        Row: {
          current_period_end: string | null
          started_at: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          current_period_end?: string | null
          started_at?: string
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          current_period_end?: string | null
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "subscription_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
            foreignKeyName: "transactions_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "v_artist_finished_horses"
            referencedColumns: ["horse_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
          attributes: Json | null
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
          is_promoted_until: string | null
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
          attributes?: Json | null
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
          is_promoted_until?: string | null
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
          attributes?: Json | null
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
          is_promoted_until?: string | null
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
          is_boosted_until: string | null
          notes: string | null
          user_id: string
        }
        Insert: {
          catalog_id?: string | null
          created_at?: string
          id?: string
          is_boosted_until?: string | null
          notes?: string | null
          user_id: string
        }
        Update: {
          catalog_id?: string | null
          created_at?: string
          id?: string
          is_boosted_until?: string | null
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
          exhibitor_number: string | null
          full_name: string | null
          id: string
          is_supporter: boolean
          is_suspended: boolean
          is_test_account: boolean
          is_trusted_curator: boolean
          is_verified: boolean
          last_seen_on: string | null
          notification_prefs: Json | null
          pref_simple_mode: boolean
          profile_customization: Json | null
          role: string | null
          show_badges: boolean
          show_in_supporters_ledger: boolean
          show_photos_on_reference: boolean
          supporter_since: string | null
          suspended_at: string | null
          suspended_reason: string | null
          watermark_photos: boolean | null
          watermark_text: string | null
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
          exhibitor_number?: string | null
          full_name?: string | null
          id: string
          is_supporter?: boolean
          is_suspended?: boolean
          is_test_account?: boolean
          is_trusted_curator?: boolean
          is_verified?: boolean
          last_seen_on?: string | null
          notification_prefs?: Json | null
          pref_simple_mode?: boolean
          profile_customization?: Json | null
          role?: string | null
          show_badges?: boolean
          show_in_supporters_ledger?: boolean
          show_photos_on_reference?: boolean
          supporter_since?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          watermark_photos?: boolean | null
          watermark_text?: string | null
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
          exhibitor_number?: string | null
          full_name?: string | null
          id?: string
          is_supporter?: boolean
          is_suspended?: boolean
          is_test_account?: boolean
          is_trusted_curator?: boolean
          is_verified?: boolean
          last_seen_on?: string | null
          notification_prefs?: Json | null
          pref_simple_mode?: boolean
          profile_customization?: Json | null
          role?: string | null
          show_badges?: boolean
          show_in_supporters_ledger?: boolean
          show_photos_on_reference?: boolean
          supporter_since?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          watermark_photos?: boolean | null
          watermark_text?: string | null
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
          total_horse_count: number | null
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
          total_horse_count?: never
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
          total_horse_count?: never
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
      mv_trusted_sellers: {
        Row: {
          account_created: string | null
          alias_name: string | null
          avg_rating: number | null
          distinct_buyers: number | null
          review_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_artist_finished_horses: {
        Row: {
          artist_user_id: string | null
          best_placing: number | null
          catalog_id: string | null
          commission_id: string | null
          date_completed: string | null
          finishing_artist: string | null
          finishing_artist_verified: boolean | null
          horse_created_at: string | null
          horse_id: string | null
          horse_name: string | null
          image_urls: string[] | null
          is_public: boolean | null
          latest_show_date: string | null
          log_id: string | null
          nan_qualifying_count: number | null
          owner_id: string | null
          show_count: number | null
          titles: string[] | null
          work_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customization_logs_artist_user_id_fkey"
            columns: ["artist_user_id"]
            isOneToOne: false
            referencedRelation: "discover_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customization_logs_artist_user_id_fkey"
            columns: ["artist_user_id"]
            isOneToOne: false
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customization_logs_artist_user_id_fkey"
            columns: ["artist_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customization_logs_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_horses_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
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
            referencedRelation: "mv_trusted_sellers"
            referencedColumns: ["user_id"]
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
      are_blocked: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: boolean
      }
      auto_unpark_expired_transfers: { Args: never; Returns: undefined }
      backfill_photo_short_slugs: { Args: never; Returns: number }
      barn_created_by: { Args: { p_group_id: string }; Returns: string }
      barn_is_private: { Args: { p_group_id: string }; Returns: boolean }
      barn_member_role: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: string
      }
      batch_import_horses: {
        Args: { p_horses: Json; p_user_id: string }
        Returns: Json
      }
      batch_import_horses_v2: {
        Args: { p_is_public?: boolean; rows: Json }
        Returns: Json
      }
      catalog_slugify: { Args: { txt: string }; Returns: string }
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
      combine_show_classes: {
        Args: {
          p_class_ids: string[]
          p_new_class_number: string
          p_new_name: string
        }
        Returns: string
      }
      count_catalog_collectors: {
        Args: { p_catalog_id: string }
        Returns: number
      }
      count_catalog_wanters: { Args: { p_catalog_id: string }; Returns: number }
      count_user_horses_public: { Args: { p_user_id: string }; Returns: number }
      count_user_horses_total: { Args: { p_user_id: string }; Returns: number }
      deal_offer_move_atomic: {
        Args: {
          p_actor_id: string
          p_amount?: number
          p_message?: string
          p_move: string
          p_transaction_id: string
        }
        Returns: Json
      }
      entry_owner_of: { Args: { p_entry_id: string }; Returns: string }
      entry_vote_open: { Args: { p_entry_id: string }; Returns: boolean }
      get_catalog_browse_thumbs: {
        Args: { p_ids: string[] }
        Returns: {
          catalog_id: string
          image_url: string
        }[]
      }
      get_catalog_facets: { Args: never; Returns: Json }
      get_catalog_listings: {
        Args: { p_catalog_id: string; p_limit?: number }
        Returns: {
          custom_name: string
          horse_id: string
          listing_price: number
          marketplace_notes: string
          owner_alias: string
          trade_status: string
        }[]
      }
      get_catalog_reference_photos: {
        Args: { p_catalog_id: string; p_limit?: number }
        Returns: {
          horse_id: string
          horse_name: string
          image_url: string
        }[]
      }
      get_catalog_stats: {
        Args: { p_ids: string[] }
        Returns: {
          catalog_id: string
          for_sale_count: number
          owner_count: number
          want_count: number
        }[]
      }
      get_class_cards: {
        Args: { p_class_id: string }
        Returns: {
          code: string
          earned_place: number
          horse_id: string
          is_stakes: boolean
        }[]
      }
      get_exhibitor_card_count: {
        Args: { p_user_id: string }
        Returns: {
          live_cards: number
          stakes_cards: number
        }[]
      }
      get_extra_photo_count: { Args: { p_horse_id: string }; Returns: number }
      get_horse_view_stats: {
        Args: { p_horse_id: string }
        Returns: {
          all_time_views: number
          week_viewers: number
          week_views: number
        }[]
      }
      get_market_history: {
        Args: { p_catalog_id: string }
        Returns: {
          finish_type: string
          price: number
          sale_date: string
        }[]
      }
      get_market_listings: {
        Args: {
          p_finish?: string
          p_has_records?: boolean
          p_limit?: number
          p_max_price?: number
          p_min_price?: number
          p_offset?: number
          p_q?: string
          p_sort?: string
          p_trade?: string
        }
        Returns: {
          catalog_id: string
          catalog_maker: string
          catalog_scale: string
          catalog_title: string
          condition_grade: string
          created_at: string
          custom_name: string
          finish_type: string
          id: string
          is_trusted_seller: boolean
          listing_price: number
          marketplace_notes: string
          owner_alias: string
          owner_id: string
          records: Json
          thumbnail_url: string
          total_count: number
          trade_status: string
        }[]
      }
      get_market_listings_total: { Args: never; Returns: number }
      get_market_rows: {
        Args: {
          p_catalog_id?: string
          p_finish_type?: string
          p_life_stage?: string
        }
        Returns: {
          average_price: number
          catalog_id: string
          finish_type: string
          highest_price: number
          last_sold_at: string
          life_stage: string
          lowest_price: number
          median_price: number
          transaction_volume: number
        }[]
      }
      get_mold_customs: {
        Args: { p_catalog_id: string; p_limit?: number }
        Returns: {
          created_at: string
          custom_name: string
          finishing_artist: string
          finishing_artist_verified: boolean
          horse_id: string
          image_url: string
        }[]
      }
      get_photo_limit: { Args: never; Returns: number }
      get_public_aliases: {
        Args: { p_ids: string[] }
        Returns: {
          alias_name: string
          id: string
        }[]
      }
      get_public_favorite_count: {
        Args: { p_horse_id: string }
        Returns: number
      }
      get_public_hoofprint: {
        Args: { p_horse_id: string }
        Returns: {
          life_stage: string
          ownership: Json
          timeline: Json
        }[]
      }
      get_public_horse_cards: {
        Args: { p_horse_id: string }
        Returns: {
          class_entry_count: number
          class_exhibitor_count: number
          class_name: string
          code: string
          earned_place: number
          is_stakes: boolean
          issued_at: string
          show_title: string
          show_year: number
          status: string
        }[]
      }
      get_public_horse_records: {
        Args: { p_horse_id: string }
        Returns: {
          class_name: string
          division: string
          id: string
          is_nan: boolean
          placing: string
          ribbon_color: string
          show_date: string
          show_date_text: string
          show_id: string
          show_name: string
          verification_tier: string
        }[]
      }
      get_public_passport: {
        Args: { p_horse_id: string }
        Returns: {
          catalog: Json
          horse: Json
          images: Json
          owner_alias: string
        }[]
      }
      get_show_staff_public: {
        Args: { p_show_id: string }
        Returns: {
          role: string
          show_id: string
          user_id: string
        }[]
      }
      get_stable_facets: { Args: { p_owner: string }; Returns: Json }
      get_stable_summary: {
        Args: { p_owner: string }
        Returns: {
          collections: Json
          for_sale_count: number
          total_horses: number
          vault_total: number
        }[]
      }
      get_supporters_ledger: {
        Args: never
        Returns: {
          alias_name: string
          supporter_since: string
        }[]
      }
      get_user_tier: { Args: never; Returns: string }
      increment_approved_suggestions: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      initialize_hoofprint_genesis: {
        Args: { p_horse_id: string; p_notes?: string }
        Returns: Json
      }
      is_caller_suspended: { Args: never; Returns: boolean }
      is_trusted_seller: { Args: { p_user_id: string }; Returns: boolean }
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
      metrics_active_members: { Args: { p_days?: number }; Returns: number }
      metrics_entity_totals: {
        Args: { p_days?: number }
        Returns: {
          etype: string
          total_uniques: number
          total_views: number
        }[]
      }
      metrics_subscription_summary: {
        Args: never
        Returns: {
          status: string
          subscribers: number
          tier: string
        }[]
      }
      metrics_top_objects: {
        Args: { p_days?: number; p_per_type?: number }
        Returns: {
          eid: string
          etype: string
          total_uniques: number
          total_views: number
        }[]
      }
      notify_catalog_owners_of_demand: {
        Args: { p_catalog_id: string; p_wanter_id: string }
        Returns: number
      }
      placings_announced: { Args: { p_class_id: string }; Returns: boolean }
      record_class_placings_atomic: {
        Args: { p_class_id: string; p_placings: Json }
        Returns: undefined
      }
      record_object_view: {
        Args: {
          p_entity_id: string
          p_entity_types: string[]
          p_is_member?: boolean
          p_viewer_hash: string
        }
        Returns: boolean
      }
      record_subscription_state: {
        Args: {
          p_current_period_end?: string
          p_status: string
          p_stripe_customer_id?: string
          p_stripe_subscription_id?: string
          p_tier: string
          p_user_id: string
        }
        Returns: undefined
      }
      refresh_market_prices: { Args: never; Returns: undefined }
      refresh_mv_trusted_sellers: { Args: never; Returns: undefined }
      reorder_show_nodes: {
        Args: { p_ids: string[]; p_kind: string; p_sort_orders: number[] }
        Returns: number
      }
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
          attributes: Json
          id: string
          item_type: string
          maker: string
          parent_id: string
          parent_title: string
          scale: string
          similarity: number
          title: string
        }[]
      }
      show_id_of_class: { Args: { p_class_id: string }; Returns: string }
      show_id_of_entry: { Args: { p_entry_id: string }; Returns: string }
      show_id_of_section: { Args: { p_section_id: string }; Returns: string }
      show_is_public: { Args: { p_show_id: string }; Returns: boolean }
      show_role_check: {
        Args: { p_roles: string[]; p_show_id: string }
        Returns: boolean
      }
      soft_delete_account: { Args: { target_uid: string }; Returns: undefined }
      split_show_class: {
        Args: {
          p_class_id: string
          p_entry_ids: string[]
          p_new_class_number: string
          p_new_name: string
        }
        Returns: string
      }
      stamp_finishing_artist: {
        Args: { p_commission_id: string }
        Returns: boolean
      }
      studio_slot_usage: {
        Args: { p_artist_ids: string[] }
        Returns: {
          artist_id: string
          slots_used: number
        }[]
      }
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
      touch_last_seen: { Args: never; Returns: undefined }
      upvote_suggestion: {
        Args: { p_suggestion_id: string }
        Returns: undefined
      }
      verify_qualification_card: {
        Args: { p_code: string }
        Returns: {
          class_entry_count: number
          class_exhibitor_count: number
          class_name: string
          code: string
          earned_place: number
          horse_name: string
          is_stakes: boolean
          issued_at: string
          show_title: string
          show_year: number
          status: string
        }[]
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
        | "Show_Photo"
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
        "Show_Photo",
      ],
      finish_type: ["OF", "Custom", "Artist Resin"],
    },
  },
} as const
