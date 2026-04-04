"use server";

import { requireAuth } from "@/lib/auth";
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
    qualifications: { year: number; cardType: string; count: number; isExpired: boolean }[];
    totalCards: number;
    activeCards: number;
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
    classId: string | null;
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
        .select("id, horse_id, show_name, placing, class_name, nan_card_type, nan_year, verification_tier")
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
        placement: r.placing as string,
        className: r.class_name as string | null,
        recordId: r.id as string,
        verificationTier: r.verification_tier as string,
    }));
}

/** Get NAN qualification summary across all user's horses */
export async function getNanDashboard(): Promise<NanHorseSummary[]> {
    const { supabase, user } = await requireAuth();

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
    // NAMHSA 4-year expiry rule: cards older than 4 years are expired but still shown
    const currentYear = new Date().getFullYear();
    return (horses as { id: string; custom_name: string }[]).map(h => {
        const s = summaryMap.get(h.id);
        const qualifications: { year: number; cardType: string; count: number; isExpired: boolean }[] = [];
        let activeCards = 0;
        if (s) {
            for (const [key, count] of s.qualifications) {
                const [yearStr, cardType] = key.split("-");
                const year = parseInt(yearStr);
                const isExpired = currentYear - year > 3;
                qualifications.push({ year, cardType, count, isExpired });
                if (!isExpired) activeCards += count;
            }
        }
        // Sort: active first (newest year), then expired
        qualifications.sort((a, b) => {
            if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
            return b.year - a.year;
        });
        return {
            horseId: h.id,
            horseName: h.custom_name,
            qualifications,
            totalCards: s?.totalCards || 0,
            activeCards,
        };
    });
}

/** Export all NAN cards for the current user as structured data (for CSV route) */
export async function exportNanCards(): Promise<{
    records: { horseName: string; nanYear: number; cardType: string; showName: string; placement: string; className: string | null; isExpired: boolean }[];
}> {
    const { supabase, user } = await requireAuth();

    const { data: horses } = await supabase
        .from("user_horses")
        .select("id, custom_name")
        .eq("owner_id", user.id);

    if (!horses || horses.length === 0) return { records: [] };

    const horseIds = (horses as { id: string }[]).map(h => h.id);
    const horseNameMap = new Map<string, string>();
    (horses as { id: string; custom_name: string }[]).forEach(h => horseNameMap.set(h.id, h.custom_name));

    const { data: nanRecords } = await supabase
        .from("show_records")
        .select("horse_id, show_name, placing, class_name, nan_card_type, nan_year")
        .in("horse_id", horseIds)
        .eq("is_nan_qualifying", true)
        .order("nan_year", { ascending: false });

    if (!nanRecords || nanRecords.length === 0) return { records: [] };

    const currentYear = new Date().getFullYear();

    const records = (nanRecords as { horse_id: string; show_name: string; placing: string; class_name: string | null; nan_card_type: string; nan_year: number }[]).map(r => ({
        horseName: horseNameMap.get(r.horse_id) || "Unknown",
        nanYear: r.nan_year,
        cardType: r.nan_card_type,
        showName: r.show_name,
        placement: r.placing,
        className: r.class_name,
        isExpired: currentYear - r.nan_year > 3,
    }));

    // Sort by year DESC, then horse name
    records.sort((a, b) => {
        if (a.nanYear !== b.nanYear) return b.nanYear - a.nanYear;
        return a.horseName.localeCompare(b.horseName);
    });

    return { records };
}

// ── Judge Conflict of Interest ──

/**
 * Check if a judge has a conflict of interest with an event.
 * Advisory only — does not block assignment. Per NAMHSA guidelines, hosts make final decisions.
 */
export async function checkJudgeCOI(
    judgeUserId: string,
    eventId: string
): Promise<{ hasConflict: boolean; conflicts: string[] }> {
    const supabase = await createClient();
    const conflicts: string[] = [];

    // 1. Check: judge owns a horse entered in this event
    const { data: ownEntries } = await supabase
        .from("event_entries")
        .select("id, user_horses!inner(custom_name)")
        .eq("event_id", eventId)
        .eq("user_id", judgeUserId)
        .eq("entry_type", "entered")
        .limit(5);

    if (ownEntries && ownEntries.length > 0) {
        const names = (ownEntries as { user_horses: { custom_name: string } }[])
            .map(e => e.user_horses?.custom_name || "a horse")
            .slice(0, 3);
        conflicts.push(`Judge owns ${names.length} entered horse${names.length > 1 ? "s" : ""}: ${names.join(", ")}`);
    }

    // 2. Check: judge previously owned a horse entered in this event (12-month lookback)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const { data: entries } = await supabase
        .from("event_entries")
        .select("horse_id")
        .eq("event_id", eventId)
        .eq("entry_type", "entered");

    if (entries && entries.length > 0) {
        const horseIds = [...new Set((entries as { horse_id: string }[]).map(e => e.horse_id))];

        const { data: priorOwnership } = await supabase
            .from("horse_ownership_history")
            .select("horse_id, horse_name")
            .eq("owner_id", judgeUserId)
            .in("horse_id", horseIds)
            .gte("released_at", twelveMonthsAgo.toISOString())
            .limit(5);

        if (priorOwnership && priorOwnership.length > 0) {
            const names = (priorOwnership as { horse_name: string | null }[])
                .map(h => h.horse_name || "a horse")
                .slice(0, 3);
            conflicts.push(`Judge previously owned ${names.length} entered horse${names.length > 1 ? "s" : ""} (within 12 months): ${names.join(", ")}`);
        }
    }

    // 3. Check: judge is the show host
    const { data: event } = await supabase
        .from("events")
        .select("created_by")
        .eq("id", eventId)
        .single();

    if (event && (event as { created_by: string }).created_by === judgeUserId) {
        conflicts.push("Judge is the show host/creator");
    }

    return { hasConflict: conflicts.length > 0, conflicts };
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
    const { supabase, user } = await requireAuth();

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
        placing: data.placement,
        show_type: data.showType || "photo_other",
        sanctioning_body: data.sanctioningBody || null,
        class_name: data.className || null,
        total_entries: data.totalEntries || null,
        is_nan_qualifying: data.isNanQualifying || false,
        nan_card_type: data.isNanQualifying ? (data.nanCardType || null) : null,
        nan_year: data.isNanQualifying ? (data.nanYear || new Date().getFullYear()) : null,
        notes: data.notes || null,
        verification_tier: "self_reported",
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
    const { supabase, user } = await requireAuth();

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

// ── Live Show Packer ──

/** Get all user's show strings */
export async function getShowStrings(): Promise<ShowString[]> {
    const { supabase, user } = await requireAuth();

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
    const { supabase, user } = await requireAuth();

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
    classId?: string;
    division?: string;
    timeSlot?: string;
    notes?: string;
}): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

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
        class_id: data.classId || null,
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
        .select("id, show_string_id, horse_id, class_name, class_id, division, time_slot, notes")
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

    // If any entries have class_id, fetch class names
    const classIds = (entries as { class_id: string | null }[]).filter(e => e.class_id).map(e => e.class_id as string);
    const classNameMap = new Map<string, string>();
    if (classIds.length > 0) {
        const { data: classes } = await supabase
            .from("event_classes")
            .select("id, name, class_number")
            .in("id", classIds);
        for (const c of (classes || []) as { id: string; name: string; class_number: string | null }[]) {
            classNameMap.set(c.id, c.class_number ? `${c.class_number}: ${c.name}` : c.name);
        }
    }

    return (entries as Record<string, unknown>[]).map(e => ({
        id: e.id as string,
        showStringId: e.show_string_id as string,
        horseId: e.horse_id as string,
        horseName: nameMap.get(e.horse_id as string) || "Unknown Horse",
        className: e.class_id ? (classNameMap.get(e.class_id as string) || e.class_name as string) : e.class_name as string,
        classId: e.class_id as string | null,
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
    const { supabase, user } = await requireAuth();

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
        .select("id, horse_id, class_name, class_id, division")
        .eq("show_string_id", showStringId);

    if (!entries || entries.length === 0) return { success: false, error: "No entries in this show string." };

    const entryMap = new Map<string, { horse_id: string; class_name: string; class_id: string | null; division: string | null }>();
    for (const e of entries as { id: string; horse_id: string; class_name: string; class_id: string | null; division: string | null }[]) {
        entryMap.set(e.id, { horse_id: e.horse_id, class_name: e.class_name, class_id: e.class_id, division: e.division });
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
                placing: r.placement,
                class_name: entry.class_name,
                total_entries: r.totalEntries || null,
                is_nan_qualifying: r.isNanQualifying || false,
                nan_card_type: r.isNanQualifying ? (r.nanCardType || null) : null,
                nan_year: r.isNanQualifying ? nanYear : null,
                verification_tier: "platform_generated",
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

            // Handler time conflict: ANY two entries in the same time slot
            // (even different horses, because the handler can only be in one ring)
            if (a.time_slot && a.time_slot === b.time_slot && a.horse_id !== b.horse_id) {
                conflicts.push({
                    entryA: a.id,
                    entryB: b.id,
                    reason: `Handler Time Conflict: Two entries scheduled in time slot "${a.time_slot}". You can only handle one horse at a time.`,
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

// ── Division & Class Management ──

export interface Division {
    id: string;
    eventId: string;
    name: string;
    description: string | null;
    sortOrder: number;
    classes: DivisionClass[];
}

export interface DivisionClass {
    id: string;
    divisionId: string;
    name: string;
    classNumber: string | null;
    description: string | null;
    isNanQualifying: boolean;
    maxEntries: number | null;
    allowedScales: string[] | null;
    sortOrder: number;
    entryCount?: number;
}

/** Get all divisions + their classes for an event, ordered by sort_order */
export async function getEventDivisions(eventId: string): Promise<Division[]> {
    const supabase = await createClient();

    const { data: divisions } = await supabase
        .from("event_divisions")
        .select("id, event_id, name, description, sort_order")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });

    if (!divisions || divisions.length === 0) return [];

    const divisionIds = (divisions as { id: string }[]).map(d => d.id);

    const { data: classes } = await supabase
        .from("event_classes")
        .select("id, division_id, name, class_number, description, is_nan_qualifying, max_entries, allowed_scales, sort_order")
        .in("division_id", divisionIds)
        .order("sort_order", { ascending: true });

    // Get entry counts per class
    const classIds = ((classes || []) as { id: string }[]).map(c => c.id);
    let entryCountMap = new Map<string, number>();
    if (classIds.length > 0) {
        const { data: entries } = await supabase
            .from("event_entries")
            .select("class_id")
            .in("class_id", classIds);
        for (const e of (entries || []) as { class_id: string }[]) {
            entryCountMap.set(e.class_id, (entryCountMap.get(e.class_id) || 0) + 1);
        }
    }

    const classMap = new Map<string, DivisionClass[]>();
    for (const c of (classes || []) as Record<string, unknown>[]) {
        const divId = c.division_id as string;
        if (!classMap.has(divId)) classMap.set(divId, []);
        classMap.get(divId)!.push({
            id: c.id as string,
            divisionId: divId,
            name: c.name as string,
            classNumber: c.class_number as string | null,
            description: c.description as string | null,
            isNanQualifying: c.is_nan_qualifying as boolean,
            maxEntries: c.max_entries as number | null,
            allowedScales: c.allowed_scales as string[] | null,
            sortOrder: c.sort_order as number,
            entryCount: entryCountMap.get(c.id as string) || 0,
        });
    }

    return (divisions as Record<string, unknown>[]).map(d => ({
        id: d.id as string,
        eventId: d.event_id as string,
        name: d.name as string,
        description: d.description as string | null,
        sortOrder: d.sort_order as number,
        classes: classMap.get(d.id as string) || [],
    }));
}

/** Create a division in an event */
export async function createDivision(data: {
    eventId: string;
    name: string;
    description?: string;
    sortOrder?: number;
}): Promise<{ success: boolean; id?: string; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Verify event ownership
    const { data: event } = await supabase
        .from("events")
        .select("id")
        .eq("id", data.eventId)
        .eq("created_by", user.id)
        .single();
    if (!event) return { success: false, error: "Event not found or not owned by you." };

    const { data: result, error } = await supabase
        .from("event_divisions")
        .insert({
            event_id: data.eventId,
            name: data.name.trim(),
            description: data.description?.trim() || null,
            sort_order: data.sortOrder ?? 0,
        })
        .select("id")
        .single();

    if (error) return { success: false, error: error.message };
    revalidatePath(`/community/events/${data.eventId}`);
    return { success: true, id: (result as { id: string }).id };
}

/** Update a division */
export async function updateDivision(divisionId: string, data: {
    name?: string;
    description?: string;
    sortOrder?: number;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name.trim();
    if (data.description !== undefined) update.description = data.description.trim() || null;
    if (data.sortOrder !== undefined) update.sort_order = data.sortOrder;

    const { error } = await supabase
        .from("event_divisions")
        .update(update)
        .eq("id", divisionId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/** Delete a division (cascades to classes and entries) */
export async function deleteDivision(divisionId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const { error } = await supabase
        .from("event_divisions")
        .delete()
        .eq("id", divisionId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/** Create a class within a division */
export async function createClass(data: {
    divisionId: string;
    name: string;
    classNumber?: string;
    description?: string;
    isNanQualifying?: boolean;
    maxEntries?: number;
    allowedScales?: string[];
    sortOrder?: number;
}): Promise<{ success: boolean; id?: string; error?: string }> {
    const supabase = await createClient();

    const { data: result, error } = await supabase
        .from("event_classes")
        .insert({
            division_id: data.divisionId,
            name: data.name.trim(),
            class_number: data.classNumber?.trim() || null,
            description: data.description?.trim() || null,
            is_nan_qualifying: data.isNanQualifying || false,
            max_entries: data.maxEntries || null,
            allowed_scales: data.allowedScales && data.allowedScales.length > 0 ? data.allowedScales : null,
            sort_order: data.sortOrder ?? 0,
        })
        .select("id")
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, id: (result as { id: string }).id };
}

/** Update a class */
export async function updateClass(classId: string, data: {
    name?: string;
    classNumber?: string;
    description?: string;
    isNanQualifying?: boolean;
    maxEntries?: number;
    allowedScales?: string[] | null;
    sortOrder?: number;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name.trim();
    if (data.classNumber !== undefined) update.class_number = data.classNumber.trim() || null;
    if (data.description !== undefined) update.description = data.description.trim() || null;
    if (data.isNanQualifying !== undefined) update.is_nan_qualifying = data.isNanQualifying;
    if (data.maxEntries !== undefined) update.max_entries = data.maxEntries || null;
    if (data.allowedScales !== undefined) update.allowed_scales = data.allowedScales && data.allowedScales.length > 0 ? data.allowedScales : null;
    if (data.sortOrder !== undefined) update.sort_order = data.sortOrder;

    const { error } = await supabase
        .from("event_classes")
        .update(update)
        .eq("id", classId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/** Delete a class */
export async function deleteClass(classId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const { error } = await supabase
        .from("event_classes")
        .delete()
        .eq("id", classId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/** Bulk reorder divisions by array position */
export async function reorderDivisions(divisionIds: string[]): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    for (let i = 0; i < divisionIds.length; i++) {
        const { error } = await supabase
            .from("event_divisions")
            .update({ sort_order: i })
            .eq("id", divisionIds[i]);
        if (error) return { success: false, error: error.message };
    }

    return { success: true };
}

/** Bulk reorder classes by array position */
export async function reorderClasses(classIds: string[]): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    for (let i = 0; i < classIds.length; i++) {
        const { error } = await supabase
            .from("event_classes")
            .update({ sort_order: i })
            .eq("id", classIds[i]);
        if (error) return { success: false, error: error.message };
    }

    return { success: true };
}

/** Copy division/class tree from another event */
export async function copyDivisionsFromEvent(
    sourceEventId: string,
    targetEventId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Verify target event ownership
    const { data: event } = await supabase
        .from("events")
        .select("id")
        .eq("id", targetEventId)
        .eq("created_by", user.id)
        .single();
    if (!event) return { success: false, error: "Target event not found or not owned by you." };

    // Get source tree
    const sourceDivisions = await getEventDivisions(sourceEventId);
    if (sourceDivisions.length === 0) return { success: false, error: "Source event has no divisions." };

    let classCount = 0;
    for (const div of sourceDivisions) {
        const divResult = await createDivision({
            eventId: targetEventId,
            name: div.name,
            description: div.description || undefined,
            sortOrder: div.sortOrder,
        });
        if (!divResult.success || !divResult.id) continue;

        for (const cls of div.classes) {
            await createClass({
                divisionId: divResult.id,
                name: cls.name,
                classNumber: cls.classNumber || undefined,
                description: cls.description || undefined,
                isNanQualifying: cls.isNanQualifying,
                maxEntries: cls.maxEntries || undefined,
                sortOrder: cls.sortOrder,
            });
            classCount++;
        }
    }

    revalidatePath(`/community/events/${targetEventId}`);
    return { success: true, count: classCount };
}

/** Duplicate a show string with all its entries */
export async function duplicateShowString(
    stringId: string
): Promise<{ success: boolean; newStringId?: string; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Fetch original
    const { data: original } = await supabase
        .from("show_strings")
        .select("name, notes, user_id")
        .eq("id", stringId)
        .eq("user_id", user.id)
        .single();

    if (!original) return { success: false, error: "Show string not found or not yours." };
    const o = original as { name: string; notes: string | null };

    // Create copy
    const { data: newString, error } = await supabase
        .from("show_strings")
        .insert({
            user_id: user.id,
            name: `${o.name} (copy)`,
            notes: o.notes,
        })
        .select("id")
        .single();

    if (error || !newString) return { success: false, error: error?.message || "Failed to create copy." };
    const newId = (newString as { id: string }).id;

    // Copy entries
    const { data: entries } = await supabase
        .from("show_string_entries")
        .select("horse_id, class_name, class_id, division, time_slot, notes")
        .eq("show_string_id", stringId);

    if (entries && entries.length > 0) {
        const inserts = (entries as { horse_id: string; class_name: string; class_id: string | null; division: string | null; time_slot: string | null; notes: string | null }[]).map(e => ({
            show_string_id: newId,
            horse_id: e.horse_id,
            class_name: e.class_name,
            class_id: e.class_id,
            division: e.division,
            time_slot: e.time_slot,
            notes: e.notes,
        }));
        await supabase.from("show_string_entries").insert(inserts);
    }

    revalidatePath("/shows/planner");
    return { success: true, newStringId: newId };
}
