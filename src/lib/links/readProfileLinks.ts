/**
 * Read a member's outbound links (users.links, migration 229),
 * tolerant of a database that has not had 229 pasted yet: a missing
 * column reads as "no links", never as an error on the profile page.
 */

import { normalizeMemberLinks, PROFILE_LINK_KEYS, type MemberLinks } from "./memberLinks";

interface LinksReader {
    from: (table: string) => {
        select: (cols: string) => {
            eq: (
                col: string,
                val: string,
            ) => {
                maybeSingle: () => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
            };
        };
    };
}

export async function readProfileLinks(client: LinksReader, userId: string): Promise<MemberLinks> {
    const { data, error } = await client.from("users").select("links").eq("id", userId).maybeSingle();
    if (error || !data) return {};
    return normalizeMemberLinks((data as { links?: unknown }).links, PROFILE_LINK_KEYS);
}
