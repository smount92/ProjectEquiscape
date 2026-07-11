import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * `/reference/[maker]` isn't its own index — resolve the maker slug back to the
 * maker name and send the visitor to the catalog filtered by that maker.
 */
export default async function ReferenceMakerIndex({
    params,
}: {
    params: Promise<{ maker: string }>;
}) {
    const { maker } = await params;
    const supabase = await createClient();
    const { data } = await supabase
        .from("catalog_items")
        .select("maker")
        .eq("maker_slug", maker)
        .limit(1)
        .maybeSingle();

    const makerName = (data as { maker: string } | null)?.maker;
    redirect(makerName ? `/catalog?maker=${encodeURIComponent(makerName)}` : "/catalog");
}
