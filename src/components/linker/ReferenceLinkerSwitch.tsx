"use client";

/**
 * The member's choice between the old picker and the new linker on the
 * Reference step. Opt-in: the old picker is the default until a member
 * taps "Try the new linker"; "Return to the old linker" takes them back.
 * The choice is remembered per browser, and `?linker=new` in the URL
 * pre-selects it so a trial link can land members on the new one.
 */

import { useEffect } from "react";
import UnifiedReferenceSearch from "@/components/UnifiedReferenceSearch";
import ReferenceLinker from "@/components/linker/ReferenceLinker";
import { LINKER_PREF_KEY, type LinkerPref } from "@/lib/linker/model";
import { track } from "@/lib/analytics";
import { useLocalPref, writePref } from "@/lib/linker/prefs";
import type { CatalogItem } from "@/app/actions/reference";

interface Props {
    selectedCatalogId: string | null;
    onCatalogSelect: (catalogId: string | null, item: CatalogItem | null) => void;
    onCustomEntry?: (searchTerm: string) => void;
    externalSearchQuery?: string;
    aiNotice?: React.ReactNode;
    finishType?: string | null;
}

export default function ReferenceLinkerSwitch(props: Props) {
    const [stored, setStored] = useLocalPref(LINKER_PREF_KEY, "old");
    const pref: LinkerPref = stored === "new" ? "new" : "old";

    // A trial link (?linker=new) pre-selects the new one; it writes the
    // preference, so the external store is what re-renders, not an effect.
    useEffect(() => {
        const fromUrl = new URLSearchParams(window.location.search).get("linker");
        if (fromUrl === "new" || fromUrl === "old") writePref(LINKER_PREF_KEY, fromUrl);
    }, []);

    const choose = (next: LinkerPref) => {
        setStored(next);
        track("linker_switch", { to: next });
    };

    return (
        <div className="flex flex-col gap-3" data-linker={pref}>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-input px-3 py-2 text-xs text-muted-foreground">
                {pref === "new" ? (
                    <>
                        <span>
                            You&apos;re trying the <strong className="text-foreground">new linker</strong>. It runs on
                            the same Registry; tell us where it hesitates.
                        </span>
                        <button
                            type="button"
                            className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-forest underline"
                            onClick={() => choose("old")}
                            data-testid="linker-return-old"
                        >
                            Return to the old linker
                        </button>
                    </>
                ) : (
                    <>
                        <span>A new way to find your model is ready to try.</span>
                        <button
                            type="button"
                            className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-forest underline"
                            onClick={() => choose("new")}
                            data-testid="linker-try-new"
                        >
                            Try the new linker
                        </button>
                    </>
                )}
            </div>
            {pref === "new" ? (
                <ReferenceLinker
                    selectedCatalogId={props.selectedCatalogId}
                    onCatalogSelect={props.onCatalogSelect}
                    finishType={props.finishType}
                    onCustomEntry={props.onCustomEntry}
                />
            ) : (
                <UnifiedReferenceSearch {...props} />
            )}
        </div>
    );
}
