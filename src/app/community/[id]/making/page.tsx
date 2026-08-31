import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { getPublicImageUrl } from "@/lib/utils/storage";
import MakingReel from "@/components/making/MakingReel";
import { getMakingForHorse, getPublicMaking, type WorkRecordView } from "@/app/actions/work-records";

/**
 * The standalone Making page — the shareable, full-width version of
 * the passport's chapter. This URL is the single most shareable
 * object the studio system produces (a horse's biography), so it gets
 * its own address; the passport chapter links here, the studio's
 * works wall links here, social shares land here.
 *
 * Members read under their own RLS (parties see pending records);
 * logged-out visitors get the owner-consented public subset via the
 * get_public_making DEFINER RPC (202).
 */

export const dynamic = "force-dynamic";

async function loadHorseHeader(horseId: string, isMember: boolean): Promise<{
    name: string;
    ownerId: string | null;
    ownerAlias: string | null;
    primaryImageUrl: string | null;
} | null> {
    if (isMember) {
        const supabase = await createClient();
        const { data } = await supabase
            .from("user_horses")
            .select("custom_name, owner_id, owner:users!owner_id(alias_name)")
            .eq("id", horseId)
            .is("deleted_at", null)
            .single();
        if (!data) return null;
        const owner = data.owner as unknown as { alias_name: string | null } | null;
        return {
            name: data.custom_name,
            ownerId: data.owner_id,
            ownerAlias: owner?.alias_name ?? null,
            primaryImageUrl: null,
        };
    }
    const anon = createAnonClient();
    const rpc = anon.rpc.bind(anon) as unknown as (
        fn: string,
        args: { p_horse_id: string },
    ) => Promise<{
        data: Array<{
            horse: { custom_name: string } | null;
            owner_alias: string | null;
            images: Array<{ image_url: string; angle_profile: string }> | null;
        }> | null;
    }>;
    const { data } = await rpc("get_public_passport", { p_horse_id: horseId });
    const row = data?.[0];
    if (!row?.horse) return null;
    const imgs = row.images ?? [];
    const primary =
        imgs.find((i) => i.angle_profile === "Primary_Thumbnail")?.image_url ??
        imgs[0]?.image_url ??
        null;
    return {
        name: row.horse.custom_name,
        ownerId: null,
        ownerAlias: row.owner_alias,
        primaryImageUrl: primary ? (primary.startsWith("http") ? primary : getPublicImageUrl(primary)) : null,
    };
}

/**
 * The share card. This URL is the reel's whole job — it lives or dies
 * in a Facebook unfurl, so the og:image is the FINISHED shot (the
 * newest record's last published moment), falling back to the horse's
 * primary photo. Title and description carry the artist and the arc.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const [header, records] = await Promise.all([loadHorseHeader(id, false), getPublicMaking(id)]);
    if (!header) return { title: "The Making — Model Horse Hub" };

    const title = `The Making of ${header.name}`;
    const momentCount = records.reduce(
        (n, r) => n + r.moments.reduce((k, m) => k + m.imageUrls.length, 0),
        0,
    );
    const artists = [...new Set(records.map((r) => r.artistAlias).filter(Boolean))] as string[];
    const description =
        records.length > 0
            ? [
                  records[0].workType,
                  artists.length ? `by ${artists.join(", ")}` : null,
                  momentCount ? `${momentCount} moments, start to finished` : null,
              ]
                  .filter(Boolean)
                  .join(" · ")
            : `How ${header.name} came to be — the artist's making-of reel.`;

    // Newest record, last published moment = the finished shot.
    const lastMoment = records[0]?.moments.at(-1);
    const heroImage = lastMoment?.imageUrls.at(-1) ?? header.primaryImageUrl;

    return {
        title: `${title} — Model Horse Hub`,
        description,
        openGraph: {
            title,
            description,
            images: heroImage ? [{ url: heroImage, width: 800, height: 600, alt: header.name }] : [],
            type: "article" as const,
            siteName: "Model Horse Hub",
        },
        twitter: {
            card: (heroImage ? "summary_large_image" : "summary") as "summary_large_image" | "summary",
            title,
            description,
            images: heroImage ? [heroImage] : [],
        },
    };
}

export default async function MakingPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: horseId } = await params;

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const isMember = !!auth?.user;

    const header = await loadHorseHeader(horseId, isMember);
    if (!header) notFound();

    let records: WorkRecordView[] = [];
    if (isMember) {
        records = await getMakingForHorse(horseId);
    } else {
        records = await getPublicMaking(horseId);
    }

    return (
        <main className="mx-auto max-w-3xl px-4 py-8">
            <nav className="text-muted-foreground mb-4 text-sm">
                <Link href={`/community/${horseId}`} className="text-forest hover:underline">
                    ← {header.name}&rsquo;s passport
                </Link>
            </nav>
            <h1 className="text-foreground mb-1 font-serif text-3xl font-bold">
                The Making of {header.name}
            </h1>
            {header.ownerAlias && (
                <p className="text-muted-foreground mt-0 mb-6 text-sm">
                    In the stable of @{header.ownerAlias}
                </p>
            )}
            {records.length > 0 ? (
                <MakingReel records={records} ownerId={header.ownerId} showControls={isMember} />
            ) : (
                <div className="border-input bg-card text-muted-foreground rounded-xl border border-dashed px-5 py-8 text-center text-sm">
                    No making-of story here yet. If you finished this horse, log the work
                    from your <Link href="/studio/dashboard" className="text-forest hover:underline">studio</Link>.
                </div>
            )}
        </main>
    );
}
