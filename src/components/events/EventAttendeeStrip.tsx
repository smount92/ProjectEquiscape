/**
 * "Who's going" — a face strip, not a list of usernames.
 *
 * Overlapping avatars read as a crowd at a glance; the names follow as
 * chips for anyone who wants to actually find a person. Interested
 * folk get their own, quieter row.
 */

import Link from "next/link";

import type { EventAttendee } from "@/app/actions/events";
import UserAvatar from "@/components/social/UserAvatar";

const FACE_CAP = 12;

function FaceRow({ people }: { people: EventAttendee[] }) {
    const shown = people.slice(0, FACE_CAP);
    const overflow = people.length - shown.length;

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex -space-x-2">
                {shown.map((p) => (
                    <UserAvatar
                        key={p.userId}
                        src={p.avatarUrl}
                        alias={p.alias}
                        size="sm"
                        href={`/profile/${encodeURIComponent(p.alias)}`}
                    />
                ))}
            </div>
            {overflow > 0 && (
                <span className="text-xs text-muted-foreground">+{overflow} more</span>
            )}
        </div>
    );
}

function NameChips({ people }: { people: EventAttendee[] }) {
    return (
        <div className="mt-2 flex flex-wrap gap-1">
            {people.map((p) => (
                <Link
                    key={p.userId}
                    href={`/profile/${encodeURIComponent(p.alias)}`}
                    className="ownership-link"
                >
                    @{p.alias}
                </Link>
            ))}
        </div>
    );
}

export default function EventAttendeeStrip({
    attendees,
}: {
    attendees: EventAttendee[];
}) {
    const going = attendees.filter((a) => a.status === "going");
    const interested = attendees.filter((a) => a.status === "interested");

    if (going.length === 0 && interested.length === 0) {
        return (
            <p className="m-0 text-sm text-muted-foreground">
                Nobody has said they&rsquo;re going yet — be the first.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {going.length > 0 && (
                <div>
                    <h3 className="mb-2 font-serif text-[0.8125rem] tracking-[0.14em] uppercase text-forest">
                        Going ({going.length})
                    </h3>
                    <FaceRow people={going} />
                    {going.length <= FACE_CAP && <NameChips people={going} />}
                </div>
            )}
            {interested.length > 0 && (
                <div>
                    <h3 className="mb-2 font-serif text-[0.8125rem] tracking-[0.14em] uppercase text-muted-foreground">
                        Interested ({interested.length})
                    </h3>
                    <FaceRow people={interested} />
                </div>
            )}
        </div>
    );
}
