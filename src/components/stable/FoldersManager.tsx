"use client";
/**
 * Folders — one place to see, name, share and delete them.
 *
 * Folders could be made from three forms and managed only from a button
 * on each folder's own page; nobody could find "delete" (member,
 * 2026-10-01). This is the list: every folder with its count, its
 * public/private switch, rename in place, and delete. Horses are never
 * deleted with a folder — they just come out of it.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCollectionAction, deleteCollectionAction, updateCollectionAction } from "@/app/actions/collections";
import { formatMoney } from "@/lib/money/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface FolderRow {
    id: string;
    name: string;
    isPublic: boolean;
    count: number;
    value: number;
}

export default function FoldersManager({ folders, currencySymbol = "$" }: { folders: FolderRow[]; currencySymbol?: string }) {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [renaming, setRenaming] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const [newName, setNewName] = useState("");
    const [newPublic, setNewPublic] = useState(false);

    const run = async (key: string, action: () => Promise<{ success: boolean; error?: string }>) => {
        setBusy(key);
        setError(null);
        const result = await action();
        setBusy(null);
        if (!result.success) setError(result.error ?? "Something went wrong.");
        else router.refresh();
        return result.success;
    };

    return (
        <div className="flex flex-col gap-6">
            {error && (
                <p role="alert" className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                    {error}
                </p>
            )}

            <section className="ledger-card" aria-labelledby="folders-heading">
                <span className="ledger-tab" id="folders-heading">Your folders</span>
                {folders.length === 0 ? (
                    <p className="m-0 text-sm text-muted-foreground">
                        No folders yet. Make one below, then add horses to it from a horse&apos;s edit page or by
                        selecting several in your stable.
                    </p>
                ) : (
                    <ul className="m-0 flex list-none flex-col divide-y divide-input p-0">
                        {folders.map((f) => (
                            <li key={f.id} className="flex flex-wrap items-center gap-3 py-3" data-testid={`folder-${f.id}`}>
                                <div className="min-w-[12rem] flex-1">
                                    {renaming === f.id ? (
                                        <form
                                            className="flex items-center gap-2"
                                            onSubmit={async (e) => {
                                                e.preventDefault();
                                                if (!draft.trim()) return;
                                                if (await run(`rename-${f.id}`, () => updateCollectionAction(f.id, { name: draft.trim() }))) setRenaming(null);
                                            }}
                                        >
                                            <Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} autoFocus aria-label={`New name for ${f.name}`} />
                                            <Button type="submit" size="sm" disabled={busy !== null}>Save</Button>
                                            <Button type="button" size="sm" variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
                                        </form>
                                    ) : (
                                        <>
                                            <Link href={`/stable/collection/${f.id}`} className="font-semibold text-foreground no-underline hover:underline">
                                                📁 {f.name}
                                            </Link>
                                            <div className="text-xs text-muted-foreground">
                                                {f.count} horse{f.count === 1 ? "" : "s"}
                                                {f.value > 0 ? ` · ${formatMoney(f.value, currencySymbol)}` : ""}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={f.isPublic}
                                        disabled={busy !== null}
                                        onChange={(e) => void run(`public-${f.id}`, () => updateCollectionAction(f.id, { isPublic: e.target.checked }))}
                                        className="size-5 accent-forest"
                                        aria-label={`Show ${f.name} on my public profile`}
                                    />
                                    On my profile
                                </label>
                                {renaming !== f.id && (
                                    <div className="flex gap-2">
                                        <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => { setRenaming(f.id); setDraft(f.name); }}>
                                            Rename
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={busy !== null}
                                            className="text-destructive"
                                            onClick={() => {
                                                if (!window.confirm(`Delete the folder "${f.name}"? Its ${f.count} horse${f.count === 1 ? "" : "s"} stay in your stable; they only come out of the folder.`)) return;
                                                void run(`delete-${f.id}`, () => deleteCollectionAction(f.id));
                                            }}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="ledger-card" aria-labelledby="new-folder-heading">
                <span className="ledger-tab" id="new-folder-heading">New folder</span>
                <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        if (!newName.trim()) return;
                        if (await run("create", () => createCollectionAction(newName.trim(), null, newPublic))) {
                            setNewName("");
                            setNewPublic(false);
                        }
                    }}
                >
                    <label className="flex min-w-[14rem] flex-1 flex-col gap-1.5 text-sm font-semibold">
                        Name
                        <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} placeholder="Live show string" id="new-folder-name" />
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
                        <input type="checkbox" checked={newPublic} onChange={(e) => setNewPublic(e.target.checked)} className="size-5 accent-forest" />
                        Show on my profile
                    </label>
                    <Button type="submit" disabled={busy !== null || !newName.trim()} id="new-folder-create">
                        Create folder
                    </Button>
                </form>
            </section>
        </div>
    );
}
