/**
 * /api/export/show-results-v2/[showId] — the NAMHSA-format
 * results file for a completed v2 show (Phase F).
 *
 * ON-DEMAND GENERATION, no storage bucket: results derive entirely
 * from live tables that are already permanent (placings, entries,
 * callbacks), so persisting a file would only create a second
 * source of truth that can go stale when a host corrects a
 * placing. Each download regenerates from the current data and
 * records a show_results_docs row (storage_path 'on-demand' as the
 * marker) as the audit trail of when results files were produced.
 *
 * Auth follows the export-route conventions (src/app/api/export/
 * route.ts): user client + explicit auth check — and, stricter
 * here, host/co_host only, matching the console button that links
 * to this route. RLS gates every read regardless.
 */

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { showsV2Enabled } from "@/lib/shows/flags";
import {
    getAliases,
    getHorseNames,
    getShowRole,
    loadClassContexts,
} from "@/lib/shows/queries";
import { buildShowResultsCsv } from "@/lib/shows/resultsExport";
import type { CallbackScope, EntryStatus, Place, ShowMode } from "@/lib/shows/types";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ showId: string }> },
) {
    if (!showsV2Enabled()) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { showId } = await params;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ctx = await getShowRole(supabase, showId, user.id);
    if ("error" in ctx) {
        return NextResponse.json({ error: "Show not found" }, { status: 404 });
    }
    if (!ctx.role || (ctx.role !== "host" && ctx.role !== "co_host")) {
        return NextResponse.json(
            { error: "Only the host or a co-host can export results" },
            { status: 403 },
        );
    }
    if (ctx.show.status !== "completed" && ctx.show.status !== "archived") {
        return NextResponse.json(
            { error: "Results are not final — complete the show first" },
            { status: 403 },
        );
    }

    // ── Show header fields ──
    const { data: show, error: showError } = await supabase
        .from("shows")
        .select("id, title, mode, host_id, show_date, entries_close_at, judging_ends_at")
        .eq("id", showId)
        .maybeSingle();
    if (showError || !show) {
        return NextResponse.json({ error: "Show not found" }, { status: 404 });
    }

    // ── Classlist (published run order) + entries + placings + ladder ──
    const tree = await loadClassContexts(supabase, showId);
    if ("error" in tree) {
        return NextResponse.json({ error: tree.error }, { status: 500 });
    }

    const { data: entryRows, error: eErr } = await supabase
        .from("show_class_entries")
        .select("id, class_id, horse_id, owner_id, status")
        .eq("show_id", showId);
    if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });
    const entries = (entryRows ?? []).map(
        (e: {
            id: string;
            class_id: string;
            horse_id: string;
            owner_id: string;
            status: string;
        }) => ({
            id: e.id,
            classId: e.class_id,
            horseId: e.horse_id,
            ownerId: e.owner_id,
            status: e.status as EntryStatus,
        }),
    );

    const classIds = tree.contexts.map((c) => c.classId);
    let placings: { entryId: string; classId: string; place: Place | null }[] = [];
    if (classIds.length > 0) {
        const { data: placingRows, error: pErr } = await supabase
            .from("show_placings")
            .select("entry_id, class_id, place")
            .in("class_id", classIds);
        if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
        placings = (placingRows ?? []).map(
            (p: { entry_id: string; class_id: string; place: number | null }) => ({
                entryId: p.entry_id,
                classId: p.class_id,
                place: (p.place as Place | null) ?? null,
            }),
        );
    }

    const { data: callbackRows, error: cbErr } = await supabase
        .from("show_callbacks")
        .select("scope, scope_id, champion_entry_id, reserve_entry_id")
        .eq("show_id", showId);
    if (cbErr) return NextResponse.json({ error: cbErr.message }, { status: 500 });

    // ── Names: horses, owners, host ──
    const horseNames = await getHorseNames(
        supabase,
        entries.map((e) => e.horseId),
    );
    if (!(horseNames instanceof Map)) {
        return NextResponse.json({ error: horseNames.error }, { status: 500 });
    }
    const aliases = await getAliases(supabase, [
        ...entries.map((e) => e.ownerId),
        show.host_id as string,
    ]);
    if (!(aliases instanceof Map)) {
        return NextResponse.json({ error: aliases.error }, { status: 500 });
    }

    const csv = buildShowResultsCsv({
        show: {
            title: show.title as string,
            mode: show.mode as ShowMode,
            showDate: (show.show_date as string | null) ?? null,
            entriesCloseAt: (show.entries_close_at as string | null) ?? null,
            judgingEndsAt: (show.judging_ends_at as string | null) ?? null,
            hostAlias: aliases.get(show.host_id as string) ?? "unknown",
        },
        classes: tree.contexts,
        entries,
        placings,
        callbacks: (callbackRows ?? []).map(
            (r: {
                scope: string;
                scope_id: string | null;
                champion_entry_id: string | null;
                reserve_entry_id: string | null;
            }) => ({
                scope: r.scope as CallbackScope,
                scopeId: r.scope_id ?? null,
                championEntryId: r.champion_entry_id ?? null,
                reserveEntryId: r.reserve_entry_id ?? null,
            }),
        ),
        horseNames,
        ownerAliases: aliases,
        fallbackDate: new Date().toISOString().slice(0, 10),
    });

    // Audit trail: one show_results_docs row per generation. The
    // file itself is not stored (see header comment) — the row
    // records THAT and WHEN a results file was produced, which is
    // what the NAMHSA 30-day requirement needs evidence of.
    // Non-fatal: the download must not break if the audit insert
    // hiccups.
    await supabase.from("show_results_docs").insert({
        show_id: showId,
        format: "csv",
        storage_path: "on-demand",
    });

    const safeFilename =
        (show.title as string).replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_") ||
        "show";

    return new NextResponse(csv, {
        status: 200,
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${safeFilename}_results.csv"`,
            "Cache-Control": "no-cache, no-store",
        },
    });
}
