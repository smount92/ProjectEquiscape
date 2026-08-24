"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setGroupBanner, uploadGroupBanner } from "@/app/actions/groups";
import { useToast } from "@/lib/context/ToastContext";

/**
 * BarnBannerControl — owner/admin control to set, change or remove a
 * barn's banner after creation. The create form covers new barns; this
 * is the retroactive path for the ones that existed before banners did.
 */
export default function BarnBannerControl({
    groupId,
    hasBanner,
}: {
    groupId: string;
    hasBanner: boolean;
}) {
    const router = useRouter();
    const { toast } = useToast();
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [, startTransition] = useTransition();

    const handleFile = async (file: File) => {
        setBusy(true);
        const fd = new FormData();
        fd.set("banner", file);
        const up = await uploadGroupBanner(fd);
        if (!up.success || !up.path) {
            toast(up.error ?? "Could not upload that image.", "error");
            setBusy(false);
            return;
        }
        const set = await setGroupBanner(groupId, up.path);
        setBusy(false);
        if (set.success) {
            toast("🖼️ Banner updated.", "success");
            startTransition(() => router.refresh());
        } else {
            toast(set.error ?? "Could not set the banner.", "error");
        }
    };

    const handleRemove = async () => {
        setBusy(true);
        const set = await setGroupBanner(groupId, null);
        setBusy(false);
        if (set.success) {
            toast("Banner removed.", "success");
            startTransition(() => router.refresh());
        } else {
            toast(set.error ?? "Could not remove the banner.", "error");
        }
    };

    return (
        <span className="inline-flex items-center gap-3 text-xs">
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = "";
                }}
            />
            <button
                type="button"
                className="text-muted-foreground hover:text-foreground underline disabled:opacity-50"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
            >
                {busy ? "Working…" : hasBanner ? "🖼️ Change banner" : "🖼️ Add a banner"}
            </button>
            {hasBanner && !busy && (
                <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground underline"
                    onClick={() => void handleRemove()}
                >
                    Remove
                </button>
            )}
        </span>
    );
}
