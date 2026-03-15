// ============================================================
// Database Types — The Model Horse Hub
// Mirrors the current Supabase PostgreSQL schema
// ============================================================

// --- Enums ---

export type AngleProfile =
  | "Primary_Thumbnail"
  | "Left_Side"
  | "Right_Side"
  | "Front_Chest"
  | "Back_Hind"
  | "Detail_Face_Eyes"
  | "Detail_Ears"
  | "Detail_Hooves"
  | "Flaw_Rub_Damage"
  | "Belly_Makers_Mark"
  | "extra_detail"
  | "Other";

export type FinishType = "OF" | "Custom" | "Artist Resin";

export type TradeStatus = "Not for Sale" | "For Sale" | "Open to Offers";

export type CatalogItemType = "plastic_mold" | "plastic_release" | "artist_resin" | "tack" | "medallion" | "micro_mini" | "prop" | "diorama";

export type AssetCategory = "model" | "tack" | "prop" | "diorama";

// --- Table Row Types ---

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  alias_name: string;
  is_verified: boolean;
  pref_simple_mode: boolean;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  currency_symbol: string;
}

export interface CatalogItem {
  id: string;
  item_type: CatalogItemType;
  parent_id: string | null;
  title: string;
  maker: string;
  scale: string | null;
  attributes: Record<string, unknown>;
  created_at: string;
}

export interface UserHorse {
  id: string;
  owner_id: string;
  catalog_id: string | null;
  collection_id: string | null;
  custom_name: string;
  sculptor: string | null;
  finishing_artist: string | null;
  edition_number: number | null;
  edition_size: number | null;
  finish_type: FinishType | null;
  condition_grade: string | null;
  asset_category: AssetCategory;
  trade_status: TradeStatus;
  listing_price: number | null;
  marketplace_notes: string | null;
  is_for_sale: boolean;
  is_public: boolean;
  created_at: string;
  finish_details: string | null;
  public_notes: string | null;
  assigned_breed: string | null;
  assigned_gender: string | null;
  assigned_age: string | null;
  regional_id: string | null;
}

export interface FinancialVault {
  id: string;
  horse_id: string;
  purchase_price: number | null;
  purchase_date: string | null;
  estimated_current_value: number | null;
  insurance_notes: string | null;
  purchase_date_text: string | null;
}

export interface HorseImage {
  id: string;
  horse_id: string;
  image_url: string;
  angle_profile: AngleProfile;
  uploaded_at: string;
}

export interface CustomizationLog {
  id: string;
  horse_id: string;
  artist_alias: string | null;
  work_type: string;
  materials_used: string | null;
  date_completed: string | null;
}

export interface UserCollection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
}

export interface UserWishlist {
  id: string;
  user_id: string;
  catalog_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface HorseFavorite {
  id: string;
  user_id: string;
  horse_id: string;
  created_at: string;
}

export interface ShowRecord {
  id: string;
  horse_id: string;
  user_id: string;
  show_name: string;
  show_date: string | null;
  division: string | null;
  placing: string | null;
  ribbon_color: string | null;
  judge_name: string | null;
  is_nan: boolean;
  notes: string | null;
  created_at: string;
  show_location: string | null;
  section_name: string | null;
  award_category: string | null;
  competition_level: string | null;
  show_date_text: string | null;
}

export interface HorsePedigree {
  id: string;
  horse_id: string;
  user_id: string;
  sire_name: string | null;
  dam_name: string | null;
  sculptor: string | null;
  cast_number: string | null;
  edition_size: string | null;
  lineage_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeaturedHorse {
  id: string;
  horse_id: string;
  title: string;
  description: string | null;
  featured_at: string;
  expires_at: string | null;
  created_by: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  actor_id: string | null;
  horse_id: string | null;
  conversation_id: string | null;
  content: string | null;
  is_read: boolean;
  created_at: string;
}

export interface UserFollow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface ActivityEvent {
  id: string;
  actor_id: string;
  event_type: string;
  horse_id: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  parent_id: string | null;
  horse_id: string | null;
  group_id: string | null;
  event_id: string | null;
  body: string;
  created_at: string;
}

export interface Like {
  id: string;
  user_id: string;
  post_id: string | null;
  horse_id: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  party_a_id: string;
  party_b_id: string;
  transaction_type: string;
  status: string;
  completed_at: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  transaction_id: string;
  reviewer_id: string;
  reviewee_id: string;
  stars: number;
  review_text: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  status: string;
  created_by: string;
  start_at: string;
  end_at: string | null;
  created_at: string;
}

export interface EventEntry {
  id: string;
  event_id: string;
  horse_id: string;
  user_id: string;
  class_id: string | null;
  votes: number;
  created_at: string;
}

export interface EventDivision {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface EventClass {
  id: string;
  division_id: string;
  name: string;
  class_number: string | null;
  description: string | null;
  is_nan_qualifying: boolean;
  max_entries: number | null;
  sort_order: number;
  created_at: string;
}

export interface HorseTransfer {
  id: string;
  horse_id: string;
  sender_id: string;
  recipient_id: string | null;
  status: string;
  claim_pin: string | null;
  created_at: string;
}

// --- Supabase Database Type Interface ---
// Used to provide type safety to supabase client calls

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "id" | "created_at" | "is_verified"> & {
          id?: string;
          created_at?: string;
          is_verified?: boolean;
        };
        Update: Partial<Omit<User, "id">>;
        Relationships: [];
      };
      catalog_items: {
        Row: CatalogItem;
        Insert: Omit<CatalogItem, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<CatalogItem, "id">>;
        Relationships: [];
      };
      user_horses: {
        Row: UserHorse;
        Insert: Omit<UserHorse, "id" | "created_at" | "is_for_sale" | "is_public" | "collection_id" | "sculptor" | "trade_status" | "listing_price" | "marketplace_notes" | "finishing_artist" | "edition_number" | "edition_size"> & {
          id?: string;
          created_at?: string;
          is_for_sale?: boolean;
          is_public?: boolean;
          collection_id?: string | null;
          sculptor?: string | null;
          finishing_artist?: string | null;
          edition_number?: number | null;
          edition_size?: number | null;
          trade_status?: TradeStatus;
          listing_price?: number | null;
          marketplace_notes?: string | null;
        };
        Update: Partial<Omit<UserHorse, "id">>;
        Relationships: [];
      };
      financial_vault: {
        Row: FinancialVault;
        Insert: Omit<FinancialVault, "id"> & { id?: string };
        Update: Partial<Omit<FinancialVault, "id">>;
        Relationships: [];
      };
      horse_images: {
        Row: HorseImage;
        Insert: Omit<HorseImage, "id" | "uploaded_at"> & {
          id?: string;
          uploaded_at?: string;
        };
        Update: Partial<Omit<HorseImage, "id">>;
        Relationships: [];
      };
      customization_logs: {
        Row: CustomizationLog;
        Insert: Omit<CustomizationLog, "id"> & { id?: string };
        Update: Partial<Omit<CustomizationLog, "id">>;
        Relationships: [];
      };
      user_collections: {
        Row: UserCollection;
        Insert: Omit<UserCollection, "id" | "created_at" | "is_public"> & {
          id?: string;
          created_at?: string;
          is_public?: boolean;
        };
        Update: Partial<Omit<UserCollection, "id">>;
        Relationships: [];
      };
      user_wishlists: {
        Row: UserWishlist;
        Insert: Omit<UserWishlist, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<UserWishlist, "id">>;
        Relationships: [];
      };
      horse_favorites: {
        Row: HorseFavorite;
        Insert: Omit<HorseFavorite, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<HorseFavorite, "id">>;
        Relationships: [];
      };
      show_records: {
        Row: ShowRecord;
        Insert: Omit<ShowRecord, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ShowRecord, "id">>;
        Relationships: [];
      };
      horse_pedigrees: {
        Row: HorsePedigree;
        Insert: Omit<HorsePedigree, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<HorsePedigree, "id">>;
        Relationships: [];
      };
      featured_horses: {
        Row: FeaturedHorse;
        Insert: Omit<FeaturedHorse, "id" | "featured_at"> & {
          id?: string;
          featured_at?: string;
        };
        Update: Partial<Omit<FeaturedHorse, "id">>;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, "id" | "created_at" | "is_read"> & {
          id?: string;
          created_at?: string;
          is_read?: boolean;
        };
        Update: Partial<Omit<Notification, "id">>;
        Relationships: [];
      };
      user_follows: {
        Row: UserFollow;
        Insert: Omit<UserFollow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<UserFollow, "id">>;
        Relationships: [];
      };
      activity_events: {
        Row: ActivityEvent;
        Insert: Omit<ActivityEvent, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ActivityEvent, "id">>;
        Relationships: [];
      };
      posts: {
        Row: Post;
        Insert: Omit<Post, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Post, "id">>;
        Relationships: [];
      };
      likes: {
        Row: Like;
        Insert: Omit<Like, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Like, "id">>;
        Relationships: [];
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Transaction, "id">>;
        Relationships: [];
      };
      reviews: {
        Row: Review;
        Insert: Omit<Review, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Review, "id">>;
        Relationships: [];
      };
      events: {
        Row: Event;
        Insert: Omit<Event, "id" | "created_at" | "status"> & {
          id?: string;
          created_at?: string;
          status?: string;
        };
        Update: Partial<Omit<Event, "id">>;
        Relationships: [];
      };
      event_entries: {
        Row: EventEntry;
        Insert: Omit<EventEntry, "id" | "created_at" | "votes"> & {
          id?: string;
          created_at?: string;
          votes?: number;
        };
        Update: Partial<Omit<EventEntry, "id">>;
        Relationships: [];
      };
      event_divisions: {
        Row: EventDivision;
        Insert: Omit<EventDivision, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<EventDivision, "id">>;
        Relationships: [];
      };
      event_classes: {
        Row: EventClass;
        Insert: Omit<EventClass, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<EventClass, "id">>;
        Relationships: [];
      };
      horse_transfers: {
        Row: HorseTransfer;
        Insert: Omit<HorseTransfer, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<HorseTransfer, "id">>;
        Relationships: [];
      };
    };
    Views: {
      v_horse_hoofprint: {
        Row: {
          source_id: string;
          source_table: string;
          horse_id: string;
          event_type: string;
          event_date: string;
          label: string;
          metadata: Record<string, unknown> | null;
        };
      };
      mv_market_prices: {
        Row: {
          catalog_id: string;
          finish_type: string;
          life_stage: string;
          lowest_price: number;
          highest_price: number;
          average_price: number;
          median_price: number;
          transaction_volume: number;
          last_sold_at: string | null;
        };
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      angle_profile: AngleProfile;
      finish_type: FinishType;
      catalog_item_type: CatalogItemType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
