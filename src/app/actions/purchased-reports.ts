"use server";

import { createClient } from "@/lib/supabase/server";
import { catalogDisplayName } from "@/lib/catalog/displayName";

/**
 * Purchased reports — the reader half of a flow that only ever had a
 * writer.
 *
 * A collector can buy a one-off Insurance Report for a single horse
 * ($1.99 — checkout route RETIRED 2026-08-21, owner decision: the
 * whole-stable insurance PDF in Settings is free); the Stripe webhook kept its
 * row into `purchased_reports`. Until now nothing in the app ever read
 * that table back, so a paid purchase left no trace the buyer could see
 * — the audit's "reports you paid for have no page".
 *
 * What the table stores is the RECEIPT, not the report: user_id,
 * horse_id, report_type, purchased_at. No file, no storage key, no
 * rendered artifact. Reports on Model Horse Hub are materialised on
 * demand (`/api/insurance-report` renders a fresh PDF from live vault
 * data every time it's called), which is why nothing was ever persisted.
 * The page built on this action says so out loud rather than pretending
 * there's a document to hand back.
 *
 * RLS: `purchased_reports` carries "Users can read own purchases"
 * (SELECT USING auth.uid() = user_id, migration 103). The explicit
 * `.eq("user_id", ...)` below is belt-and-braces on top of that, not a
 * substitute for it.
 */

export interface PurchasedReport {
    id: string;
    horseId: string;
    /** Null when the horse has since been deleted from the stable. */
    horseName: string | null;
    /** Catalog reference line ("Breyer — Salinero"), when the horse has one. */
    horseReference: string | null;
    /** The horse is soft-deleted (or no longer readable) — no passport to link. */
    horseMissing: boolean;
    reportType: string;
    purchasedAt: string;
}

interface HorseRow {
    id: string;
    custom_name: string | null;
    deleted_at: string | null;
    catalog_items: { title: string; maker: string } | null;
}

export async function getMyPurchasedReports(): Promise<PurchasedReport[]> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: rows } = await supabase
        .from("purchased_reports")
        .select("id, horse_id, report_type, purchased_at")
        .eq("user_id", user.id)
        .order("purchased_at", { ascending: false });

    const purchases = (rows ?? []) as {
        id: string;
        horse_id: string;
        report_type: string;
        purchased_at: string;
    }[];
    if (purchases.length === 0) return [];

    // One batch read for the horse names — a purchase is only ever
    // meaningful to a human as "the report for Salinero".
    const horseIds = [...new Set(purchases.map((p) => p.horse_id))];
    const { data: rawHorses } = await supabase
        .from("user_horses")
        .select("id, custom_name, deleted_at, catalog_items:catalog_id(title, maker)")
        .in("id", horseIds);

    const horseMap = new Map<string, HorseRow>();
    for (const h of (rawHorses ?? []) as unknown as HorseRow[]) {
        horseMap.set(h.id, h);
    }

    return purchases.map((p) => {
        const horse = horseMap.get(p.horse_id);
        const missing = !horse || horse.deleted_at !== null;
        return {
            id: p.id,
            horseId: p.horse_id,
            horseName: horse?.custom_name ?? null,
            horseReference: horse?.catalog_items
                ? catalogDisplayName(horse.catalog_items.maker, horse.catalog_items.title)
                : null,
            horseMissing: missing,
            reportType: p.report_type,
            purchasedAt: p.purchased_at,
        };
    });
}
