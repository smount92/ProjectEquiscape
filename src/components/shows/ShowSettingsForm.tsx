"use client";

/**
 * Console SETTINGS tab (Wave 2) — the host's edit surface for an
 * existing show, wired to the long-existing updateShowSettings
 * action (until now its only UI caller was the blind-browsing
 * toggle — hosts literally could not fix a typo after creation).
 *
 * Ground rules:
 *  - Managers only: ShowConsole only renders this tab for
 *    host/co-host; the action re-checks server-side.
 *  - The patch is a DIFF — only fields that actually changed are
 *    sent, so a concurrent co-host edit is never clobbered by
 *    untouched fields, and "save" with no edits is refused locally.
 *  - Mode + judging method are DRAFT-ONLY in this UI even where the
 *    action is looser (changing the judging machinery mid-show is a
 *    footgun; the state machine branches on both).
 *  - Once entries have opened, date edits pause for a confirm:
 *    entrants will see the change, and the hourly transition cron
 *    enforces whatever time is stored.
 *
 * NOTE ON TIMEZONES: this component only ever mounts client-side
 * (the console's tabs render on click), so datetime-local inputs
 * are safely seeded from the viewer's clock, with the zone named
 * beside the fields — never a bare wall-clock time.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { updateShowSettings } from "@/app/actions/shows-v2";
import type { ConsoleShow } from "@/lib/shows/console";
import { SHOW_STATUS_ORDER } from "@/lib/shows/stateMachine";
import type { ShowJudging, ShowMode } from "@/lib/shows/types";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// ── Pure helpers (exported for unit tests) ──

/** The updateShowSettings patch shape this form can produce
 *  (structurally matches updateShowSettingsSchema's `patch`). */
export interface ShowSettingsPatch {
    title?: string;
    mode?: ShowMode;
    judging?: ShowJudging;
    venueName?: string | null;
    venueAddress?: string | null;
    showDate?: string | null;
    entriesOpenAt?: string | null;
    entriesCloseAt?: string | null;
    judgingEndsAt?: string | null;
    aboutMd?: string | null;
    rulesMd?: string | null;
    feeInfo?: string | null;
    capacity?: number | null;
    isMhhQualifying?: boolean;
    sanctioningNote?: string | null;
}

/** All inputs as the form holds them (strings for text/date fields). */
export interface SettingsFormValues {
    title: string;
    mode: ShowMode;
    judging: ShowJudging;
    /** yyyy-MM-dd (live shows). */
    showDate: string;
    venueName: string;
    venueAddress: string;
    /** Numeric text; "" = no cap. */
    capacity: string;
    /** datetime-local strings in the viewer's zone. */
    entriesOpenAt: string;
    entriesCloseAt: string;
    judgingEndsAt: string;
    aboutMd: string;
    rulesMd: string;
    feeInfo: string;
    isMhhQualifying: boolean;
    sanctioningNote: string;
}

/** ISO (with zone) → datetime-local input value in the viewer's zone. */
export function isoToLocalInput(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours(),
    )}:${pad(d.getMinutes())}`;
}

/** datetime-local input value → ISO string; "" / invalid → null. */
export function localInputToIso(local: string): string | null {
    if (!local) return null;
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Same instant at minute precision? (datetime-local drops seconds —
 *  an untouched field must never register as a change). */
function sameMinute(aIso: string | null, bIso: string | null): boolean {
    if (!aIso || !bIso) return aIso === bIso;
    return (
        Math.floor(new Date(aIso).getTime() / 60000) ===
        Math.floor(new Date(bIso).getTime() / 60000)
    );
}

export function initialValues(show: ConsoleShow): SettingsFormValues {
    return {
        title: show.title,
        mode: show.mode,
        judging: show.judging,
        showDate: (show.showDate ?? "").slice(0, 10),
        venueName: show.venueName ?? "",
        venueAddress: show.venueAddress ?? "",
        capacity: show.capacity !== null ? String(show.capacity) : "",
        entriesOpenAt: isoToLocalInput(show.entriesOpenAt),
        entriesCloseAt: isoToLocalInput(show.entriesCloseAt),
        judgingEndsAt: isoToLocalInput(show.judgingEndsAt),
        aboutMd: show.aboutMd ?? "",
        rulesMd: show.rulesMd ?? "",
        feeInfo: show.feeInfo ?? "",
        isMhhQualifying: show.isMhhQualifying,
        sanctioningNote: show.sanctioningNote ?? "",
    };
}

/** Trimmed text → value-or-null against the stored nullable column. */
function textDelta(current: string, initial: string | null): string | null | undefined {
    const trimmed = current.trim();
    if (trimmed === (initial ?? "")) return undefined;
    return trimmed === "" ? null : trimmed;
}

/**
 * Diff the form against the loaded show → the minimal patch.
 * Mode/judging only ever enter the patch while the show is a draft
 * (the UI also disables those controls past draft).
 */
export function buildSettingsPatch(
    show: ConsoleShow,
    values: SettingsFormValues,
): ShowSettingsPatch {
    const patch: ShowSettingsPatch = {};

    const title = values.title.trim();
    if (title !== show.title) patch.title = title;

    if (show.status === "draft") {
        if (values.mode !== show.mode) patch.mode = values.mode;
        if (values.judging !== show.judging) patch.judging = values.judging;
    }

    if (values.showDate !== (show.showDate ?? "").slice(0, 10)) {
        patch.showDate = values.showDate === "" ? null : values.showDate;
    }

    const datetimeFields = [
        ["entriesOpenAt", values.entriesOpenAt, show.entriesOpenAt],
        ["entriesCloseAt", values.entriesCloseAt, show.entriesCloseAt],
        ["judgingEndsAt", values.judgingEndsAt, show.judgingEndsAt],
    ] as const;
    for (const [key, local, initial] of datetimeFields) {
        const iso = localInputToIso(local);
        if (!sameMinute(iso, initial)) patch[key] = iso;
    }

    const venueName = textDelta(values.venueName, show.venueName);
    if (venueName !== undefined) patch.venueName = venueName;
    const venueAddress = textDelta(values.venueAddress, show.venueAddress);
    if (venueAddress !== undefined) patch.venueAddress = venueAddress;
    const aboutMd = textDelta(values.aboutMd, show.aboutMd);
    if (aboutMd !== undefined) patch.aboutMd = aboutMd;
    const rulesMd = textDelta(values.rulesMd, show.rulesMd);
    if (rulesMd !== undefined) patch.rulesMd = rulesMd;
    const feeInfo = textDelta(values.feeInfo, show.feeInfo);
    if (feeInfo !== undefined) patch.feeInfo = feeInfo;
    const sanctioningNote = textDelta(values.sanctioningNote, show.sanctioningNote);
    if (sanctioningNote !== undefined) patch.sanctioningNote = sanctioningNote;

    const capacityText = values.capacity.trim();
    const capacity = capacityText === "" ? null : Number(capacityText);
    if (capacity === null || Number.isFinite(capacity)) {
        if (capacity !== show.capacity) patch.capacity = capacity;
    }

    if (values.isMhhQualifying !== show.isMhhQualifying) {
        patch.isMhhQualifying = values.isMhhQualifying;
    }

    return patch;
}

const DATE_KEYS: (keyof ShowSettingsPatch)[] = [
    "showDate",
    "entriesOpenAt",
    "entriesCloseAt",
    "judgingEndsAt",
];

/** Does this patch touch the schedule? (Drives the post-open confirm.) */
export function patchTouchesDates(patch: ShowSettingsPatch): boolean {
    return DATE_KEYS.some((key) => key in patch);
}

/** "CDT — America/Chicago" for the schedule hint; null if Intl balks. */
function viewerZoneLabel(): string | null {
    try {
        const dtf = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" });
        const zone = dtf.resolvedOptions().timeZone;
        const short = dtf
            .formatToParts(new Date())
            .find((p) => p.type === "timeZoneName")?.value;
        return short && zone ? `${short} — ${zone}` : (zone ?? null);
    } catch {
        return null;
    }
}

// ── Presentational bits ──

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

export default function ShowSettingsForm({ show }: { show: ConsoleShow }) {
    const router = useRouter();
    // Seeded once on mount; the tab only mounts client-side, so the
    // viewer's timezone is the right lens from the first paint.
    const [values, setValues] = useState<SettingsFormValues>(() => initialValues(show));
    const [zoneLabel] = useState<string | null>(() => viewerZoneLabel());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmPatch, setConfirmPatch] = useState<ShowSettingsPatch | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (toastTimer.current) clearTimeout(toastTimer.current);
        },
        [],
    );

    const set = <K extends keyof SettingsFormValues>(key: K, value: SettingsFormValues[K]) =>
        setValues((prev) => ({ ...prev, [key]: value }));

    const isDraft = show.status === "draft";
    const entriesHaveOpened =
        SHOW_STATUS_ORDER.indexOf(show.status) >= SHOW_STATUS_ORDER.indexOf("entries_open");

    const showSavedToast = () => {
        setToast("Settings saved.");
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 2500);
    };

    const submitPatch = async (patch: ShowSettingsPatch) => {
        setSaving(true);
        setError(null);
        const result = await updateShowSettings({ showId: show.id, patch });
        if (result.success) {
            setConfirmPatch(null);
            showSavedToast();
            router.refresh();
        } else {
            setError(result.error);
        }
        setSaving(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const patch = buildSettingsPatch(show, values);
        if (Object.keys(patch).length === 0) {
            setError("Nothing has changed yet.");
            return;
        }

        // Window sanity against the EFFECTIVE values (patched or stored).
        const openIso =
            patch.entriesOpenAt !== undefined ? patch.entriesOpenAt : show.entriesOpenAt;
        const closeIso =
            patch.entriesCloseAt !== undefined ? patch.entriesCloseAt : show.entriesCloseAt;
        if (openIso && closeIso && new Date(openIso) >= new Date(closeIso)) {
            setError("Entries must open before they close.");
            return;
        }

        if (entriesHaveOpened && patchTouchesDates(patch)) {
            setConfirmPatch(patch);
            return;
        }
        void submitPatch(patch);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
            {/* ── Identity ── */}
            <section className="ledger-card" aria-labelledby="settings-identity-heading">
                <span className="ledger-tab" id="settings-identity-heading">
                    Show Settings
                </span>
                <div className="flex flex-col gap-5">
                    <Field label="Show title">
                        <Input
                            value={values.title}
                            onChange={(e) => set("title", e.target.value)}
                            maxLength={120}
                            required
                        />
                    </Field>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <Field
                            label="Mode"
                            hint={
                                isDraft
                                    ? "Live shows run in rings on a day; online shows judge photos over a window."
                                    : "Locked — mode can only change while the show is a draft."
                            }
                        >
                            <Select
                                value={values.mode}
                                onValueChange={(v) => set("mode", v as ShowMode)}
                                disabled={!isDraft}
                            >
                                <SelectTrigger aria-label="Show mode" data-testid="settings-mode">
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
                            hint={
                                isDraft
                                    ? "Community vote is a fun option for casual shows."
                                    : "Locked — the judging method can only change while the show is a draft."
                            }
                        >
                            <Select
                                value={values.judging}
                                onValueChange={(v) => set("judging", v as ShowJudging)}
                                disabled={!isDraft}
                            >
                                <SelectTrigger
                                    aria-label="Judging method"
                                    data-testid="settings-judging"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="judged">Judged</SelectItem>
                                    <SelectItem value="community_vote">Community vote</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <label className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                            <input
                                type="checkbox"
                                checked={values.isMhhQualifying}
                                onChange={(e) => set("isMhhQualifying", e.target.checked)}
                                className="size-4 accent-forest"
                            />
                            MHH qualifying show
                            <span className="font-normal text-muted-foreground">
                                (1st and 2nd in each qualifying class earn digital cards.)
                            </span>
                        </label>
                        <Field label="Sanctioning note">
                            <Input
                                value={values.sanctioningNote}
                                onChange={(e) => set("sanctioningNote", e.target.value)}
                                placeholder="NAMHSA member show"
                                maxLength={200}
                            />
                        </Field>
                    </div>
                </div>
            </section>

            {/* ── Schedule ── */}
            <section className="ledger-card" aria-labelledby="settings-schedule-heading">
                <span className="ledger-tab" id="settings-schedule-heading">
                    Schedule
                </span>
                <div className="flex flex-col gap-5">
                    {show.mode === "live" && (
                        <div className="grid gap-5 sm:grid-cols-2">
                            <Field
                                label="Show date"
                                hint="A calendar date — it reads the same in every timezone."
                            >
                                <Input
                                    type="date"
                                    value={values.showDate}
                                    onChange={(e) => set("showDate", e.target.value)}
                                />
                            </Field>
                        </div>
                    )}
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        <Field label="Entries open">
                            <Input
                                type="datetime-local"
                                value={values.entriesOpenAt}
                                onChange={(e) => set("entriesOpenAt", e.target.value)}
                                aria-label="Entries open"
                            />
                        </Field>
                        <Field label="Entries close">
                            <Input
                                type="datetime-local"
                                value={values.entriesCloseAt}
                                onChange={(e) => set("entriesCloseAt", e.target.value)}
                                aria-label="Entries close"
                            />
                        </Field>
                        {show.mode === "online" && (
                            <Field label="Judging deadline">
                                <Input
                                    type="datetime-local"
                                    value={values.judgingEndsAt}
                                    onChange={(e) => set("judgingEndsAt", e.target.value)}
                                    aria-label="Judging deadline"
                                />
                            </Field>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {zoneLabel
                            ? `Times are in your timezone (${zoneLabel}); entrants see them in theirs.`
                            : "Times are in your timezone; entrants see them in theirs."}
                        {entriesHaveOpened &&
                            " Entries have already opened — entrants will see any schedule change, and the hourly clock enforces the new time."}
                    </p>
                </div>
            </section>

            {/* ── Venue (live only) ── */}
            {show.mode === "live" && (
                <section className="ledger-card" aria-labelledby="settings-venue-heading">
                    <span className="ledger-tab" id="settings-venue-heading">
                        Venue
                    </span>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <Field label="Venue name">
                            <Input
                                value={values.venueName}
                                onChange={(e) => set("venueName", e.target.value)}
                                placeholder="Fairgrounds Expo Hall"
                                maxLength={200}
                            />
                        </Field>
                        <Field label="Venue address">
                            <Input
                                value={values.venueAddress}
                                onChange={(e) => set("venueAddress", e.target.value)}
                                placeholder="123 Main St, Springfield"
                                maxLength={500}
                            />
                        </Field>
                        <Field label="Table capacity" hint="Leave blank for no cap.">
                            <Input
                                type="number"
                                min={1}
                                max={10000}
                                value={values.capacity}
                                onChange={(e) => set("capacity", e.target.value)}
                                placeholder="e.g. 40"
                            />
                        </Field>
                    </div>
                </section>
            )}

            {/* ── Show page text ── */}
            <section className="ledger-card" aria-labelledby="settings-page-heading">
                <span className="ledger-tab" id="settings-page-heading">
                    Show Page
                </span>
                <div className="flex flex-col gap-5">
                    <Field
                        label="About this show"
                        hint="A welcome for your entrants — shown at the top of the show page."
                    >
                        <Textarea
                            value={values.aboutMd}
                            onChange={(e) => set("aboutMd", e.target.value)}
                            rows={4}
                            maxLength={20000}
                        />
                    </Field>
                    <Field label="Rules" hint="Markdown supported — entrants see this on the show page.">
                        <Textarea
                            value={values.rulesMd}
                            onChange={(e) => set("rulesMd", e.target.value)}
                            rows={6}
                            maxLength={20000}
                        />
                    </Field>
                    <Field
                        label="Fees"
                        hint="How entrants pay and how much — blank reads as “Free” on the show page."
                    >
                        <Textarea
                            value={values.feeInfo}
                            onChange={(e) => set("feeInfo", e.target.value)}
                            rows={3}
                            maxLength={20000}
                        />
                    </Field>
                </div>
            </section>

            {error && (
                <p role="alert" className="text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}

            <div>
                <Button type="submit" disabled={saving} data-testid="settings-save">
                    {saving ? "Saving…" : "Save settings"}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                    Only the fields you changed are saved.
                </p>
            </div>

            {/* Post-open schedule confirm */}
            <Dialog
                open={confirmPatch !== null}
                onOpenChange={(next) => {
                    if (!next && !saving) setConfirmPatch(null);
                }}
            >
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>Change the schedule?</DialogTitle>
                        <DialogDescription>
                            Entries have already opened — entrants will see the change, and the
                            hourly clock enforces the new time.
                        </DialogDescription>
                    </DialogHeader>
                    {error && (
                        <p role="alert" className="text-sm font-semibold text-destructive">
                            {error}
                        </p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            size="wide"
                            onClick={() => setConfirmPatch(null)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="wide"
                            onClick={() => confirmPatch && submitPatch(confirmPatch)}
                            disabled={saving}
                            data-testid="settings-confirm-save"
                        >
                            {saving ? "Saving…" : "Save changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {toast && (
                <div className="share-toast" role="status" aria-live="polite">
                    {toast}
                </div>
            )}
        </form>
    );
}
