"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================
// COMPETITION ENGINE — Server Actions
// NAN Tracking, Show Strings, Judge Verification
// ============================================================

// ── Types ──

export interface NanQualification {
    horseId: string;
    horseName: string;
    nanYear: number;
    cardType: string; // green, yellow, pink
    showName: string;
    placement: string;
    className: string | null;
    recordId: string;
    verificationTier: string;
}

export interface NanHorseSummary {
    horseId: string;
    horseName: string;
    qualifications: { year: number; cardType: string; count: number }[];
    totalCards: number;
}

export interface ShowString {
    id: string;
    name: string;
    showDate: string | null;
    notes: string | null;
    createdAt: string;
    entryCount: number;
}

export interface ShowStringEntry {
    id: string;
    showStringId: string;
    horseId: string;
    horseName: string;
    className: string;
    division: string | null;
    timeSlot: string | null;
    notes: string | null;
}

// ── NAN Tracking ──

/** Get all NAN-qualifying records for a horse, grouped by year and card type */
export async function getNanQualifications(horseId: string): Promise<NanQualification[]> {
    const supabase = await createClient();

    const { data } = await supabase
        .from("show_records")
        .select("id, horse_id, show_name, placement, class_name, nan_card_type, nan_year, verification_tier")
        .eq("horse_id", horseId)
        .eq("is_nan_qualifying", true)
        .order("nan_year", { ascending: false });

    if (!data || data.length === 0) return [];

    // Get horse name
    const { data: horse } = await supabase
        .from("user_horses")
        .select("custom_name")
        .eq("id", horseId)
        .single();

    const horseName = (horse as { custom_name: string } | null)?.custom_name || "Unknown Horse";

    return (data as Record<string, unknown>[]).map(r => ({
        horseId,
        horseName,
        nanYear: r.nan_year as number,
        cardType: r.nan_card_type as string,
        showName: r.show_name as string,
        placement: r.placement as string,
        className: r.class_name as string | null,
        recordId: r.id as string,
        verificationTier: r.verification_tier as string,
    }));
}

/** Get NAN qualification summary across all user's horses */
export async function getNanDashboard(): Promise<NanHorseSummary[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Get all user's horses
    const { data: horses } = await supabase
        .from("user_horses")
        .select("id, custom_name")
        .eq("owner_id", user.id);

    if (!horses || horses.length === 0) return [];

    const horseIds = (horses as { id: string }[]).map(h => h.id);

    // Get all NAN records for these horses
    const { data: nanRecords } = await supabase
        .from("show_records")
        .select("horse_id, nan_card_type, nan_year")
        .in("horse_id", horseIds)
        .eq("is_nan_qualifying", true);

    // Build summary per horse
    const horseMap = new Map<string, string>();
    (horses as { id: string; custom_name: string }[]).forEach(h => horseMap.set(h.id, h.custom_name));

    const summaryMap = new Map<string, { qualifications: Map<string, number>; totalCards: number }>();

    for (const r of (nanRecords || []) as { horse_id: string; nan_card_type: string; nan_year: number }[]) {
        if (!summaryMap.has(r.horse_id)) {
            summaryMap.set(r.horse_id, { qualifications: new Map(), totalCards: 0 });
        }
        const s = summaryMap.get(r.horse_id)!;
        const key = `${r.nan_year}-${r.nan_card_type}`;
        s.qualifications.set(key, (s.qualifications.get(key) || 0) + 1);
        s.totalCards++;
    }

    // Return all horses (even those with no cards)
    return (horses as { id: string; custom_name: string }[]).map(h => {
        const s = summaryMap.get(h.id);
        const qualifications: { year: number; cardType: string; count: number }[] = [];
        if (s) {
            for (const [key, count] of s.qualifications) {
                const [yearStr, cardType] = key.split("-");
                qualifications.push({ year: parseInt(yearStr), cardType, count });
            }
        }
        return {
            horseId: h.id,
            horseName: h.custom_name,
            qualifications,
            totalCards: s?.totalCards || 0,
        };
    });
}

// ── Enhanced Show Records ──

/** Add a show record with NAN fields */
export async function addShowRecord(data: {
    horseId: string;
    showName: string;
    showDate: string;
    placement: string;
    showType?: string;
    sanctioningBody?: string;
    className?: string;
    totalEntries?: number;
    isNanQualifying?: boolean;
    nanCardType?: string;
    nanYear?: number;
    notes?: string;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Verify horse ownership
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id")
        .eq("id", data.horseId)
        .eq("owner_id", user.id)
        .single();

    if (!horse) return { success: false, error: "Horse not found or not owned by you." };

    const { error } = await supabase.from("show_records").insert({
        horse_id: data.horseId,
        user_id: user.id,
        show_name: data.showName,
        show_date: data.showDate,
        placement: data.placement,
        show_type: data.showType || "photo_other",
        sanctioning_body: data.sanctioningBody || null,
        class_name: data.className || null,
        total_entries: data.totalEntries || null,
        is_nan_qualifying: data.isNanQualifying || false,
        nan_card_type: data.isNanQualifying ? (data.nanCardType || null) : null,
        nan_year: data.isNanQualifying ? (data.nanYear || new Date().getFullYear()) : null,
        notes: data.notes || null,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath(`/community/${data.horseId}`);
    revalidatePath(`/community/${data.horseId}/hoofprint`);
    return { success: true };
}

/** Judge/admin verifies a show record */
export async function verifyShowRecord(
    recordId: string,
    note?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Check user is judge or admin
    const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

    const role = (profile as { role: string } | null)?.role;
    if (role !== "judge" && role !== "admin") {
        return { success: false, error: "Only judges and admins can verify show records." };
    }

    const { error } = await supabase
        .from("show_records")
        .update({
            verification_tier: "host_verified",
            verified_by: user.id,
            judge_critique: note || null,
        })
        .eq("id", recordId);

    if (error) return { success: false, error: error.message };

    return { success: true };
}

// ── Show String Planner ──

/** Get all user's show strings */
export async function getShowStrings(): Promise<ShowString[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: strings } = await supabase
        .from("show_strings")
        .select("id, name, show_date, notes, created_at")
        .eq("user_id", user.id)
        .order("show_date", { ascending: true, nullsFirst: false });

    if (!strings || strings.length === 0) return [];

    // Get entry counts
    const stringIds = (strings as { id: string }[]).map(s => s.id);
    const { data: entries } = await supabase
        .from("show_string_entries")
        .select("show_string_id")
        .in("show_string_id", stringIds);

    const countMap = new Map<string, number>();
    for (const e of (entries || []) as { show_string_id: string }[]) {
        countMap.set(e.show_string_id, (countMap.get(e.show_string_id) || 0) + 1);
    }

    return (strings as Record<string, unknown>[]).map(s => ({
        id: s.id as string,
        name: s.name as string,
        showDate: s.show_date as string | null,
        notes: s.notes as string | null,
        createdAt: s.created_at as string,
        entryCount: countMap.get(s.id as string) || 0,
    }));
}

/** Create a new show string */
export async function createShowString(data: {
    name: string;
    showDate?: string;
    notes?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    if (!data.name.trim()) return { success: false, error: "Show string name is required." };

    const { data: result, error } = await supabase
        .from("show_strings")
        .insert({
            user_id: user.id,
            name: data.name.trim(),
            show_date: data.showDate || null,
            notes: data.notes?.trim() || null,
        })
        .select("id")
        .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/shows/planner");
    return { success: true, id: (result as { id: string }).id };
}

/** Add a horse + class to a show string */
export async function addShowStringEntry(data: {
    showStringId: string;
    horseId: string;
    className: string;
    division?: string;
    timeSlot?: string;
    notes?: string;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Verify ownership of show string
    const { data: showString } = await supabase
        .from("show_strings")
        .select("id")
        .eq("id", data.showStringId)
        .eq("user_id", user.id)
        .single();

    if (!showString) return { success: false, error: "Show string not found." };

    const { error } = await supabase.from("show_string_entries").insert({
        show_string_id: data.showStringId,
        horse_id: data.horseId,
        class_name: data.className,
        division: data.division || null,
        time_slot: data.timeSlot || null,
        notes: data.notes || null,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/shows/planner");
    return { success: true };
}

/** Remove an entry from a show string */
export async function removeShowStringEntry(entryId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const { error } = await supabase
        .from("show_string_entries")
        .delete()
        .eq("id", entryId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/shows/planner");
    return { success: true };
}

/** Get entries for a show string */
export async function getShowStringEntries(showStringId: string): Promise<ShowStringEntry[]> {
    const supabase = await createClient();

    const { data: entries } = await supabase
        .from("show_string_entries")
        .select("id, show_string_id, horse_id, class_name, division, time_slot, notes")
        .eq("show_string_id", showStringId)
        .order("created_at", { ascending: true });

    if (!entries || entries.length === 0) return [];

    // Fetch horse names
    const horseIds = [...new Set((entries as { horse_id: string }[]).map(e => e.horse_id))];
    const { data: horses } = await supabase
        .from("user_horses")
        .select("id, custom_name")
        .in("id", horseIds);

    const nameMap = new Map<string, string>();
    (horses || [] as { id: string; custom_name: string }[]).forEach((h: { id: string; custom_name: string }) =>
        nameMap.set(h.id, h.custom_name)
    );

    return (entries as Record<string, unknown>[]).map(e => ({
        id: e.id as string,
        showStringId: e.show_string_id as string,
        horseId: e.horse_id as string,
        horseName: nameMap.get(e.horse_id as string) || "Unknown Horse",
        className: e.class_name as string,
        division: e.division as string | null,
        timeSlot: e.time_slot as string | null,
        notes: e.notes as string | null,
    }));
}

/** Convert show string entries into show records after a show */
export async function convertShowStringToResults(
    showStringId: string,
    results: {
        entryId: string;
        placement: string;
        totalEntries?: number;
        isNanQualifying?: boolean;
        nanCardType?: string;
    }[]
): Promise<{ success: boolean; count?: number; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Get the show string
    const { data: showString } = await supabase
        .from("show_strings")
        .select("id, name, show_date, user_id")
        .eq("id", showStringId)
        .eq("user_id", user.id)
        .single();

    if (!showString) return { success: false, error: "Show string not found." };
    const ss = showString as { id: string; name: string; show_date: string | null; user_id: string };

    // Get all entries for this show string
    const { data: entries } = await supabase
        .from("show_string_entries")
        .select("id, horse_id, class_name, division")
        .eq("show_string_id", showStringId);

    if (!entries || entries.length === 0) return { success: false, error: "No entries in this show string." };

    const entryMap = new Map<string, { horse_id: string; class_name: string; division: string | null }>();
    for (const e of entries as { id: string; horse_id: string; class_name: string; division: string | null }[]) {
        entryMap.set(e.id, { horse_id: e.horse_id, class_name: e.class_name, division: e.division });
    }

    const showDate = ss.show_date || new Date().toISOString().split("T")[0];
    const nanYear = new Date(showDate).getFullYear();

    // Create show_records from results
    const records = results
        .filter(r => entryMap.has(r.entryId))
        .map(r => {
            const entry = entryMap.get(r.entryId)!;
            return {
                horse_id: entry.horse_id,
                user_id: user.id,
                show_name: ss.name,
                show_date: showDate,
                placement: r.placement,
                class_name: entry.class_name,
                total_entries: r.totalEntries || null,
                is_nan_qualifying: r.isNanQualifying || false,
                nan_card_type: r.isNanQualifying ? (r.nanCardType || null) : null,
                nan_year: r.isNanQualifying ? nanYear : null,
            };
        });

    if (records.length === 0) return { success: false, error: "No valid results to record." };

    const { error } = await supabase.from("show_records").insert(records);

    if (error) return { success: false, error: error.message };

    revalidatePath("/shows/planner");
    revalidatePath("/dashboard");
    return { success: true, count: records.length };
}

/** Detect time slot conflicts in a show string */
export async function detectConflicts(showStringId: string): Promise<{
    conflicts: { entryA: string; entryB: string; reason: string }[];
}> {
    const supabase = await createClient();

    const { data: entries } = await supabase
        .from("show_string_entries")
        .select("id, horse_id, class_name, time_slot")
        .eq("show_string_id", showStringId)
        .order("time_slot", { ascending: true });

    if (!entries || entries.length < 2) return { conflicts: [] };

    const conflicts: { entryA: string; entryB: string; reason: string }[] = [];
    const typedEntries = entries as { id: string; horse_id: string; class_name: string; time_slot: string | null }[];

    for (let i = 0; i < typedEntries.length; i++) {
        for (let j = i + 1; j < typedEntries.length; j++) {
            const a = typedEntries[i];
            const b = typedEntries[j];

            // Same horse in same time slot
            if (a.horse_id === b.horse_id && a.time_slot && a.time_slot === b.time_slot) {
                conflicts.push({
                    entryA: a.id,
                    entryB: b.id,
                    reason: `Same horse in overlapping time slot "${a.time_slot}"`,
                });
            }

            // Same horse in same class
            if (a.horse_id === b.horse_id && a.class_name === b.class_name) {
                conflicts.push({
                    entryA: a.id,
                    entryB: b.id,
                    reason: `Same horse entered twice in "${a.class_name}"`,
                });
            }
        }
    }

    return { conflicts };
}

/** Delete a show string */
export async function deleteShowString(showStringId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const { error } = await supabase
        .from("show_strings")
        .delete()
        .eq("id", showStringId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/shows/planner");
    return { success: true };
}
