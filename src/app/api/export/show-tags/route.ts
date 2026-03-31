import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/auth";
import { renderToBuffer } from "@react-pdf/renderer";
import ShowTags from "@/components/pdf/ShowTags";
import QRCode from "qrcode";

// GET /api/export/show-tags?showId=X — Generate printable show tags PDF
// Any authenticated user with entries can print THEIR OWN tags.
// Show hosts can print ALL tags by adding &all=true.
// Pro-gated.
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

    const printAll = searchParams.get("all") === "true";

    // Fetch event
    const { data: event } = await supabase
        .from("events")
        .select("name, starts_at, created_by")
        .eq("id", showId)
        .single();

    if (!event) {
        return NextResponse.json({ error: "Show not found" }, { status: 404 });
    }

    const ev = event as { name: string; starts_at: string; created_by: string };
    const isHost = ev.created_by === user.id;

    // Build entry query — user sees their own, host can see all
    let entryQuery = supabase
        .from("event_entries")
        .select("id, horse_id, user_id, class_id, users!user_id(alias_name, exhibitor_number)")
        .eq("event_id", showId)
        .eq("entry_type", "entered");

    if (!printAll || !isHost) {
        entryQuery = entryQuery.eq("user_id", user.id);
    }

    const { data: rawEntries } = await entryQuery;

    if (!rawEntries || rawEntries.length === 0) {
        return NextResponse.json({ error: "No entries found" }, { status: 404 });
    }

    // Batch-fetch horse details (name, breed, gender, finish_type, regional_id)
    const horseIds = [...new Set(rawEntries.map(e => e.horse_id))];
    const { data: horses } = await supabase
        .from("user_horses")
        .select("id, custom_name, catalog_id, finish_type, assigned_breed, assigned_gender, regional_id, catalog_items:catalog_id(title)")
        .in("id", horseIds);

    type HorseRow = {
        id: string;
        custom_name: string;
        finish_type: string | null;
        assigned_breed: string | null;
        assigned_gender: string | null;
        regional_id: string | null;
        catalog_items: { title: string } | null;
    };

    const horseMap = new Map<string, HorseRow>();
    (horses ?? []).forEach((h: HorseRow) => {
        horseMap.set(h.id, h);
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

    // Generate QR matrices for each entry
    const tagEntries = await Promise.all(rawEntries.map(async (e, i) => {
        const horse = horseMap.get(e.horse_id);
        const userInfo = e.users as { alias_name: string; exhibitor_number?: string | null } | null;
        const exhibitorNum = userInfo?.exhibitor_number || "000";
        const horseSeq = horse?.regional_id || String(i + 1).padStart(3, "0");
        const horseNumber = `${exhibitorNum}-${horseSeq}`;
        const passportUrl = `${appUrl}/stable/${e.horse_id}`;

        // Generate real QR code matrix
        let qrMatrix: boolean[][] = [];
        try {
            const qr = QRCode.create(passportUrl, { errorCorrectionLevel: "L" });
            const size = qr.modules.size;
            qrMatrix = Array.from({ length: size }, (_, row) =>
                Array.from({ length: size }, (_, col) => qr.modules.get(row, col) === 1)
            );
        } catch {
            // fallback: no QR
        }

        return {
            horseName: horse?.custom_name || "Unknown",
            moldName: horse?.catalog_items?.title || "",
            className: e.class_id ? (classMap.get(e.class_id) || "General") : "General",
            entryNumber: i + 1,
            ownerAlias: userInfo?.alias_name || "Anonymous",
            breed: horse?.assigned_breed || "",
            gender: horse?.assigned_gender || "",
            finishType: horse?.finish_type || "",
            horseNumber,
            passportUrl,
            qrMatrix,
        };
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
