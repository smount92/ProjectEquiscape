"use client";

/**
 * Admin → Members. Search by alias, see who is suspended, act.
 *
 * `users.is_suspended` (migration 148) was deliberately never granted
 * to the client key — the profile page has to reach for the service
 * role to read it (see src/app/profile/[alias_name]/page.tsx). That is
 * exactly why this tab reads through `searchMembers` in
 * actions/admin.ts, behind verifyAdmin, instead of querying from here.
 *
 * Suspend/unsuspend call the existing suspendUser / unsuspendUser
 * untouched: both stamps (app_metadata + the users row) and the global
 * session revocation that makes a suspension bite on an already-open
 * tab all still happen server-side.
 */

import { useCallback, useEffect, useState, useTransition } from "react";

import {
    searchMembers,
    suspendUser,
    unsuspendUser,
    type AdminMemberRow,
} from "@/app/actions/admin";
import AdminModerationCard from "@/components/AdminModerationCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function formatDay(iso: string | null): string {
    if (!iso) return "unknown";
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function MemberRow({
    member,
    onChanged,
}: {
    member: AdminMemberRow;
    onChanged: () => void;
}) {
    const [reason, setReason] = useState("");
    const [showReason, setShowReason] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const act = (mode: "suspend" | "unsuspend") => {
        if (mode === "suspend" && reason.trim().length < 3) {
            setError("A reason is required — it lands on the audit trail.");
            return;
        }
        startTransition(async () => {
            setError(null);
            const result =
                mode === "suspend"
                    ? await suspendUser(member.id, reason)
                    : await unsuspendUser(member.id);
            if (!result.success) {
                setError(result.error ?? "Something went wrong.");
                return;
            }
            setReason("");
            setShowReason(false);
            onChanged();
        });
    };

    return (
        <li
            className={`rounded-lg border px-4 py-3 ${
                member.isSuspended ? "border-destructive/40 bg-destructive/5" : "border-input bg-card"
            }`}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <a
                            href={`/profile/${encodeURIComponent(member.alias)}`}
                            className="font-semibold text-forest no-underline hover:underline"
                        >
                            @{member.alias}
                        </a>
                        {member.isSupporter && (
                            <span className="rounded-full border border-input px-2 py-0.5 text-[0.65rem] font-bold tracking-wide text-muted-foreground uppercase">
                                Supporter
                            </span>
                        )}
                        {member.isSuspended && (
                            <span className="rounded-full bg-destructive px-2 py-0.5 text-[0.65rem] font-bold tracking-wide text-white uppercase">
                                Suspended
                            </span>
                        )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                        {member.email ?? "no email on file"} · joined {formatDay(member.createdAt)}{" "}
                        · {member.horseCount.toLocaleString()} horse
                        {member.horseCount === 1 ? "" : "s"}
                    </div>
                    {member.isSuspended && (
                        <div className="mt-1 text-xs text-destructive">
                            Suspended {formatDay(member.suspendedAt)}
                            {member.suspendedReason ? ` — “${member.suspendedReason}”` : ""}
                        </div>
                    )}
                </div>

                <div className="flex shrink-0 gap-2">
                    {member.isSuspended ? (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => act("unsuspend")}
                        >
                            {pending ? "Working…" : "Unsuspend"}
                        </Button>
                    ) : showReason ? (
                        <Button
                            variant="destructive-outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => act("suspend")}
                        >
                            {pending ? "Suspending…" : "Confirm suspend"}
                        </Button>
                    ) : (
                        <Button
                            variant="destructive-outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => setShowReason(true)}
                        >
                            Suspend
                        </Button>
                    )}
                </div>
            </div>

            {showReason && !member.isSuspended && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Reason (required — lands on the audit trail)"
                        aria-label={`Suspension reason for ${member.alias}`}
                        disabled={pending}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                            setShowReason(false);
                            setReason("");
                            setError(null);
                        }}
                    >
                        Cancel
                    </Button>
                </div>
            )}

            {error && (
                <p role="alert" className="m-0 mt-2 text-sm font-medium text-destructive">
                    {error}
                </p>
            )}
        </li>
    );
}

export default function AdminMembersTab() {
    const [query, setQuery] = useState("");
    const [members, setMembers] = useState<AdminMemberRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async (q: string) => {
        setLoading(true);
        const result = await searchMembers(q);
        if (result.success) {
            setMembers(result.members);
            setError(null);
        } else {
            setError(result.error);
        }
        setLoading(false);
    }, []);

    // Debounced search; the empty query lists the newest members, so the
    // tab is useful before anything is typed.
    useEffect(() => {
        const timer = setTimeout(() => void load(query), query ? 300 : 0);
        return () => clearTimeout(timer);
    }, [query, load]);

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="mt-0 mb-1 flex items-center gap-2 text-base font-bold">
                    👤 Members
                </h3>
                <p className="mt-0 mb-3 text-xs text-muted-foreground">
                    Search by alias. Suspension is site-wide and reversible: the account can still
                    sign in and read, every mutation is refused, and live sessions are revoked so it
                    bites on an already-open tab.
                </p>
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search aliases… (empty = newest 25 members)"
                    aria-label="Search members by alias"
                />
            </div>

            {error && (
                <p role="alert" className="m-0 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}

            {loading ? (
                <p className="m-0 text-sm text-muted-foreground">Loading…</p>
            ) : members.length === 0 ? (
                <div className="rounded-lg border border-input bg-card px-8 py-12 text-center">
                    <div className="mb-3 text-4xl">🔍</div>
                    <h2 className="m-0 text-base font-bold">No members match</h2>
                    <p className="m-0 mt-1 text-sm text-muted-foreground">
                        Aliases are matched as a substring, case-insensitively.
                    </p>
                </div>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {members.map((m) => (
                        <MemberRow key={m.id} member={m} onChanged={() => void load(query)} />
                    ))}
                </ul>
            )}

            <div>
                <h3 className="mt-0 mb-2 text-sm font-bold text-muted-foreground">
                    Direct handle (no search needed)
                </h3>
                <AdminModerationCard />
            </div>
        </div>
    );
}
