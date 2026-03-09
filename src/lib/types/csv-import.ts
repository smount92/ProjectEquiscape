// ============================================================
// CSV Import Types — Batch CSV Import & Reconciliation
// ============================================================

export interface CsvRow {
  [key: string]: string;
}

export interface CsvMapping {
  name: string | null;
  mold: string | null;
  manufacturer: string | null;
  condition: string | null;
  finish_type: string | null;
  purchase_price: string | null;
  estimated_value: string | null;
  notes: string | null;
}

export interface MatchResult {
  csvRow: CsvRow;
  rowIndex: number;
  status: 'perfect' | 'review' | 'no_match';
  matches: ReferenceMatch[];
  selectedMatch: ReferenceMatch | null;
  customName: string;
}

export interface ReferenceMatch {
  id: string;
  score: number;
  display: string; // e.g. "Breyer #700195 — Bay Appaloosa SM (1999-2003)"
  manufacturer: string;
  mold_name: string;
  release_name: string;
  table: 'reference_releases' | 'artist_resins';
}
