import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPublicImageUrls } from "@/lib/utils/storage";
import { getMyTier } from "@/app/actions/horse";
import type { UserTier } from "@/lib/utils/imageCompression";
import LogWorkForm, { type LogWorkHorse } from "@/components/studio/LogWorkForm";

/**
 * Log past work — the back-fill door. An artist picks a horse (their
 * own stable first; a client's horse by search later), states the
 * work, drops photos into stages. Three minutes, one wall entry.
 */
export const dynamic = "force-dynamic";

export default async function LogWorkPage() {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) redirect("/login?redirectTo=%2Fstudio%2Flog-work");

    const { data: profile } = await supabase
        .from("artist_profiles")
        .select("studio_name")
        .eq("user_id", auth.user.id)
        .single();
    if (!profile) redirect("/studio/setup");

    // The artist's own stable, thumbnails included — the common case
    // (log, then park for the client). Paginated read: PostgREST caps
    // at 1,000 and a big stable is exactly who uses this page.
    const horses: { id: string; custom_name: string }[] = [];
    for (let from = 0; ; from += 1000) {
        const { data } = await supabase
            .from("user_horses")
            .select("id, custom_name")
            .eq("owner_id", auth.user.id)
            .is("deleted_at", null)
            .order("custom_name")
            .range(from, from + 999);
        horses.push(...(data ?? []));
        if (!data || data.length < 1000) break;
    }

    const ids = horses.map((h) => h.id);
    const thumbByHorse = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data: imgs } = await supabase
            .from("horse_images")
            .select("horse_id, image_url, angle_profile")
            .in("horse_id", chunk)
            .eq("angle_profile", "Primary_Thumbnail");
        for (const img of imgs ?? []) {
            if (!thumbByHorse.has(img.horse_id)) thumbByHorse.set(img.horse_id, img.image_url);
        }
    }
    const urlMap = getPublicImageUrls([...thumbByHorse.values()]);

    const list: LogWorkHorse[] = horses.map((h) => {
        const raw = thumbByHorse.get(h.id) ?? null;
        return {
            id: h.id,
            name: h.custom_name,
            thumbUrl: raw ? (urlMap.get(raw) ?? raw) : null,
            ownedByMe: true,
        };
    });

    const tier = (await getMyTier()) as UserTier;

    return (
        <main className="mx-auto max-w-3xl px-4 py-8">
            <nav className="text-muted-foreground mb-4 text-sm">
                <Link href="/studio/dashboard" className="text-forest hover:underline">← Studio dashboard</Link>
            </nav>
            <h1 className="text-foreground mb-1 font-serif text-3xl font-bold">Log past work</h1>
            <p className="text-secondary-foreground mt-0 mb-6 max-w-[60ch] text-sm">
                Every piece you&rsquo;ve finished belongs on your wall — with its making-of story if
                you kept the photos. Records on your own horses verify when their new owner claims
                them; records on a client&rsquo;s horse ask that owner to confirm.
            </p>
            <LogWorkForm horses={list} tier={tier} studioName={profile.studio_name} />
        </main>
    );
}
