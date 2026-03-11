import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-static"; // Cache this aggressively
export const revalidate = 86400; // Revalidate once per day

export async function GET() {
    const supabase = await createClient();

    // Fetch all catalog items — paginated to bypass PostgREST 1000-row limit
    const PAGE_SIZE = 1000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allItems: any[] = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase
            .from("catalog_items")
            .select("id, item_type, parent_id, title, maker, scale, attributes")
            .order("title")
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error || !data || data.length === 0) break;
        allItems.push(...data);
        if (data.length < PAGE_SIZE) break;
        page++;
    }

    // Compress: short keys to reduce payload size
    // Split into releases and resins for backward compat with CsvImport matching
    const releases = allItems.filter(r => r.item_type === "plastic_release");
    const resins = allItems.filter(r => r.item_type === "artist_resin");

    // Find parent mold names for releases
    const moldMap = new Map<string, { title: string; maker: string }>();
    allItems
        .filter(r => r.item_type === "plastic_mold")
        .forEach(m => moldMap.set(m.id, { title: m.title, maker: m.maker }));

    const dictionary = {
        releases: releases.map((r: Record<string, unknown>) => {
            const attrs = (r.attributes || {}) as Record<string, unknown>;
            const parent = r.parent_id ? moldMap.get(r.parent_id as string) : null;
            return {
                i: r.id,
                n: r.title,
                m: attrs.model_number || null,
                c: attrs.color_description || null,
                mn: parent?.title || null,
                mf: parent?.maker || r.maker || null,
            };
        }),
        resins: resins.map((r: Record<string, unknown>) => ({
            i: r.id,
            n: r.title,
            s: r.maker,
        })),
    };

    return NextResponse.json(dictionary, {
        headers: {
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
    });
}
