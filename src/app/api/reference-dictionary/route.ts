import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-static"; // Cache this aggressively
export const revalidate = 86400; // Revalidate once per day

export async function GET() {
    const supabase = await createClient();

    // Fetch releases with mold info (compact format)
    const { data: releases } = await supabase
        .from("reference_releases")
        .select(`
            id,
            release_name,
            model_number,
            color_description,
            reference_molds(mold_name, manufacturer, scale)
        `)
        .order("release_name");

    // Fetch resins (compact format)
    const { data: resins } = await supabase
        .from("artist_resins")
        .select("id, resin_name, sculptor_alias, scale")
        .order("resin_name");

    // Compress: short keys to reduce payload size
    const dictionary = {
        releases: (releases || []).map((r: Record<string, unknown>) => ({
            i: r.id,
            n: r.release_name,
            m: r.model_number,
            c: r.color_description,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mn: (r.reference_molds as any)?.mold_name || null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mf: (r.reference_molds as any)?.manufacturer || null,
        })),
        resins: (resins || []).map((r: Record<string, unknown>) => ({
            i: r.id,
            n: r.resin_name,
            s: r.sculptor_alias,
        })),
    };

    return NextResponse.json(dictionary, {
        headers: {
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
    });
}
