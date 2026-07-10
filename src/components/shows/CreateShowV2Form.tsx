"use client";

/**
 * Phase C — create-show form for /shows/host. One well-organized
 * ledger page, not a wizard. Mode picks which date fields render:
 * live = show date + venue (+ optional capacity); online = entry
 * window + judging deadline.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createShow } from "@/app/actions/shows-v2";
import type { ShowJudging, ShowMode } from "@/lib/shows/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-foreground">{label}</span>
            {children}
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </label>
    );
}

/** datetime-local value → ISO string with offset (what the zod schema wants). */
function toIso(local: string): string | undefined {
    if (!local) return undefined;
    const date = new Date(local);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export default function CreateShowV2Form() {
    const router = useRouter();
    const [mode, setMode] = useState<ShowMode>("live");
    const [judging, setJudging] = useState<ShowJudging>("judged");
    const [title, setTitle] = useState("");
    const [showDate, setShowDate] = useState("");
    const [venueName, setVenueName] = useState("");
    const [venueAddress, setVenueAddress] = useState("");
    const [capacity, setCapacity] = useState("");
    const [entriesOpenAt, setEntriesOpenAt] = useState("");
    const [entriesCloseAt, setEntriesCloseAt] = useState("");
    const [judgingEndsAt, setJudgingEndsAt] = useState("");
    const [rulesMd, setRulesMd] = useState("");
    const [feeInfo, setFeeInfo] = useState("");
    const [isMhhQualifying, setIsMhhQualifying] = useState(true);
    const [sanctioningNote, setSanctioningNote] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        const capacityNum = capacity.trim() === "" ? undefined : Number(capacity);
        const result = await createShow({
            title,
            mode,
            judging,
            isMhhQualifying,
            rulesMd: rulesMd.trim() || undefined,
            feeInfo: feeInfo.trim() || undefined,
            sanctioningNote: sanctioningNote.trim() || undefined,
            ...(mode === "live"
                ? {
                      showDate: showDate || undefined,
                      venueName: venueName.trim() || undefined,
                      venueAddress: venueAddress.trim() || undefined,
                      capacity:
                          capacityNum !== undefined && Number.isFinite(capacityNum)
                              ? capacityNum
                              : undefined,
                  }
                : {
                      entriesOpenAt: toIso(entriesOpenAt),
                      entriesCloseAt: toIso(entriesCloseAt),
                      judgingEndsAt: toIso(judgingEndsAt),
                  }),
        });

        if (result.success) {
            router.push(`/shows/host/${result.showId}`);
            router.refresh();
            return;
        }
        setError(result.error);
        setSubmitting(false);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <Field label="Show title">
                <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Spring Fling Live 2027"
                    required
                    maxLength={120}
                />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
                <Field
                    label="Mode"
                    hint="Locked once the show leaves draft — live shows run in rings on a day; online shows judge photos over a window."
                >
                    <Select value={mode} onValueChange={(v) => setMode(v as ShowMode)}>
                        <SelectTrigger aria-label="Show mode">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="live">Live show</SelectItem>
                            <SelectItem value="online">Online photo show</SelectItem>
                        </SelectContent>
                    </Select>
                </Field>
                <Field
                    label="Judging method"
                    hint="Community vote is a fun option for casual shows."
                >
                    <Select value={judging} onValueChange={(v) => setJudging(v as ShowJudging)}>
                        <SelectTrigger aria-label="Judging method">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="judged">Judged</SelectItem>
                            <SelectItem value="community_vote">Community vote</SelectItem>
                        </SelectContent>
                    </Select>
                </Field>
            </div>

            {mode === "live" ? (
                <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Show date">
                        <Input
                            type="date"
                            value={showDate}
                            onChange={(e) => setShowDate(e.target.value)}
                        />
                    </Field>
                    <Field label="Table capacity" hint="Leave blank for no cap.">
                        <Input
                            type="number"
                            min={1}
                            max={10000}
                            value={capacity}
                            onChange={(e) => setCapacity(e.target.value)}
                            placeholder="e.g. 40"
                        />
                    </Field>
                    <Field label="Venue name">
                        <Input
                            value={venueName}
                            onChange={(e) => setVenueName(e.target.value)}
                            placeholder="Fairgrounds Expo Hall"
                            maxLength={200}
                        />
                    </Field>
                    <Field label="Venue address">
                        <Input
                            value={venueAddress}
                            onChange={(e) => setVenueAddress(e.target.value)}
                            placeholder="123 Main St, Springfield"
                            maxLength={500}
                        />
                    </Field>
                </div>
            ) : (
                <div className="grid gap-5 sm:grid-cols-3">
                    <Field label="Entries open">
                        <Input
                            type="datetime-local"
                            value={entriesOpenAt}
                            onChange={(e) => setEntriesOpenAt(e.target.value)}
                        />
                    </Field>
                    <Field label="Entries close">
                        <Input
                            type="datetime-local"
                            value={entriesCloseAt}
                            onChange={(e) => setEntriesCloseAt(e.target.value)}
                        />
                    </Field>
                    <Field label="Judging deadline">
                        <Input
                            type="datetime-local"
                            value={judgingEndsAt}
                            onChange={(e) => setJudgingEndsAt(e.target.value)}
                        />
                    </Field>
                </div>
            )}

            <Field label="Rules" hint="Markdown supported — entrants see this on the show page.">
                <Textarea
                    value={rulesMd}
                    onChange={(e) => setRulesMd(e.target.value)}
                    rows={6}
                    placeholder={"## Entry rules\n- One breed halter class per horse\n- ..."}
                />
            </Field>

            <Field label="Fees" hint="How entrants pay and how much — fee checkout ships later; this is your notice text.">
                <Textarea
                    value={feeInfo}
                    onChange={(e) => setFeeInfo(e.target.value)}
                    rows={3}
                    placeholder="$20 per table, PayPal to..."
                />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
                <label className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                    <input
                        type="checkbox"
                        checked={isMhhQualifying}
                        onChange={(e) => setIsMhhQualifying(e.target.checked)}
                        className="size-4 accent-forest"
                    />
                    MHH qualifying show
                    <span className="font-normal text-muted-foreground">
                        (1st &amp; 2nd in qualifying classes earn cards)
                    </span>
                </label>
                <Field label="Sanctioning note (optional)">
                    <Input
                        value={sanctioningNote}
                        onChange={(e) => setSanctioningNote(e.target.value)}
                        placeholder="NAMHSA member show"
                        maxLength={200}
                    />
                </Field>
            </div>

            {error && (
                <p role="alert" className="text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}

            <div>
                <Button type="submit" disabled={submitting}>
                    {submitting ? "Creating…" : "Create show"}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                    Your show starts as a draft — build the classlist, then publish when ready.
                </p>
            </div>
        </form>
    );
}
