// ============================================================
// Database Types — The Model Horse Hub
// Mirrors the Supabase PostgreSQL schema from Database_Schema.md
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

// --- Table Row Types ---

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  alias_name: string;
  is_verified: boolean;
  pref_simple_mode: boolean;
  created_at: string;
}

export interface ReferenceMold {
  id: string;
  manufacturer: string;
  mold_name: string;
  scale: string;
  release_year_start: number | null;
}

export interface ReferenceRelease {
  id: string;
  mold_id: string;
  model_number: string | null;
  release_name: string;
  color_description: string | null;
  release_year_start: number | null;
  release_year_end: number | null;
}

export interface ArtistResin {
  id: string;
  sculptor_alias: string;
  resin_name: string;
  scale: string;
  cast_medium: string | null;
}

export interface UserHorse {
  id: string;
  owner_id: string;
  reference_mold_id: string | null;
  artist_resin_id: string | null;
  release_id: string | null;
  collection_id: string | null;
  custom_name: string;
  sculptor: string | null;
  finish_type: FinishType;
  condition_grade: string;
  trade_status: TradeStatus;
  listing_price: number | null;
  marketplace_notes: string | null;
  is_for_sale: boolean;
  is_public: boolean;
  created_at: string;
}

export interface FinancialVault {
  id: string;
  horse_id: string;
  purchase_price: number | null;
  purchase_date: string | null;
  estimated_current_value: number | null;
  insurance_notes: string | null;
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
  created_at: string;
}

export interface UserWishlist {
  id: string;
  user_id: string;
  mold_id: string | null;
  release_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface HorseFavorite {
  id: string;
  user_id: string;
  horse_id: string;
  created_at: string;
}

export interface HorseComment {
  id: string;
  user_id: string;
  horse_id: string;
  content: string;
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
      reference_molds: {
        Row: ReferenceMold;
        Insert: Omit<ReferenceMold, "id"> & { id?: string };
        Update: Partial<Omit<ReferenceMold, "id">>;
        Relationships: [];
      };
      artist_resins: {
        Row: ArtistResin;
        Insert: Omit<ArtistResin, "id"> & { id?: string };
        Update: Partial<Omit<ArtistResin, "id">>;
        Relationships: [];
      };
      reference_releases: {
        Row: ReferenceRelease;
        Insert: Omit<ReferenceRelease, "id"> & { id?: string };
        Update: Partial<Omit<ReferenceRelease, "id">>;
        Relationships: [];
      };
      user_horses: {
        Row: UserHorse;
        Insert: Omit<UserHorse, "id" | "created_at" | "is_for_sale" | "is_public" | "release_id" | "collection_id" | "sculptor" | "trade_status" | "listing_price" | "marketplace_notes"> & {
          id?: string;
          created_at?: string;
          is_for_sale?: boolean;
          is_public?: boolean;
          release_id?: string | null;
          collection_id?: string | null;
          sculptor?: string | null;
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
        Insert: Omit<UserCollection, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
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
      horse_comments: {
        Row: HorseComment;
        Insert: Omit<HorseComment, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<HorseComment, "id">>;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      angle_profile: AngleProfile;
      finish_type: FinishType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
