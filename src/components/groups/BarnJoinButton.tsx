"use client";

/**
 * The barn's front gate. One prominent control that knows all four
 * states: join a public barn, ask to join a private one, withdraw a
 * pending request, or leave. Rendered on the leather masthead, so
 * every button here is a leather-safe brass/ghost treatment.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelBarnJoinRequest, joinGroup, leaveGroup, type Group } from "@/app/actions/groups";

export default function BarnJoinButton({
    groupId,
    isMember,
    memberRole,
    isPrivate,
    joinRequestStatus,
}: {
    groupId: string;
    isMember: boolean;
    memberRole: string | null;
    isPrivate: boolean;
    joinRequestStatus: Group["joinRequestStatus"];
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [requested, setRequested] = useState(joinRequestStatus === "pending");

    const run = (fn: () => Promise<{ success: boolean; pending?: boolean; error?: string }>, onDone?: () => void) => {
        setError(null);
        startTransition(async () => {
            const result = await fn();
            if (!result.success) {
                setError(result.error || "Something went wrong.");
                return;
            }
            onDone?.();
            router.refresh();
        });
    };

    // Owners hold the deed — no leave button, or the barn is orphaned.
    if (isMember && memberRole === "owner") {
        return (
            <span
                className="font-serif text-[0.68rem] tracking-[0.16em] uppercase"
                style={{ color: "var(--leather-text-soft)" }}
            >
                👑 Your barn
            </span>
        );
    }

    if (isMember) {
        return (
            <Wrap error={error}>
                <button
                    className="btn-ghostleather !px-4 !py-2 !text-xs"
                    disabled={isPending}
                    onClick={() => {
                        if (!confirm("Leave this barn?")) return;
                        run(() => leaveGroup(groupId));
                    }}
                >
                    {isPending ? "Leaving…" : "Leave Barn"}
                </button>
            </Wrap>
        );
    }

    if (requested) {
        return (
            <Wrap error={error}>
                <button
                    className="btn-ghostleather !px-4 !py-2 !text-xs"
                    disabled={isPending}
                    onClick={() => run(() => cancelBarnJoinRequest(groupId), () => setRequested(false))}
                    title="Withdraw your request to join"
                >
                    {isPending ? "Withdrawing…" : "⏳ Request pending — withdraw"}
                </button>
            </Wrap>
        );
    }

    return (
        <Wrap error={error}>
            <button
                className="btn-brass !px-4 !py-2 !text-xs"
                disabled={isPending}
                onClick={() =>
                    run(
                        () => joinGroup(groupId),
                        () => { if (isPrivate) setRequested(true); },
                    )
                }
            >
                {isPending
                    ? (isPrivate ? "Requesting…" : "Joining…")
                    : (isPrivate ? "🔒 Request to Join" : "+ Join Barn")}
            </button>
        </Wrap>
    );
}

function Wrap({ children, error }: { children: React.ReactNode; error: string | null }) {
    return (
        <span className="inline-flex flex-col items-end gap-1">
            {children}
            {error && (
                <span
                    className="max-w-[22ch] text-right text-[0.65rem] leading-tight"
                    style={{ color: "var(--leather-text, #E8DCC8)" }}
                    role="alert"
                >
                    {error}
                </span>
            )}
        </span>
    );
}
