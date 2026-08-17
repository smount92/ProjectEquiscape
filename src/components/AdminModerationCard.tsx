"use client";

/**
 * Admin console — site-wide suspension control (v4 safety, migration
 * 148). Thin alias-based front for suspendUserByAlias /
 * unsuspendUserByAlias: suspension stamps app_metadata (requireAuth
 * throws on every mutation) + the users row, and is fully reversible.
 * The actions verify ADMIN_EMAIL server-side; this card is just the
 * handle.
 */

import { useState } from "react";

import { suspendUserByAlias, unsuspendUserByAlias } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminModerationCard() {
    const [alias, setAlias] = useState("");
    const [reason, setReason] = useState("");
    const [pending, setPending] = useState<"suspend" | "unsuspend" | null>(null);
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

    const run = async (mode: "suspend" | "unsuspend") => {
        if (!alias.trim()) {
            setNotice({ ok: false, text: "Enter the user's alias." });
            return;
        }
        if (mode === "suspend" && reason.trim().length < 3) {
            setNotice({ ok: false, text: "A reason is required — it lands on the audit trail." });
            return;
        }
        setPending(mode);
        setNotice(null);
        const result =
            mode === "suspend"
                ? await suspendUserByAlias(alias, reason)
                : await unsuspendUserByAlias(alias);
        setNotice(
            result.success
                ? {
                      ok: true,
                      text:
                          mode === "suspend"
                              ? `@${alias.trim()} suspended — every mutation now refuses; takes effect on their next request.`
                              : `@${alias.trim()} unsuspended.`,
                  }
                : { ok: false, text: result.error ?? "Something went wrong." },
        );
        if (result.success && mode === "suspend") setReason("");
        setPending(null);
    };

    return (
        <div className="rounded-lg border border-input bg-card p-4">
            <h3 className="m-0 mb-1 text-base font-bold">Suspend a user</h3>
            <p className="m-0 mb-3 text-sm text-muted-foreground">
                Site-wide and reversible: a suspended account can still sign in and read, but every
                action (entering shows, posting, messaging, trading) is refused.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="Exact alias (case-insensitive)"
                    aria-label="User alias"
                    disabled={pending !== null}
                />
                <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (required to suspend)"
                    aria-label="Suspension reason"
                    disabled={pending !== null}
                />
            </div>
            <div className="mt-3 flex items-center gap-2">
                <Button
                    variant="destructive-outline"
                    size="sm"
                    disabled={pending !== null}
                    onClick={() => void run("suspend")}
                >
                    {pending === "suspend" ? "Suspending…" : "Suspend"}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={pending !== null}
                    onClick={() => void run("unsuspend")}
                >
                    {pending === "unsuspend" ? "Working…" : "Unsuspend"}
                </Button>
            </div>
            {notice && (
                <p
                    role={notice.ok ? "status" : "alert"}
                    className={`m-0 mt-2 text-sm font-medium ${notice.ok ? "text-muted-foreground" : "text-destructive"}`}
                >
                    {notice.text}
                </p>
            )}
        </div>
    );
}
