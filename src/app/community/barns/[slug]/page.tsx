import { redirect } from "next/navigation";

/** /community/barns/[slug] → /community/groups/[slug] */
export default async function BarnAlias({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    redirect(`/community/groups/${encodeURIComponent(slug)}`);
}
