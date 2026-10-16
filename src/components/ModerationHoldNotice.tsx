import Link from "next/link";

import { MODERATION_HOLD_CONTACT_URL, MODERATION_HOLD_MESSAGE } from "@/lib/moderation/horseHold";

/**
 * "This horse was made private by a moderator", with the way to ask about
 * it. Shown on the edit form of a held horse (migration 235), and in place
 * of the save error when the owner tries to make it public or list it.
 */
export default function ModerationHoldNotice({ role = "status" }: { role?: "status" | "alert" }) {
    return (
        <div
            role={role}
            className="mb-4 rounded-md border border-[color:var(--ink-warning)]/40 bg-[color:var(--ink-warning)]/10 px-4 py-2.5 text-sm text-foreground"
        >
            {MODERATION_HOLD_MESSAGE.replace(/ Contact us to ask about it\.$/, "")}{" "}
            <Link href={MODERATION_HOLD_CONTACT_URL} className="font-semibold text-forest underline underline-offset-2">
                Contact us to ask about it.
            </Link>
        </div>
    );
}
