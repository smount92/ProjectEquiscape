"use client";

import { useId, useState } from "react";
import { submitReport } from "@/app/actions/moderation";
import { NOT_LOGGED_IN } from "@/lib/actions/result";
import {
    REPORT_DETAILS_MAX,
    REPORT_REASONS,
    REPORT_TARGET_NOUN,
    type ReportTargetType,
} from "@/lib/moderation/reports";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

/**
 * The one Report button. Every kind of content a member can report mounts
 * this, so the wording, the reasons and the behaviour are the same
 * everywhere (posts, replies, barn threads, profiles, messages, horses and
 * their listings, show entries, Help ID).
 *
 * Small and quiet on purpose: a flag that sits beside the other little
 * actions, never louder than the content. It opens a dialog, which brings
 * focus inside, closes on Escape and hands focus back to the button.
 *
 * Never shown on your own content: pass `isOwn` and it renders nothing.
 */
export default function ReportButton({
    targetType,
    targetId,
    isOwn = false,
    variant = "text",
    className = "",
}: {
    targetType: ReportTargetType;
    targetId: string;
    /** The viewer made this. Nobody reports themselves. */
    isOwn?: boolean;
    /** "text": a small "Report" link. "icon": a flag chip for rows of small icon actions. */
    variant?: "text" | "icon";
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [details, setDetails] = useState("");
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");
    const ids = useId();

    if (isOwn) return null;

    const noun = REPORT_TARGET_NOUN[targetType];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason || saving) return;
        setSaving(true);
        setError("");
        const result = await submitReport({
            targetType,
            targetId,
            reason,
            details: details.trim() || undefined,
        });
        setSaving(false);
        if (result.success) setDone(true);
        else setError(result.error);
    };

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next && !done) setError("");
    };

    if (done && !open) {
        return (
            <span className={`text-xs text-muted-foreground ${className}`} role="status">
                Reported
            </span>
        );
    }

    const trigger =
        variant === "icon" ? (
            <button
                type="button"
                className={`inline-flex min-h-0 cursor-pointer items-center justify-center rounded-md border border-input bg-transparent px-1.5 py-0.5 text-xs font-semibold text-muted-foreground no-underline transition-all hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${className}`}
                aria-label={`Report this ${noun}`}
                title={`Report this ${noun}`}
            >
                <span aria-hidden="true">🚩</span>
            </button>
        ) : (
            <button
                type="button"
                className={`inline-flex cursor-pointer items-center gap-1 rounded border-none bg-transparent p-1 text-xs text-muted-foreground hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${className}`}
                aria-label={`Report this ${noun}`}
            >
                <span aria-hidden="true">🚩</span> Report
            </button>
        );

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="sm:max-w-md">
                {done ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Thank you</DialogTitle>
                            <DialogDescription>
                                We&apos;ll take a look at this {noun}, and we&apos;ll let you know what we decide.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button>Done</Button>
                            </DialogClose>
                        </DialogFooter>
                    </>
                ) : (
                    <form onSubmit={handleSubmit} className="grid gap-4">
                        <DialogHeader>
                            <DialogTitle>Report this {noun}</DialogTitle>
                            <DialogDescription>
                                Tell us what&apos;s wrong. Only the site team sees reports; the member is never told who
                                sent one.
                            </DialogDescription>
                        </DialogHeader>

                        <fieldset className="grid gap-1.5">
                            <legend className="mb-1 text-sm font-semibold">What&apos;s the problem?</legend>
                            {REPORT_REASONS.map((r) => (
                                <label
                                    key={r}
                                    className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted"
                                >
                                    <input
                                        type="radio"
                                        name={`${ids}-reason`}
                                        value={r}
                                        checked={reason === r}
                                        onChange={() => setReason(r)}
                                        className="accent-forest"
                                    />
                                    {r}
                                </label>
                            ))}
                        </fieldset>

                        <div className="grid gap-1.5">
                            <label htmlFor={`${ids}-details`} className="text-sm font-semibold">
                                Anything else we should know? <span className="font-normal">(optional)</span>
                            </label>
                            <textarea
                                id={`${ids}-details`}
                                className="min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                rows={3}
                                maxLength={REPORT_DETAILS_MAX}
                            />
                        </div>

                        {error && (
                            <p className="text-sm text-destructive" role="alert">
                                {error}
                                {error === NOT_LOGGED_IN && (
                                    <>
                                        {" "}
                                        <a href="/login" className="underline">
                                            Log in
                                        </a>
                                    </>
                                )}
                            </p>
                        )}

                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button type="submit" disabled={saving || !reason}>
                                {saving ? "Sending…" : "Send report"}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
