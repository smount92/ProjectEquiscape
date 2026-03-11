import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface ExportHorse {
    id: string;
    custom_name: string;
    finish_type: string;
    condition_grade: string;
    sculptor: string | null;
    trade_status: string | null;
    listing_price: number | null;
    created_at: string;
    catalog_items: { title: string; maker: string; item_type: string; attributes: Record<string, unknown> } | null;
    user_collections: { name: string } | null;
    financial_vault: {
        purchase_price: number | null;
        estimated_current_value: number | null;
        insurance_notes: string | null;
    }[];
}

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
      id, custom_name, finish_type, condition_grade, sculptor, trade_status, listing_price, created_at,
      catalog_items:catalog_id(title, maker, item_type, attributes),
      user_collections(name),
      financial_vault(purchase_price, estimated_current_value, insurance_notes)
    `
        )
        .eq("owner_id", user.id)
        .order("custom_name");

    if (error) {
        return NextResponse.json(
            { error: "Failed to fetch data" },
            { status: 500 }
        );
    }

    const horses = (rawHorses as unknown as ExportHorse[]) ?? [];

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
    ];

    // Build CSV rows
    const rows = horses.map((horse) => {
        const vault = horse.financial_vault?.[0];

        return [
            escapeCSV(horse.custom_name),
            escapeCSV(horse.catalog_items?.title),
            escapeCSV(horse.catalog_items?.maker),
            escapeCSV(horse.catalog_items?.item_type === "plastic_release" ? horse.catalog_items.title : ""),
            escapeCSV(horse.catalog_items?.attributes?.model_number as string | null | undefined),
            escapeCSV(horse.catalog_items?.attributes?.color_description as string | null | undefined),
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
        ].join(",");
    });

    // Combine with BOM for Excel compatibility
    const bom = "\uFEFF";
    const csv = bom + headers.join(",") + "\n" + rows.join("\n");

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
