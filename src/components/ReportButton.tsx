"use client";

import { useId, useState } from "react";
import { usePathname } from "next/navigation";
import { submitReport } from "@/app/actions/moderation";
import { NOT_LOGGED_IN } from "@/lib/actions/result";
import {
    COMMUNITY_RULES_URL,
    REPORT_DETAILS_MAX,
    REPORT_REASONS,
    REPORT_TARGET_NOUN,
    type ReportTargetType,
} from "@/lib/moderation/reports";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
 * focus inside, closes on Escape and hands focus back to the button. After
 * a report is sent the button stays where it was, reading "Reported", so
 * focus has somewhere to come back to and it can't be sent twice.
 *
 * Never shown on your own content: pass `isOwn` and it renders nothing.
 * A visitor who isn't signed in (`signedIn={false}`) gets "Log in to
 * report", which comes back to this page, rather than a form they would
 * fill in only to be told to log in.
 */
export default function ReportButton({
    targetType,
    targetId,
    isOwn = false,
    signedIn = true,
    variant = "text",
    className = "",
}: {
    targetType: ReportTargetType;
    targetId: string;
    /** The viewer made this. Nobody reports themselves. */
    isOwn?: boolean;
    /** False for a visitor who isn't logged in. */
    signedIn?: boolean;
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
    const pathname = usePathname();

    if (isOwn) return null;

    const noun = REPORT_TARGET_NOUN[targetType];
    const loginHref = `/login?redirectTo=${encodeURIComponent(pathname || "/")}`;

    if (!signedIn) {
        return variant === "icon" ? (
            <a
                href={loginHref}
                className={`${ICON_CHIP} ${className}`}
                aria-label={`Log in to report this ${noun}`}
                title="Log in to report"
            >
                <span aria-hidden="true">🚩</span>
            </a>
        ) : (
            <a href={loginHref} className={`${TEXT_LINK} ${className}`}>
                <span aria-hidden="true">🚩</span> Log in to report
            </a>
        );
    }

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
        // Sent: the button stays put, but there is nothing more to open.
        if (next && done) return;
        setOpen(next);
        if (!next && !done) setError("");
    };

    // aria-disabled rather than disabled, so the button can still take the
    // focus the dialog hands back when it closes.
    const sent = done && !open;
    const label = sent ? `You reported this ${noun}` : `Report this ${noun}`;
    const trigger =
        variant === "icon" ? (
            <button
                type="button"
                className={`${ICON_CHIP} ${sent ? "cursor-default opacity-60" : "cursor-pointer"} ${className}`}
                aria-label={label}
                aria-disabled={sent || undefined}
                title={sent ? "Reported" : label}
            >
                <span aria-hidden="true">🚩</span>
            </button>
        ) : (
            <button
                type="button"
                className={`${TEXT_LINK} ${sent ? "cursor-default no-underline hover:no-underline" : "cursor-pointer"} ${className}`}
                aria-label={label}
                aria-disabled={sent || undefined}
            >
                <span aria-hidden="true">🚩</span> {sent ? "Reported" : "Report"}
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
                                sent one. We go by our{" "}
                                <a
                                    href={COMMUNITY_RULES_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline"
                                >
                                    Community Conduct rules
                                    <span className="sr-only"> (opens in a new tab)</span>
                                </a>
                                .
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
                            <Textarea
                                id={`${ids}-details`}
                                className="min-h-[72px]"
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
                                        <a href={loginHref} className="underline">
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

/** The flag chip: at least 24×24 px, so it is a fair target among other small icons. */
const ICON_CHIP =
    "inline-flex min-h-6 min-w-6 items-center justify-center rounded-md border border-input bg-transparent px-1.5 py-0.5 text-xs font-semibold text-muted-foreground no-underline transition-all hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

const TEXT_LINK =
    "inline-flex items-center gap-1 rounded border-none bg-transparent p-1 text-xs text-muted-foreground no-underline hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
