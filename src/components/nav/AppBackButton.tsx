"use client";
/**
 * The installed app's Back. A browser tab has its own; an app window
 * (display-mode: standalone) has none, so this appears there — and only
 * when the trail says there is somewhere to go back to.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { TRAIL_EVENT } from "@/lib/nav/trail";
import { readTrail } from "@/components/nav/NavTrail";

export default function AppBackButton() {
    const router = useRouter();
    const [show, setShow] = useState(false);

    useEffect(() => {
        const standalone = () =>
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
        const sync = () => setShow(standalone() && readTrail().length > 1);
        sync();
        window.addEventListener(TRAIL_EVENT, sync);
        const mq = window.matchMedia("(display-mode: standalone)");
        mq.addEventListener?.("change", sync);
        return () => {
            window.removeEventListener(TRAIL_EVENT, sync);
            mq.removeEventListener?.("change", sync);
        };
    }, []);

    if (!show) return null;
    return (
        <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            title="Back"
            id="app-back"
            className="leather-icon-btn mr-2 flex h-[36px] w-[36px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-input bg-transparent text-muted-foreground transition-all"
        >
            <ChevronLeft size={18} strokeWidth={2} />
        </button>
    );
}
