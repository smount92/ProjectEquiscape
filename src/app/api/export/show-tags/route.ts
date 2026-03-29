import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/auth";
import { renderToBuffer } from "@react-pdf/renderer";
import ShowTags from "@/components/pdf/ShowTags";

// GET /api/export/show-tags?showId=X — Generate printable show tags PDF (Pro-gated)
export async function GET(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pro-gate
    const tier = await getUserTier();
    if (tier === "free") {
        return NextResponse.json(
            { error: "Show Tags are a Pro feature. Upgrade to MHH Pro to print show tags." },
            { status: 403 }
        );
    }

    const { searchParams } = new URL(request.url);
    const showId = searchParams.get("showId");
    if (!showId) {
        return NextResponse.json({ error: "Missing showId" }, { status: 400 });
    }

    // Fetch event
    const { data: event } = await supabase
        .from("events")
        .select("name, starts_at")
        .eq("id", showId)
        .single();

    if (!event) {
        return NextResponse.json({ error: "Show not found" }, { status: 404 });
    }

    const ev = event as { name: string; starts_at: string };

    // Fetch entries with horses + classes + users
    const { data: rawEntries } = await supabase
        .from("event_entries")
        .select("id, horse_id, user_id, class_id, users!user_id(alias_name)")
        .eq("event_id", showId)
        .eq("entry_type", "entered");

    if (!rawEntries || rawEntries.length === 0) {
        return NextResponse.json({ error: "No entries found for this show" }, { status: 404 });
    }

    // Batch-fetch horse names
    const horseIds = [...new Set(rawEntries.map(e => e.horse_id))];
    const { data: horses } = await supabase
        .from("user_horses")
        .select("id, custom_name, catalog_id, catalog_items:catalog_id(title)")
        .in("id", horseIds);

    type HorseRow = { id: string; custom_name: string; catalog_items: { title: string } | null };
    const horseMap = new Map<string, { name: string; moldName: string }>();
    (horses ?? []).forEach((h: HorseRow) => {
        horseMap.set(h.id, {
            name: h.custom_name,
            moldName: h.catalog_items?.title || "",
        });
    });

    // Batch-fetch class names
    const classIds = [...new Set(rawEntries.filter(e => e.class_id).map(e => e.class_id!))];
    const classMap = new Map<string, string>();
    if (classIds.length > 0) {
        const { data: classRows } = await supabase
            .from("event_classes")
            .select("id, name")
            .in("id", classIds);
        (classRows ?? []).forEach((c: { id: string; name: string }) => {
            classMap.set(c.id, c.name);
        });
    }

    // Transform to PDF props
    const tagEntries = rawEntries.map((e, i) => ({
        horseName: horseMap.get(e.horse_id)?.name || "Unknown",
        moldName: horseMap.get(e.horse_id)?.moldName || "",
        className: e.class_id ? (classMap.get(e.class_id) || "General") : "General",
        entryNumber: i + 1,
        ownerAlias: (e.users as { alias_name: string } | null)?.alias_name || "Anonymous",
    }));

    const buffer = await renderToBuffer(
        ShowTags({
            showName: ev.name,
            showDate: new Date(ev.starts_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            }),
            entries: tagEntries,
        })
    );

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="show-tags-${showId}.pdf"`,
        },
    });
}
