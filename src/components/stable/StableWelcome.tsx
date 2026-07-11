/**
 * StableWelcome — the shared 0-horse onboarding card, used by both the
 * v1 dashboard and the flag-gated Digital Stable v2 (StableBrowser).
 * House materials only: ledger-paper surface + brass heading + token
 * washes (bg-success/10), so it renders correctly in day, Lamplight
 * night mode, and Simple Mode by construction — no light-only literals.
 */

import Link from "next/link";
import { Camera, Trophy, Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
    { icon: Camera, label: "Add your first horse with photos" },
    { icon: Trophy, label: "Make it public for the Show Ring" },
    { icon: Users, label: "Discover and follow other collectors" },
] as const;

export default function StableWelcome({ className = "" }: { className?: string }) {
    return (
        <div
            className={`ledger-paper animate-fade-in-up px-8 py-14 text-center ${className}`.trim()}
            data-testid="stable-welcome"
        >
            <div className="brass-heading mb-3 justify-center">
                <span className="brass-heading-bar" aria-hidden="true" />
                <h2 className="m-0">Welcome to Model Horse Hub!</h2>
                <span className="brass-heading-bar" aria-hidden="true" />
            </div>
            <p className="mb-8 text-secondary-foreground">
                Let&apos;s get started by adding your first model to your digital stable.
            </p>
            <ol className="mx-auto mb-10 flex max-w-[360px] list-none flex-col gap-4 p-0 text-left">
                {STEPS.map(({ icon: Icon, label }, i) => (
                    <li key={label} className="flex items-center gap-4 text-base">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-success/30 bg-success/10 text-sm font-bold text-success">
                            {i + 1}
                        </span>
                        <span className="flex items-center gap-2 text-foreground">
                            <Icon size={16} strokeWidth={1.5} aria-hidden="true" /> {label}
                        </span>
                    </li>
                ))}
            </ol>
            <Button asChild className="btn-brass">
                <Link href="/add-horse" id="add-first-horse">
                    <Plus size={18} strokeWidth={1.5} /> Add Your First Horse
                </Link>
            </Button>
        </div>
    );
}
