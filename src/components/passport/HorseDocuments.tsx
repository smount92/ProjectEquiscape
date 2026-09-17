"use client";

/**
 * Documentation on the passport — the horse's "papers".
 *
 * Lives in the LEFT column under The Making: what she looks like,
 * how she came to be, then what backs her up (breed standard notes,
 * registry pages, photos of the real horse). Public readers get the
 * folds; the owner also gets add / edit / delete right here, using
 * the same horse_documents the entry dialog offers for reuse.
 *
 * Reference links are the point — bodies render through
 * LinkifiedText so a judge (or a buyer) can click straight through.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
    createHorseDocument,
    deleteHorseDocument,
    updateHorseDocument,
} from "@/app/actions/shows-v4";
import LinkifiedText from "@/components/LinkifiedText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    DOC_KINDS,
    DOC_KIND_LABELS,
    MAX_DOC_BODY,
    MAX_DOC_TITLE,
    type DocKind,
    type HorseDocumentView,
} from "@/lib/shows/documents";

interface HorseDocumentsProps {
    horseId: string;
    documents: HorseDocumentView[];
    /** Owner-viewer: add / edit / delete. */
    isOwner?: boolean;
}

function asKind(kind: string): DocKind {
    return DOC_KINDS.some((k) => k.value === kind) ? (kind as DocKind) : "other";
}

export default function HorseDocuments({
    horseId,
    documents,
    isOwner = false,
}: HorseDocumentsProps) {
    const router = useRouter();
    /** null = reading; "new" = composing; otherwise the id being edited. */
    const [editing, setEditing] = useState<string | null>(null);
    const [kind, setKind] = useState<DocKind>("breed");
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Nothing to read and nobody who can write — no empty chrome.
    if (documents.length === 0 && !isOwner) return null;

    const startNew = () => {
        setEditing("new");
        setKind("breed");
        setTitle("");
        setBody("");
        setError(null);
    };
    const startEdit = (d: HorseDocumentView) => {
        setEditing(d.id);
        setKind(asKind(d.kind));
        setTitle(d.title);
        setBody(d.bodyMd);
        setError(null);
    };
    const cancel = () => {
        setEditing(null);
        setError(null);
    };

    const save = async () => {
        if (busy || editing === null) return;
        const t = title.trim();
        const b = body.trim();
        if (!t || !b) {
            setError("Give it a title and a body.");
            return;
        }
        setBusy(true);
        setError(null);
        const result =
            editing === "new"
                ? await createHorseDocument({ horseId, kind, title: t, bodyMd: b })
                : await updateHorseDocument({ documentId: editing, kind, title: t, bodyMd: b });
        setBusy(false);
        if (!result.success) {
            setError(result.error);
            return;
        }
        setEditing(null);
        router.refresh();
    };

    const remove = async (d: HorseDocumentView) => {
        if (busy) return;
        // ON DELETE SET NULL (148): an entry that used it loses its card.
        if (
            !window.confirm(
                `Delete "${d.title}"? Any show entry using it loses its documentation.`,
            )
        ) {
            return;
        }
        setBusy(true);
        setError(null);
        const result = await deleteHorseDocument({ documentId: d.id });
        setBusy(false);
        if (!result.success) {
            setError(result.error);
            return;
        }
        router.refresh();
    };

    const form = (
        <div
            className="border-input mt-2 flex flex-col gap-2 rounded-md border px-3 py-3"
            data-testid="document-form"
        >
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Documentation kind">
                {DOC_KINDS.map((k) => (
                    <button
                        key={k.value}
                        type="button"
                        role="radio"
                        aria-checked={kind === k.value}
                        onClick={() => setKind(k.value)}
                        className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs ${
                            kind === k.value
                                ? "border-forest bg-forest/10 text-forest font-semibold"
                                : "border-input text-muted-foreground"
                        }`}
                    >
                        {k.label}
                    </button>
                ))}
            </div>
            <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title — e.g. Breed standard and references"
                maxLength={MAX_DOC_TITLE}
                aria-label="Documentation title"
                className="h-9"
            />
            <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX_DOC_BODY))}
                placeholder="What should a judge know? Breed standard notes, registry pages, photos of the real horse — paste links (https://…) and they're clickable."
                rows={5}
                maxLength={MAX_DOC_BODY}
                aria-label="Documentation body"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs">
                    {body.length}/{MAX_DOC_BODY}
                </span>
                <span className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={save} disabled={busy}>
                        {busy ? "Saving…" : "Save"}
                    </Button>
                </span>
            </div>
            {error && (
                <p role="alert" className="m-0 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}
        </div>
    );

    return (
        <section
            className="border-input bg-card mt-6 rounded-2xl border px-5 py-4"
            aria-labelledby="passport-documents-heading"
            id="passport-documents"
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="passport-documents-heading" className="m-0 text-base font-semibold">
                    📎 Documentation
                </h2>
                {isOwner && editing === null && (
                    <Button variant="outline" size="sm" onClick={startNew}>
                        + Add documentation
                    </Button>
                )}
            </div>
            <p className="text-muted-foreground m-0 mt-1 text-xs">
                {isOwner
                    ? "Breed notes and reference links a judge can check. Attach one when you enter a class — it's offered right in the entry form."
                    : "Breed notes and reference links behind this horse."}
            </p>

            {documents.length === 0 && isOwner && editing === null && (
                <p className="text-muted-foreground m-0 mt-3 text-sm">
                    No documentation yet — breed standard notes, a registry page, photos of
                    the real horse.
                </p>
            )}

            <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                {documents.map((d) => (
                    <li key={d.id}>
                        {editing === d.id ? (
                            form
                        ) : (
                            <details className="border-input rounded-md border px-3 py-2">
                                <summary className="cursor-pointer text-sm font-medium">
                                    {DOC_KIND_LABELS[d.kind] ?? "Documentation"}: {d.title}
                                </summary>
                                <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
                                    <LinkifiedText text={d.bodyMd} />
                                </p>
                                {isOwner && editing === null && (
                                    <div className="mt-2 flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => startEdit(d)}
                                            disabled={busy}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => void remove(d)}
                                            disabled={busy}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                )}
                            </details>
                        )}
                    </li>
                ))}
            </ul>

            {editing === "new" && form}
            {error && editing === null && (
                <p role="alert" className="m-0 mt-2 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}
        </section>
    );
}
