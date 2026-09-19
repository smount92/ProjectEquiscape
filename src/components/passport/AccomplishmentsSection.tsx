"use client";

/**
 * Other accomplishments (214) — what the horse did that isn't a show
 * placing. Race records with the Express or the FTRA, performance days,
 * breedings, awards. A ledger of rows under the show record, each with
 * the papers that back it (a race chart, a certificate) framed small.
 *
 * The owner adds and edits in place; visitors see nothing when empty.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
    createAccomplishment,
    deleteAccomplishment,
    updateAccomplishment,
    type AccomplishmentView,
} from "@/app/actions/accomplishments";
import type { PaperView } from "@/app/actions/papers";
import LinkifiedText from "@/components/LinkifiedText";
import PaperDialog from "@/components/passport/PaperDialog";
import PaperThumbs from "@/components/passport/PaperThumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    ACCOMPLISHMENT_GLYPHS,
    ACCOMPLISHMENT_KINDS,
    ACCOMPLISHMENT_LABELS,
    MAX_DATE_TEXT,
    MAX_DETAIL,
    MAX_ORG,
    MAX_RESULT,
    MAX_TITLE,
    accomplishmentLine,
    type AccomplishmentKind,
} from "@/lib/accomplishments";
import { ACCOMPLISHMENT_PAPER_KINDS } from "@/lib/papers/validate";
import { linkHost } from "@/lib/papers/validate";

interface Props {
    horseId: string;
    horseName: string;
    items: AccomplishmentView[];
    /** The horse's papers; the ones attached to an accomplishment render under it. */
    papers?: PaperView[];
    isOwner?: boolean;
}

type Draft = {
    kind: AccomplishmentKind;
    organization: string;
    title: string;
    result: string;
    when: string;
    detail: string;
    linkUrl: string;
    isPublic: boolean;
};

const EMPTY: Draft = { kind: "racing", organization: "", title: "", result: "", when: "", detail: "", linkUrl: "", isPublic: true };

function fromView(a: AccomplishmentView): Draft {
    return {
        kind: a.kind,
        organization: a.organization ?? "",
        title: a.title,
        result: a.result ?? "",
        when: a.dateText ?? a.happenedOn ?? "",
        detail: a.detail ?? "",
        linkUrl: a.linkUrl ?? "",
        isPublic: a.isPublic,
    };
}

export default function AccomplishmentsSection({ horseId, horseName, items, papers = [], isOwner = false }: Props) {
    const router = useRouter();
    const [editing, setEditing] = useState<"new" | string | null>(null);
    const [draft, setDraft] = useState<Draft>(EMPTY);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attaching, setAttaching] = useState<AccomplishmentView | null>(null);

    if (items.length === 0 && !isOwner) return null;

    const start = (a: AccomplishmentView | null) => {
        setDraft(a ? fromView(a) : EMPTY);
        setEditing(a ? a.id : "new");
        setError(null);
    };
    const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

    const save = async () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        const payload = {
            kind: draft.kind,
            organization: draft.organization.trim() || null,
            title: draft.title.trim(),
            result: draft.result.trim() || null,
            when: draft.when.trim() || null,
            detail: draft.detail.trim() || null,
            linkUrl: draft.linkUrl.trim() || null,
            isPublic: draft.isPublic,
        };
        const r =
            editing === "new"
                ? await createAccomplishment({ horseId, ...payload })
                : await updateAccomplishment({ id: editing as string, ...payload });
        setBusy(false);
        if (!r.success) {
            setError(r.error ?? "That didn't save.");
            return;
        }
        setEditing(null);
        router.refresh();
    };

    const remove = async (a: AccomplishmentView) => {
        if (!window.confirm(`Remove "${a.title}" from ${horseName}'s accomplishments?`)) return;
        setBusy(true);
        setError(null);
        const r = await deleteAccomplishment(a.id);
        setBusy(false);
        if (!r.success) {
            setError(r.error ?? "That didn't work.");
            return;
        }
        router.refresh();
    };

    const form = (
        <div className="border-input mt-2 grid gap-3 rounded-md border px-3 py-3" data-testid="accomplishment-form">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind of accomplishment">
                {ACCOMPLISHMENT_KINDS.map((k) => (
                    <button
                        key={k.value}
                        type="button"
                        role="radio"
                        aria-checked={draft.kind === k.value}
                        title={k.hint}
                        onClick={() => set("kind", k.value)}
                        className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs ${
                            draft.kind === k.value ? "border-forest bg-forest/10 text-forest font-semibold" : "border-input text-secondary-foreground"
                        }`}
                    >
                        {k.glyph} {k.label}
                    </button>
                ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <Input value={draft.organization} onChange={(e) => set("organization", e.target.value)} maxLength={MAX_ORG} placeholder="Organization — e.g. Express, FTRA" aria-label="Organization" />
                <Input value={draft.when} onChange={(e) => set("when", e.target.value)} maxLength={MAX_DATE_TEXT} placeholder="When — 2024, 2024-05 or Spring 2024" aria-label="When" />
            </div>
            <Input value={draft.title} onChange={(e) => set("title", e.target.value)} maxLength={MAX_TITLE} placeholder="Title — e.g. Autumn Classic (6 furlongs)" aria-label="Title" />
            <Input value={draft.result} onChange={(e) => set("result", e.target.value)} maxLength={MAX_RESULT} placeholder="Result — e.g. 2nd of 9, Reserve Champion" aria-label="Result" />
            <Textarea value={draft.detail} onChange={(e) => set("detail", e.target.value.slice(0, MAX_DETAIL))} rows={3} maxLength={MAX_DETAIL} placeholder="The story, the chart, who ran it. Links become clickable." aria-label="Detail" />
            <Input value={draft.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder="Link — the results page, the club's write-up (optional)" aria-label="Link" />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.isPublic} onChange={(e) => set("isPublic", e.target.checked)} className="h-4 w-4" />
                Show on the public passport
            </label>
            <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={busy}>
                    Cancel
                </Button>
                <Button size="sm" onClick={save} disabled={busy}>
                    {busy ? "Saving…" : "Save"}
                </Button>
            </div>
            {error && (
                <p role="alert" className="text-destructive m-0 text-sm font-semibold">
                    {error}
                </p>
            )}
        </div>
    );

    return (
        <section
            className="rounded-lg border border-input bg-card p-4 shadow-sm"
            id="passport-accomplishments"
            aria-labelledby="passport-accomplishments-heading"
        >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="brass-heading">
                    <span className="brass-heading-bar" aria-hidden="true" />
                    <h3 id="passport-accomplishments-heading" className="m-0 text-lg">
                        Other Accomplishments
                        {items.length > 0 && ` (${items.length})`}
                    </h3>
                </div>
                {isOwner && editing === null && (
                    <Button variant="outline" size="sm" onClick={() => start(null)}>
                        + Add
                    </Button>
                )}
            </div>
            <p className="text-secondary-foreground m-0 mb-3 text-xs leading-relaxed">
                {isOwner
                    ? "Race records, performance days, breedings, awards — what the show ring doesn't cover. Attach the chart or the certificate to any of them."
                    : "Race records, performance days, breedings and awards — what the show ring doesn't cover."}
            </p>

            {editing === "new" && form}

            {items.length === 0 && editing === null && (
                <p className="text-secondary-foreground m-0 py-4 text-center text-sm">
                    Nothing here yet. A race with the Express, a breeding granted, a year-end award — add the first.
                </p>
            )}

            <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {items.map((a) => {
                    const attached = papers.filter((p) => p.accomplishmentId === a.id);
                    const line = accomplishmentLine(a);
                    return (
                        <li key={a.id} className="border-input/60 border-b pb-3 last:border-b-0 last:pb-0">
                            {editing === a.id ? (
                                form
                            ) : (
                                <>
                                    <div className="flex flex-wrap items-baseline gap-x-2">
                                        <span aria-hidden="true">{ACCOMPLISHMENT_GLYPHS[a.kind] ?? "📌"}</span>
                                        <span className="font-semibold">{a.title}</span>
                                        <span className="text-secondary-foreground text-xs">{ACCOMPLISHMENT_LABELS[a.kind] ?? "Other"}</span>
                                        {isOwner && !a.isPublic && <span className="text-secondary-foreground text-xs">· 🔒 only you</span>}
                                    </div>
                                    {line && <div className="text-secondary-foreground mt-0.5 text-sm">{line}</div>}
                                    {a.detail && (
                                        <p className="text-secondary-foreground m-0 mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                                            <LinkifiedText text={a.detail} />
                                        </p>
                                    )}
                                    {a.linkUrl && (
                                        <a href={a.linkUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-forest mt-1 inline-block text-xs font-semibold hover:underline" title={a.linkUrl}>
                                            {linkHost(a.linkUrl)} ↗
                                        </a>
                                    )}
                                    <PaperThumbs papers={attached} horseName={horseName} />
                                    {isOwner && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => start(a)} disabled={busy}>
                                                Edit
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => setAttaching(a)} disabled={busy}>
                                                📎 Attach a paper
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => remove(a)} disabled={busy}>
                                                Remove
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </li>
                    );
                })}
            </ul>

            {error && editing === null && (
                <p role="alert" className="text-destructive mt-2 text-sm font-semibold">
                    {error}
                </p>
            )}

            {attaching && (
                <PaperDialog
                    horseId={horseId}
                    horseName={horseName}
                    paper={null}
                    attachTo={{ accomplishmentId: attaching.id, label: attaching.title }}
                    presetKind="award"
                    kinds={ACCOMPLISHMENT_PAPER_KINDS}
                    onClose={() => setAttaching(null)}
                    onSaved={() => {
                        setAttaching(null);
                        router.refresh();
                    }}
                />
            )}
        </section>
    );
}
