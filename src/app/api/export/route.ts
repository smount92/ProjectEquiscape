import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function escapeCSV(value: string | null | undefined): string {
    if (value === null || value === undefined) return "";
    const str = String(value);
    // Wrap in quotes if it contains comma, quote, or newline
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export async function GET() {
    const supabase = await createClient();

    // Strictly protected — auth check
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all horses with joined reference data, collection, and financial vault
    const { data: rawHorses, error } = await supabase
        .from("user_horses")
        .select(
            `
      id, custom_name, finish_type, condition_grade, sculptor, trade_status, listing_price, created_at, asset_category,
      catalog_items:catalog_id(title, maker, item_type, attributes),
      user_collections(name),
      financial_vault(purchase_price, estimated_current_value, insurance_notes)
    `
        )
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .order("custom_name");

    if (error) {
        return NextResponse.json(
            { error: "Failed to fetch data" },
            { status: 500 }
        );
    }

    const horses = rawHorses ?? [];
    const horseIds = horses.map((h) => h.id as string);
    const horseNameById = new Map(
        horses.map((h) => [h.id as string, h.custom_name as string])
    );

    // Fetch Hoofprint timeline for all of the user's horses (view already
    // UNIONs creation/transfer/condition/show/customization/note events —
    // one query covers every "Hoofprint record" the About page promises).
    let rawTimeline: Record<string, unknown>[] = [];
    if (horseIds.length > 0) {
        const { data } = await supabase
            .from("v_horse_hoofprint")
            .select(
                "source_id, horse_id, event_type, title, description, event_date, metadata, created_at, source_table"
            )
            .in("horse_id", horseIds)
            .order("horse_id", { ascending: true })
            .order("event_date", { ascending: false, nullsFirst: false });
        rawTimeline = (data ?? []) as unknown as Record<string, unknown>[];
    }

    // Fetch qualification cards the user currently owns or originally
    // earned (RLS already scopes this; the OR mirrors "Card people read
    // their cards" so transferred-away cards the user earned still show).
    const { data: rawCards } = await supabase
        .from("qualification_cards")
        .select(
            `
      id, earned_place, status, show_year, issued_at,
      shows:show_id(title),
      show_classes:class_id(name),
      user_horses:horse_id(custom_name)
    `
        )
        .or(`current_owner_id.eq.${user.id},earned_by_owner_id.eq.${user.id}`)
        .order("issued_at", { ascending: false });

    const cards = rawCards ?? [];

    // CSV Header
    const headers = [
        "Custom Name",
        "Mold",
        "Manufacturer",
        "Release",
        "Model Number",
        "Color Description",
        "Condition",
        "Finish",
        "Sculptor",
        "Collection",
        "Marketplace Status",
        "Listing Price",
        "Purchase Price",
        "Estimated Value",
        "Insurance Notes",
        "Date Added",
        "Category",
    ];

    // Build CSV rows
    const rows = horses.map((horse) => {
        const vault = horse.financial_vault;

        return [
            escapeCSV(horse.custom_name),
            escapeCSV(horse.catalog_items?.title),
            escapeCSV(horse.catalog_items?.maker),
            escapeCSV(horse.catalog_items?.item_type === "plastic_release" ? horse.catalog_items.title : ""),
            escapeCSV((horse.catalog_items?.attributes as Record<string, unknown> | null)?.model_number as string | null | undefined),
            escapeCSV((horse.catalog_items?.attributes as Record<string, unknown> | null)?.color_description as string | null | undefined),
            escapeCSV(horse.condition_grade),
            escapeCSV(horse.finish_type),
            escapeCSV(horse.sculptor),
            escapeCSV(horse.user_collections?.name),
            escapeCSV(horse.trade_status || "Not for Sale"),
            horse.listing_price ? `$${horse.listing_price}` : "",
            vault?.purchase_price ? `$${vault.purchase_price}` : "",
            vault?.estimated_current_value
                ? `$${vault.estimated_current_value}`
                : "",
            escapeCSV(vault?.insurance_notes),
            new Date(horse.created_at).toLocaleDateString("en-US"),
            escapeCSV((horse as Record<string, unknown>).asset_category as string || "model"),
        ].join(",");
    });

    // -- Hoofprint Timeline section --
    const timelineHeaders = [
        "Horse",
        "Event Type",
        "Title",
        "Description",
        "Event Date",
        "Metadata",
        "Source",
        "Recorded At",
    ];
    const timelineRows = (rawTimeline as {
        horse_id: string | null;
        event_type: string | null;
        title: string | null;
        description: string | null;
        event_date: string | null;
        metadata: unknown;
        created_at: string | null;
        source_table: string | null;
    }[]).map((e) => [
        escapeCSV(horseNameById.get(e.horse_id || "")),
        escapeCSV(e.event_type),
        escapeCSV(e.title),
        escapeCSV(e.description),
        escapeCSV(e.event_date),
        escapeCSV(e.metadata ? JSON.stringify(e.metadata) : ""),
        escapeCSV(e.source_table),
        e.created_at ? new Date(e.created_at).toLocaleDateString("en-US") : "",
    ].join(","));

    // -- Qualification Cards section --
    const cardHeaders = [
        "Card Code",
        "Horse",
        "Show",
        "Class",
        "Placing",
        "Show Year",
        "Status",
        "Issued Date",
    ];
    const cardRows = cards.map((c) => {
        const placing = c.earned_place === 1 ? "1st" : c.earned_place === 2 ? "2nd" : "";
        return [
            escapeCSV(c.id),
            escapeCSV(c.user_horses?.custom_name),
            escapeCSV(c.shows?.title),
            escapeCSV(c.show_classes?.name),
            placing,
            c.show_year ?? "",
            escapeCSV(c.status),
            c.issued_at ? new Date(c.issued_at).toLocaleDateString("en-US") : "",
        ].join(",");
    });

    // Combine with BOM for Excel compatibility. One section per entity
    // (Horses / Hoofprint Timeline / Qualification Cards) in a single
    // CSV file - show_records are folded into the Hoofprint Timeline
    // section (source = show_records), matching the About page promise
    // of "every horse, every Hoofprint record, every qualification card."
    const bom = "\uFEFF";
    const csv =
        bom +
        "# Horses\n" +
        headers.join(",") + "\n" + rows.join("\n") +
        "\n\n# Hoofprint Timeline\n" +
        timelineHeaders.join(",") + "\n" + timelineRows.join("\n") +
        "\n\n# Qualification Cards\n" +
        cardHeaders.join(",") + "\n" + cardRows.join("\n");

    // Return as downloadable CSV
    return new NextResponse(csv, {
        status: 200,
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="my_digital_stable.csv"',
            "Cache-Control": "no-cache, no-store",
        },
    });
}
