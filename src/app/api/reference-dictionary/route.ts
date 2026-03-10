import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-static"; // Cache this aggressively
export const revalidate = 86400; // Revalidate once per day

export async function GET() {
    const supabase = await createClient();

    // Fetch releases with mold info — paginated to bypass PostgREST 1000-row limit
    const PAGE_SIZE = 1000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allReleases: any[] = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase
            .from("reference_releases")
            .select("id, release_name, model_number, color_description, reference_molds(mold_name, manufacturer, scale)")
            .order("release_name")
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error || !data || data.length === 0) break;
        allReleases.push(...data);
        if (data.length < PAGE_SIZE) break;
        page++;
    }
    const releases = allReleases;

    // Fetch resins — paginated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allResins: any[] = [];
    let resinPage = 0;
    while (true) {
        const { data, error } = await supabase
            .from("artist_resins")
            .select("id, resin_name, sculptor_alias, scale")
            .order("resin_name")
            .range(resinPage * PAGE_SIZE, (resinPage + 1) * PAGE_SIZE - 1);
        if (error || !data || data.length === 0) break;
        allResins.push(...data);
        if (data.length < PAGE_SIZE) break;
        resinPage++;
    }
    const resins = allResins;

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
