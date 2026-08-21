import { redirect } from "next/navigation";

/** /community/barns/[slug]/thread/[postId] → the groups route */
export default async function BarnThreadAlias({
    params,
}: {
    params: Promise<{ slug: string; postId: string }>;
}) {
    const { slug, postId } = await params;
    redirect(`/community/groups/${encodeURIComponent(slug)}/thread/${encodeURIComponent(postId)}`);
}
