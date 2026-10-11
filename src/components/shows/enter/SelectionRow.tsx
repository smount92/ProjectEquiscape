"use client";

/**
 * One selected horse in the selection panel: thumb + name, the
 * identity nudge (breed / sex missing — a note, never a block), and
 * two optional folds ported from the old entry dialog:
 *   - Handler: "someone else will show this horse" (findUserByAlias).
 *   - Documentation: reuse one of the horse's write-ups, or write a
 *     new one (kind + body, MAX_DOC_BODY). Attached after the entry
 *     lands — it can never cost the entry.
 */

import { useState } from "react";
import Link from "next/link";

import { findUserByAlias } from "@/app/actions/shows-v2";
import { DOC_KINDS, MAX_DOC_BODY, type DocKind } from "@/lib/shows/documents";
import type { EntrantHorse } from "@/lib/shows/public";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DocChoice, SelectedHorse } from "./shared";

interface ExistingDoc {
    id: string;
    title: string;
}

interface SelectionRowProps {
    horse: EntrantHorse;
    sel: SelectedHorse;
    /** Online shows: the judged photo's URL, or null when none is chosen yet. */
    photoUrl: string | null;
    online: boolean;
    /** Server verdict for this horse from the last press (failed horses stay selected). */
    error?: string | null;
    onChange: (patch: Partial<SelectedHorse>) => void;
    onRemove: () => void;
    onChangePhoto: () => void;
}

export default function SelectionRow({
    horse,
    sel,
    photoUrl,
    online,
    error,
    onChange,
    onRemove,
    onChangePhoto,
}: SelectionRowProps) {
    const [handlerQuery, setHandlerQuery] = useState("");
    const [handlerNote, setHandlerNote] = useState<string | null>(null);
    const [lookingUp, setLookingUp] = useState(false);
    const [docs, setDocs] = useState<ExistingDoc[] | null>(null);

    const thumb = photoUrl ?? horse.thumbnailUrl;
    const missing = [horse.gender ? null : "sex", horse.breed ? null : "breed"].filter(
        (x): x is string => x !== null,
    );

    const lookup = async () => {
        setLookingUp(true);
        setHandlerNote(null);
        const result = await findUserByAlias({ alias: handlerQuery });
        setLookingUp(false);
        if (!result.success) return setHandlerNote(result.error);
        if (!result.user) return setHandlerNote("No user found with that alias.");
        onChange({ handler: result.user });
    };

    /** This horse's existing write-ups (owner RLS), read once when the fold opens. */
    const loadDocs = () => {
        if (docs !== null) return;
        setDocs([]);
        const supabase = createClient();
        supabase
            .from("horse_documents")
            .select("id, kind, title")
            .eq("horse_id", horse.id)
            .order("created_at")
            .then(({ data }) => {
                const rows = (data ?? []) as { id: string; title: unknown }[];
                setDocs(rows.filter((r) => typeof r.title === "string").map((r) => ({ id: r.id, title: r.title as string })));
            });
    };

    const setDoc = (doc: DocChoice) => onChange({ doc });
    const docKind: DocKind = sel.doc.mode === "new" ? sel.doc.kind : "breed";
    const docBody = sel.doc.mode === "new" ? sel.doc.body : "";

    return (
        <li className="flex flex-col gap-1.5 border-b border-input py-2 last:border-b-0" data-testid={`selected-${horse.id}`}>
            <div className="flex items-center gap-2">
                {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted" aria-hidden="true">
                        🐴
                    </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{horse.name}</span>
                <Button variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove ${horse.name}`}>
                    ✕
                </Button>
            </div>
            {online && !sel.photoId && (
                <p className="m-0 text-xs font-semibold text-destructive">
                    Needs a photo —{" "}
                    <button type="button" className="cursor-pointer underline" onClick={onChangePhoto}>
                        pick or upload one
                    </button>
                </p>
            )}
            {missing.length > 0 && (
                <p className="m-0 text-xs text-muted-foreground">
                    No {missing.join(" or ")} set — judges read it on every entry.{" "}
                    <Link href={`/stable/${horse.id}`} target="_blank" className="underline">
                        Add it
                    </Link>{" "}
                    and the entry picks it up.
                </p>
            )}
            {error && (
                <p role="alert" className="m-0 text-xs font-semibold text-destructive">
                    ✗ {error}
                </p>
            )}

            <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                    {sel.handler ? `@${sel.handler.alias} will show this horse` : "Someone else will show this horse"}
                </summary>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {sel.handler ? (
                        <Button variant="ghost" size="sm" onClick={() => onChange({ handler: null })}>
                            Remove handler
                        </Button>
                    ) : (
                        <>
                            <Input
                                value={handlerQuery}
                                onChange={(e) => setHandlerQuery(e.target.value)}
                                placeholder="Their alias"
                                className="h-8 w-40 max-w-full"
                                maxLength={60}
                                aria-label={`Handler alias for ${horse.name}`}
                            />
                            <Button variant="outline" size="sm" disabled={lookingUp || !handlerQuery.trim()} onClick={lookup}>
                                {lookingUp ? "Looking up…" : "Look up"}
                            </Button>
                        </>
                    )}
                </div>
                {handlerNote && <p className="m-0 mt-1 text-muted-foreground">{handlerNote}</p>}
            </details>

            <details className="text-xs" onToggle={(e) => (e.currentTarget.open ? loadDocs() : undefined)}>
                <summary className="cursor-pointer text-muted-foreground">
                    {sel.doc.mode === "none" ? "Add documentation for the judge" : "Documentation ✓"}
                </summary>
                <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label={`Documentation for ${horse.name}`}>
                    <Button
                        variant={sel.doc.mode === "none" ? "default" : "outline"}
                        size="sm"
                        aria-pressed={sel.doc.mode === "none"}
                        onClick={() => setDoc({ mode: "none" })}
                    >
                        None
                    </Button>
                    {(docs ?? []).map((d) => {
                        const on = sel.doc.mode === "existing" && sel.doc.documentId === d.id;
                        return (
                            <Button
                                key={d.id}
                                variant={on ? "default" : "outline"}
                                size="sm"
                                aria-pressed={on}
                                title={d.title}
                                onClick={() => setDoc({ mode: "existing", documentId: d.id })}
                            >
                                📎 {d.title}
                            </Button>
                        );
                    })}
                    <Button
                        variant={sel.doc.mode === "new" ? "default" : "outline"}
                        size="sm"
                        aria-pressed={sel.doc.mode === "new"}
                        onClick={() => setDoc({ mode: "new", kind: docKind, body: docBody })}
                    >
                        + Write new
                    </Button>
                </div>
                {sel.doc.mode === "new" && (
                    <div className="mt-1.5 flex flex-col gap-1.5">
                        <select
                            value={docKind}
                            onChange={(e) => setDoc({ mode: "new", kind: e.target.value as DocKind, body: docBody })}
                            className="h-8 rounded-md border border-input bg-card px-2 text-xs"
                            aria-label={`Documentation kind for ${horse.name}`}
                        >
                            {DOC_KINDS.map((k) => (
                                <option key={k.value} value={k.value}>
                                    {k.label}
                                </option>
                            ))}
                        </select>
                        <Textarea
                            value={docBody}
                            onChange={(e) =>
                                setDoc({ mode: "new", kind: docKind, body: e.target.value.slice(0, MAX_DOC_BODY) })
                            }
                            placeholder="Breed standard notes, registry pages, reference links (https://…)."
                            rows={3}
                            maxLength={MAX_DOC_BODY}
                            aria-label={`Documentation for ${horse.name}`}
                        />
                        <p className="m-0 text-muted-foreground">
                            {docBody.length}/{MAX_DOC_BODY} · Saved to this horse&rsquo;s passport for the next class too.
                        </p>
                    </div>
                )}
            </details>
        </li>
    );
}
