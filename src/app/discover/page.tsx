/**
 * The Members room — the directory where collectors find each other.
 *
 * The URL stays /discover (nav ids, robots rules and old links all point
 * there); everything a human reads says "Members", which is what the
 * Paddock rail has called this door for a while.
 *
 * What changed from the old Discover page: the roster is searched and
 * ordered on the SERVER (it used to fetch a page and filter it in the
 * browser), the default order is "recently active" rather than "whoever
 * signed up last", and a card now says who somebody IS — badges, studio,
 * rating, public shelf size, last seen — instead of just their name.
 *
 * Safety and prefs honoured here:
 *   • deleted / tombstoned and test accounts — excluded by
 *     discover_users_view (`account_status = 'active'`, `is_test_account`).
 *   • people this viewer has blocked — excluded (user_blocks RLS only
 *     exposes your own outgoing blocks, which is exactly this case).
 *   • `users.show_badges` — a member who hid their badges shows none.
 *   • NOT honoured, and it cannot be from a client key: `is_suspended`.
 *     Migration 148 added the column but 133/142's column-level GRANT
 *     list was never extended, so it is neither selectable nor
 *     filterable here. Excluding suspended members needs
 *     discover_users_view to add the predicate.
 *
 * There is no `is_discoverable` / profile-visibility preference in the
 * schema — being an active, non-test account is what makes you listed.
 */

import { redirect } from "next/navigation";
import Link from "next/link";

import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import CollectorCard from "@/components/members/CollectorCard";
import MembersFilterBar from "@/components/members/MembersFilterBar";
import { createClient } from "@/lib/supabase/server";
import { membersHref, parseMemberSearchParams } from "@/lib/members/directory";

import { getMembersDirectoryPage } from "./queries";

export const metadata = {
    title: "Members",
    description:
        "Find collectors in the Model Horse Hub community — search the roster, see who's been around lately, and follow the stables you like.",
};

export default async function MembersPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login?redirectTo=" + encodeURIComponent("/discover"));

    const filters = parseMemberSearchParams(await searchParams);
    const { members, total, page, totalPages, rosterTruncated } = await getMembersDirectoryPage(
        filters,
        user.id,
    );

    const countLabel = filters.q
        ? `${total.toLocaleString()} ${total === 1 ? "match" : "matches"} for “${filters.q}”`
        : `${total.toLocaleString()} ${total === 1 ? "member" : "members"}`;

    return (
        <ExplorerLayout noHeader>
            <PageMasthead
                icon="👥"
                title="Members"
                subtitle="Find collectors — who's here, what they keep, and who's been around lately"
            />

            <div className="mb-4">
                <MembersFilterBar q={filters.q ?? ""} sort={filters.sort} />
            </div>

            <div className="mb-4 flex flex-wrap items-baseline gap-2">
                <span className="text-forest font-serif text-2xl font-bold tabular-nums">
                    {countLabel}
                </span>
                {page > 1 && (
                    <span className="text-muted-foreground text-sm">
                        · page {page} of {totalPages.toLocaleString()}
                    </span>
                )}
            </div>

            {members.length === 0 ? (
                <div className="ledger-card py-12 text-center">
                    <div className="mb-3 text-4xl" aria-hidden="true">
                        👥
                    </div>
                    <h2 className="mb-2 font-serif text-lg font-bold">
                        {filters.q ? "Nobody by that name" : "Nobody here yet"}
                    </h2>
                    <p className="text-muted-foreground m-0 text-sm">
                        {filters.q ? (
                            <>
                                No collector&rsquo;s name matches &ldquo;{filters.q}&rdquo;.{" "}
                                <Link
                                    href={membersHref({ sort: filters.sort })}
                                    className="text-forest font-semibold"
                                >
                                    Clear the search
                                </Link>{" "}
                                to see the whole roster.
                            </>
                        ) : (
                            "The directory is empty — that shouldn't happen. Try again in a moment."
                        )}
                    </p>
                </div>
            ) : (
                <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {members.map((member) => (
                        <li key={member.id} className="flex">
                            <CollectorCard member={member} />
                        </li>
                    ))}
                </ul>
            )}

            {rosterTruncated && (
                <p className="text-muted-foreground mt-4 text-center text-xs">
                    The community outgrew what &ldquo;recently active&rdquo; can rank in one pass —
                    the tail of this list is ordered by join date.{" "}
                    <Link href={membersHref({ q: filters.q, sort: "az" })} className="text-forest">
                        Browse A&ndash;Z
                    </Link>{" "}
                    for the complete roster.
                </p>
            )}

            {totalPages > 1 && (
                <nav
                    className="mt-6 flex items-center justify-center gap-4"
                    aria-label="Members pagination"
                >
                    {page > 1 ? (
                        <Link
                            href={membersHref({ ...filters, page: page - 1 })}
                            className="btn-ghostleather !px-4 !py-2 !text-xs"
                            rel="prev"
                        >
                            ← Previous
                        </Link>
                    ) : (
                        <span className="text-muted-foreground px-4 py-2 text-xs opacity-40">
                            ← Previous
                        </span>
                    )}
                    <span className="text-muted-foreground text-sm">
                        Page {page} of {totalPages.toLocaleString()}
                    </span>
                    {page < totalPages ? (
                        <Link
                            href={membersHref({ ...filters, page: page + 1 })}
                            className="btn-ghostleather !px-4 !py-2 !text-xs"
                            rel="next"
                        >
                            Next →
                        </Link>
                    ) : (
                        <span className="text-muted-foreground px-4 py-2 text-xs opacity-40">
                            Next →
                        </span>
                    )}
                </nav>
            )}
        </ExplorerLayout>
    );
}
