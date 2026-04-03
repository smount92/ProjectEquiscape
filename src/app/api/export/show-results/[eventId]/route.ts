import { getAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function escapeCSV(value: string | null | undefined): string {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ eventId: string }> }
) {
    const { eventId } = await params;
    const admin = getAdminClient();

    // Fetch event
    const { data: eventData } = await admin
        .from("events")
        .select("id, name, show_status, starts_at, sanctioning_body")
        .eq("id", eventId)
        .single();

    if (!eventData) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const ev = eventData as {
        id: string; name: string; show_status: string;
        starts_at: string; sanctioning_body: string | null;
    };

    if (ev.show_status !== "closed") {
        return NextResponse.json({ error: "Results not available — show is not closed" }, { status: 403 });
    }

    const showDate = ev.starts_at ? new Date(ev.starts_at).toLocaleDateString("en-US") : "";

    // Fetch all placed entries with class + division info
    const { data: entries } = await admin
        .from("event_entries")
        .select("id, horse_id, user_id, placing, class_id, users!user_id(alias_name)")
        .eq("event_id", eventId)
        .eq("entry_type", "entered")
        .not("placing", "is", null);

    if (!entries || entries.length === 0) {
        // Return empty CSV with headers
        const bom = "\uFEFF";
        const csv = bom + "Event,Date,Sanctioning Body,Division,Class #,Class,Placement,Horse,Exhibitor\n";
        return new NextResponse(csv, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${ev.name.replace(/[^a-zA-Z0-9 ]/g, "")}_results.csv"`,
                "Cache-Control": "no-cache, no-store",
            },
        });
    }

    // Batch-fetch horse names
    const horseIds = [...new Set((entries as { horse_id: string }[]).map(e => e.horse_id))];
    const { data: horses } = await admin
        .from("user_horses")
        .select("id, custom_name")
        .in("id", horseIds);
    const horseNameMap = new Map<string, string>();
    (horses ?? []).forEach((h: { id: string; custom_name: string }) => horseNameMap.set(h.id, h.custom_name));

    // Batch-fetch class + division names
    const classIds = [...new Set((entries as { class_id: string | null }[]).filter(e => e.class_id).map(e => e.class_id!))];
    const classMap = new Map<string, { className: string; classNumber: string | null; divisionName: string }>();
    if (classIds.length > 0) {
        const { data: classRows } = await admin
            .from("event_classes")
            .select("id, name, class_number, event_divisions!division_id(name)")
            .in("id", classIds);
        (classRows ?? []).forEach((cr: { id: string; name: string; class_number: string | null; event_divisions: { name: string } | { name: string }[] | null }) => {
            const divObj = Array.isArray(cr.event_divisions) ? cr.event_divisions[0] : cr.event_divisions;
            classMap.set(cr.id, { className: cr.name, classNumber: cr.class_number, divisionName: divObj?.name || "General" });
        });
    }

    // Build CSV
    const headers = ["Event", "Date", "Sanctioning Body", "Division", "Class #", "Class", "Placement", "Horse", "Exhibitor"];

    const PLACE_ORDER: Record<string, number> = {
        "Grand Champion": 0, "Reserve Grand Champion": 1,
        Champion: 2, "Reserve Champion": 3,
        "1st": 4, "2nd": 5, "3rd": 6,
        "4th": 7, "5th": 8, "6th": 9, HM: 10,
    };

    const rows = (entries as { horse_id: string; class_id: string | null; placing: string; users: { alias_name: string } | { alias_name: string }[] | null }[])
        .sort((a, b) => {
            const classA = a.class_id ? classMap.get(a.class_id) : null;
            const classB = b.class_id ? classMap.get(b.class_id) : null;
            const divComp = (classA?.divisionName || "").localeCompare(classB?.divisionName || "");
            if (divComp !== 0) return divComp;
            const clsComp = (classA?.className || "").localeCompare(classB?.className || "");
            if (clsComp !== 0) return clsComp;
            return (PLACE_ORDER[a.placing] ?? 99) - (PLACE_ORDER[b.placing] ?? 99);
        })
        .map(e => {
            const classInfo = e.class_id ? classMap.get(e.class_id) : null;
            const alias = Array.isArray(e.users) ? (e.users[0]?.alias_name || "") : (e.users?.alias_name || "");
            return [
                escapeCSV(ev.name),
                escapeCSV(showDate),
                escapeCSV(ev.sanctioning_body || ""),
                escapeCSV(classInfo?.divisionName || ""),
                escapeCSV(classInfo?.classNumber || ""),
                escapeCSV(classInfo?.className || ""),
                escapeCSV(e.placing),
                escapeCSV(horseNameMap.get(e.horse_id) || "Unknown"),
                escapeCSV(alias),
            ].join(",");
        });

    const bom = "\uFEFF";
    const csv = bom + headers.join(",") + "\n" + rows.join("\n");

    const safeFilename = ev.name.replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_");

    return new NextResponse(csv, {
        status: 200,
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${safeFilename}_results.csv"`,
            "Cache-Control": "no-cache, no-store",
        },
    });
}
