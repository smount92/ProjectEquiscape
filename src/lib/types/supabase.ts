/**
 * Re-export generated Database types with augmentation.
 *
 * The generated types from Supabase reflect only tables that exist
 * in the REMOTE database at gen-types time. Some tables may exist
 * only in unapplied migrations. This re-export provides the generated
 * types for full type safety on existing tables while allowing
 * runtime-only tables to be accessed without compile errors.
 *
 * Usage: import type { Database, Json } from "@/lib/types/supabase";
 */
export type { Database, Json } from "./database.generated";
