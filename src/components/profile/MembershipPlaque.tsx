import { Heart } from "lucide-react";

/**
 * MembershipPlaque — the opt-in chip for Pro/Studio members, rendered in
 * the profile masthead beside the SupporterPlaque.
 *
 * DELIBERATE CHOICES, decided with the owner 2026-08-23:
 *   * Opt-in, default off. Paid status is billing information; the
 *     Supporter plaque shows unconditionally only because with Supporter
 *     the recognition IS the product. Pro buys features, so display is
 *     the member's choice.
 *   * One label for both tiers. "Supporting member" says this person
 *     helps keep the site running — it does not say how much they spend,
 *     and it never will.
 *   * Visually the same brass-plaque family as Supporter, NOT the medal
 *     family: curator medals are earned trust, and a paid chip must never
 *     read as the same kind of thing.
 */
export default function MembershipPlaque() {
    return (
        <div className="mt-3 text-center">
            <span
                className="brass-plaque inline-flex items-center gap-1.5 px-3 py-1 text-[0.68rem] font-bold tracking-[0.16em] uppercase"
                title="A paying member of Model Horse Hub. Membership never buys standing — corrections, condition grades and show results work the same for everyone."
            >
                <Heart className="h-3 w-3" aria-hidden="true" />
                Supporting Member
            </span>
        </div>
    );
}
