import { Lamp } from "lucide-react";
import { formatSupporterSince } from "@/lib/supporter";

/**
 * SupporterPlaque — the small brass plaque shown in the profile masthead for
 * active supporters. Pure recognition: it certifies nothing except that this
 * person helps keep the Hub's lights on. Uses the existing .brass-plaque
 * recipe, which already handles Simple Mode and the Lamplight (night) theme.
 * Rendered by both the member profile page and AnonProfile.
 */
export default function SupporterPlaque({ since }: { since: string | null }) {
    const sinceLabel = formatSupporterSince(since);
    return (
        <div className="mt-3 text-center">
            <span
                className="brass-plaque inline-flex items-center gap-1.5 px-3 py-1 text-[0.68rem] font-bold tracking-[0.16em] uppercase"
                title="Helps keep Model Horse Hub running. Supporter unlocks nothing — the Hub stays free for everyone."
            >
                <Lamp className="h-3 w-3" aria-hidden="true" />
                Supporter
                {sinceLabel && (
                    <span className="font-normal normal-case tracking-normal opacity-80">
                        · since {sinceLabel}
                    </span>
                )}
            </span>
        </div>
    );
}
