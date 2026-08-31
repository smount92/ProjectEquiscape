import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
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
        return { name: data.custom_name, ownerId: data.owner_id, ownerAlias: owner?.alias_name ?? null };
    }
    const anon = createAnonClient();
    const rpc = anon.rpc.bind(anon) as unknown as (
        fn: string,
        args: { p_horse_id: string },
    ) => Promise<{ data: Array<{ horse: { custom_name: string } | null; owner_alias: string | null }> | null }>;
    const { data } = await rpc("get_public_passport", { p_horse_id: horseId });
    const row = data?.[0];
    if (!row?.horse) return null;
    return { name: row.horse.custom_name, ownerId: null, ownerAlias: row.owner_alias };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const header = await loadHorseHeader(id, false);
    if (!header) return { title: "The Making — Model Horse Hub" };
    return {
        title: `The Making of ${header.name} — Model Horse Hub`,
        description: `How ${header.name} came to be — the artist's making-of reel, from blank to finished.`,
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
