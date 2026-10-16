import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/auth";
import { getShowRole } from "@/lib/shows/queries";
import { renderToBuffer } from "@react-pdf/renderer";
import ShowTags from "@/components/pdf/ShowTags";
import QRCode from "qrcode";
import type { SupabaseClient } from "@supabase/supabase-js";

// GET /api/export/show-tags?showId=X[&all=true] — printable show tags PDF.
//
// A signed-in member with entries prints THEIR OWN tags; a host or
// co-host prints every entrant's with &all=true. Pro-gated.
//
// Serves v2 shows (the shows / show_class_entries domain every show
// has used since the cutover) and falls back to the legacy events
// domain for the old completed shows. Until 2026-10-12 only the legacy
// path existed, so the feature advertised on /upgrade was unreachable
// for any current show.

type TagEntry = {
    horseName: string;
    moldName: string;
    className: string;
    entryNumber: number;
    ownerAlias: string;
    breed: string;
    gender: string;
    finishType: string;
    horseNumber: string;
    passportUrl: string;
    qrMatrix: boolean[][];
};

type HorseRow = {
    id: string;
    custom_name: string;
    finish_type: string | null;
    assigned_breed: string | null;
    assigned_gender: string | null;
    regional_id: string | null;
    catalog_items: { title: string } | null;
};

const HORSE_COLUMNS =
    "id, custom_name, catalog_id, finish_type, assigned_breed, assigned_gender, regional_id, catalog_items:catalog_id(title)";

async function qrMatrix(url: string): Promise<boolean[][]> {
    try {
        const qr = QRCode.create(url, { errorCorrectionLevel: "L" });
        const size = qr.modules.size;
        return Array.from({ length: size }, (_, row) =>
            Array.from({ length: size }, (_, col) => qr.modules.get(row, col) === 1),
        );
    } catch {
        return [];
    }
}

/** Region-style "XXX-YYY" when the owner holds an exhibitor number, else the show's leg-tag number. */
function horseNumberFor(
    exhibitorNumber: string | null | undefined,
    regionalId: string | null | undefined,
    entryNumber: number,
): string {
    const seq = regionalId || String(entryNumber).padStart(3, "0");
    return exhibitorNumber ? `${exhibitorNumber}-${seq}` : `#${entryNumber}`;
}

function pdfResponse(buffer: Buffer | Uint8Array, showId: string) {
    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="show-tags-${showId}.pdf"`,
        },
    });
}

function fmtDate(iso: string | null | undefined): string {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function GET(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tier = await getUserTier();
    if (tier === "free") {
        return NextResponse.json(
            { error: "Show Tags are a Pro feature. Upgrade to MHH Pro to print show tags." },
            { status: 403 },
        );
    }

    const { searchParams } = new URL(request.url);
    const showId = searchParams.get("showId");
    if (!showId) return NextResponse.json({ error: "Missing showId" }, { status: 400 });
    const printAll = searchParams.get("all") === "true";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

    // ── v2 shows ──
    const { data: show } = await supabase
        .from("shows")
        .select("id, title, show_date, judging_ends_at, entries_close_at, host_id, status")
        .eq("id", showId)
        .maybeSingle();

    if (show) {
        let all = false;
        if (printAll) {
            const ctx = await getShowRole(supabase as unknown as SupabaseClient, showId, user.id);
            all = !("error" in ctx) && (ctx.role === "host" || ctx.role === "co_host");
        }
        let entryQuery = supabase
            .from("show_class_entries")
            .select("id, horse_id, owner_id, class_id, entry_number, status")
            .eq("show_id", showId)
            .neq("status", "scratched");
        if (!all) entryQuery = entryQuery.eq("owner_id", user.id);
        const { data: rows } = await entryQuery;
        const entries = (rows ?? []) as {
            id: string;
            horse_id: string;
            owner_id: string;
            class_id: string;
            entry_number: number | null;
        }[];
        if (entries.length === 0) return NextResponse.json({ error: "No entries found" }, { status: 404 });

        const classIds = [...new Set(entries.map((e) => e.class_id))];
        const horseIds = [...new Set(entries.map((e) => e.horse_id))];
        const ownerIds = [...new Set(entries.map((e) => e.owner_id))];
        const [{ data: classRows }, { data: horseRows }, { data: ownerRows }] = await Promise.all([
            supabase.from("show_classes").select("id, name, class_number").in("id", classIds),
            supabase.from("user_horses").select(HORSE_COLUMNS).in("id", horseIds),
            supabase.from("users").select("id, alias_name, exhibitor_number").in("id", ownerIds),
        ]);
        const classMap = new Map(
            ((classRows ?? []) as { id: string; name: string; class_number: string | null }[]).map((c) => [
                c.id,
                { label: c.class_number ? `${c.class_number} · ${c.name}` : c.name, number: c.class_number ?? "" },
            ]),
        );
        const horseMap = new Map(((horseRows ?? []) as unknown as HorseRow[]).map((h) => [h.id, h]));
        const ownerMap = new Map(
            ((ownerRows ?? []) as { id: string; alias_name: string; exhibitor_number: string | null }[]).map((o) => [
                o.id,
                o,
            ]),
        );

        // Program order: class number, then leg-tag number.
        const sorted = [...entries].sort((a, b) => {
            const ca = classMap.get(a.class_id)?.number ?? "";
            const cb = classMap.get(b.class_id)?.number ?? "";
            return ca.localeCompare(cb, undefined, { numeric: true }) || (a.entry_number ?? 0) - (b.entry_number ?? 0);
        });

        const tagEntries: TagEntry[] = await Promise.all(
            sorted.map(async (e, i) => {
                const horse = horseMap.get(e.horse_id);
                const owner = ownerMap.get(e.owner_id);
                const entryNumber = e.entry_number ?? i + 1;
                // The public passport, which anyone scanning the tag can open.
                const passportUrl = `${appUrl}/community/${e.horse_id}`;
                return {
                    horseName: horse?.custom_name || "Unknown",
                    moldName: horse?.catalog_items?.title || "",
                    className: classMap.get(e.class_id)?.label || "General",
                    entryNumber,
                    ownerAlias: owner?.alias_name || "Anonymous",
                    breed: horse?.assigned_breed || "",
                    gender: horse?.assigned_gender || "",
                    finishType: horse?.finish_type || "",
                    horseNumber: horseNumberFor(owner?.exhibitor_number, horse?.regional_id, entryNumber),
                    passportUrl,
                    qrMatrix: await qrMatrix(passportUrl),
                };
            }),
        );

        const buffer = await renderToBuffer(
            ShowTags({
                showName: show.title as string,
                showDate: fmtDate((show.show_date ?? show.judging_ends_at ?? show.entries_close_at) as string | null),
                entries: tagEntries,
            }),
        );
        return pdfResponse(buffer, showId);
    }

    // ── Legacy events domain (completed shows from before the cutover) ──
    const { data: event } = await supabase
        .from("events")
        .select("name, starts_at, created_by")
        .eq("id", showId)
        .single();
    if (!event) return NextResponse.json({ error: "Show not found" }, { status: 404 });
    const ev = event as { name: string; starts_at: string; created_by: string };
    const isHost = ev.created_by === user.id;

    let entryQuery = supabase
        .from("event_entries")
        .select("id, horse_id, user_id, class_id, users!user_id(alias_name, exhibitor_number)")
        .eq("event_id", showId)
        .eq("entry_type", "entered");
    if (!printAll || !isHost) entryQuery = entryQuery.eq("user_id", user.id);
    const { data: rawEntries } = await entryQuery;
    if (!rawEntries || rawEntries.length === 0)
        return NextResponse.json({ error: "No entries found" }, { status: 404 });

    const horseIds = [...new Set(rawEntries.map((e) => e.horse_id))];
    const { data: horses } = await supabase.from("user_horses").select(HORSE_COLUMNS).in("id", horseIds);
    const horseMap = new Map(((horses ?? []) as unknown as HorseRow[]).map((h) => [h.id, h]));

    const classIds = [...new Set(rawEntries.filter((e) => e.class_id).map((e) => e.class_id!))];
    const classMap = new Map<string, string>();
    if (classIds.length > 0) {
        const { data: classRows } = await supabase.from("event_classes").select("id, name").in("id", classIds);
        for (const c of (classRows ?? []) as { id: string; name: string }[]) classMap.set(c.id, c.name);
    }

    const tagEntries: TagEntry[] = await Promise.all(
        rawEntries.map(async (e, i) => {
            const horse = horseMap.get(e.horse_id);
            const userInfo = e.users as { alias_name: string; exhibitor_number?: string | null } | null;
            const passportUrl = `${appUrl}/community/${e.horse_id}`;
            return {
                horseName: horse?.custom_name || "Unknown",
                moldName: horse?.catalog_items?.title || "",
                className: e.class_id ? classMap.get(e.class_id) || "General" : "General",
                entryNumber: i + 1,
                ownerAlias: userInfo?.alias_name || "Anonymous",
                breed: horse?.assigned_breed || "",
                gender: horse?.assigned_gender || "",
                finishType: horse?.finish_type || "",
                horseNumber: horseNumberFor(userInfo?.exhibitor_number, horse?.regional_id, i + 1),
                passportUrl,
                qrMatrix: await qrMatrix(passportUrl),
            };
        }),
    );

    const buffer = await renderToBuffer(
        ShowTags({ showName: ev.name, showDate: fmtDate(ev.starts_at), entries: tagEntries }),
    );
    return pdfResponse(buffer, showId);
}
