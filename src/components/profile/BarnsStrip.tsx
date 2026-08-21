/**
 * The member's barns — PUBLIC memberships only.
 *
 * Private and restricted barns never appear here, and the filter
 * that guarantees it lives in fetchProfileBarns, not in RLS: see the
 * header of src/app/profile/reads.ts for why neither policy can be
 * relied on to do it.
 */

import Link from "next/link";

import { GROUP_TYPE_LABELS } from "@/lib/constants/groups";
import type { ProfileBarn } from "@/app/profile/reads";
import { EmptyNote, SectionHeading } from "./ProfileSection";

const ROLE_LABELS: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    moderator: "Mod",
};

export default function BarnsStrip({
    alias,
    isOwnProfile,
    barns,
}: {
    alias: string;
    isOwnProfile: boolean;
    barns: ProfileBarn[];
}) {
    return (
        <section className="animate-fade-in-up mt-10" id="barns">
            <SectionHeading
                title="Barns"
                note={barns.length > 0 ? `${barns.length} public` : undefined}
            />
            {barns.length === 0 ? (
                <EmptyNote
                    icon="🚪"
                    title={isOwnProfile ? "No barns on your gate sign yet" : "Not in any public barns"}
                >
                    {isOwnProfile
                        ? "Public barns you join show up here. Private ones stay off your profile — always."
                        : `@${alias} keeps to their own aisle, or their barns are private.`}
                </EmptyNote>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {barns.map((barn) => {
                        const role = ROLE_LABELS[barn.role];
                        return (
                            <Link
                                key={barn.id}
                                href={`/community/groups/${barn.slug}`}
                                className="border-input bg-card/50 flex items-center gap-2 rounded-lg border px-3 py-2 no-underline backdrop-blur-sm transition-all hover:translate-y-[-1px]"
                            >
                                <span aria-hidden="true">🐎</span>
                                <span className="min-w-0">
                                    <span className="block font-serif text-sm font-bold text-foreground">
                                        {barn.name}
                                    </span>
                                    <span className="block text-[0.65rem] tracking-widest text-muted-foreground uppercase">
                                        {GROUP_TYPE_LABELS[barn.groupType] || barn.groupType}
                                        {barn.region && <> · {barn.region}</>}
                                    </span>
                                </span>
                                {role && <span className="stamp ml-1">{role}</span>}
                            </Link>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
