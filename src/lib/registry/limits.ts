import "server-only";

import { checkRateLimit } from "@/lib/utils/rateLimit";
import { alertOwner } from "@/lib/registry/alerts";
import type { RegistryActor } from "@/lib/registry/types";

/**
 * Daily limits per Registry moderator (owner answer 6, 2026-10-16).
 * Approvals count as edits. The owner is exempt; members and curators
 * are held by the suggestion queue, not by these.
 */
export const REGISTRY_LIMITS = {
    edit: 300,
    merge: 20,
    remove: 50,
    rule: 10,
} as const;
export type RegistryLimitKind = keyof typeof REGISTRY_LIMITS;

/** More actions than this in one hour alerts the owner (once an hour). */
export const SPEED_ALARM_PER_HOUR = 100;

const DAY_MINUTES = 1440;

const LIMIT_WORDS: Record<RegistryLimitKind, string> = {
    edit: "edits and approvals",
    merge: "merge requests",
    remove: "removals",
    rule: "rule proposals",
};

/** The identifier every Registry limit counts under. */
function idFor(actor: RegistryActor): string {
    return `registry:${actor.userId}`;
}

/**
 * May this actor do one more of `kind` today? Counts the attempt. A
 * moderator over the limit is refused in words and the owner is told
 * (once a day per kind). `checkRateLimit` fails open on a database
 * error; the speed alarm is the backstop (plan, Risks).
 */
export async function checkRegistryLimit(
    actor: RegistryActor,
    kind: RegistryLimitKind,
): Promise<{ ok: true } | { ok: false; error: string }> {
    if (actor.role !== "moderator") return { ok: true };
    const max = REGISTRY_LIMITS[kind];
    const allowed = await checkRateLimit(`registry_${kind}`, max, DAY_MINUTES, idFor(actor));
    if (allowed) return { ok: true };
    // Tell the owner once a day per kind, not on every refused click.
    if (await checkRateLimit(`registry_${kind}_alarm`, 1, DAY_MINUTES, idFor(actor))) {
        await alertOwner(
            "limit_hit",
            `Registry limit reached: @${actor.alias} has made ${max} ${LIMIT_WORDS[kind]} today and was stopped.`,
            "/catalog/desk/history",
        );
    }
    return {
        ok: false,
        error: `You have reached today's limit of ${max} ${LIMIT_WORDS[kind]}. It resets within a day; the owner has been told.`,
    };
}

/**
 * Count one action toward the speed alarm. Never refuses: over
 * SPEED_ALARM_PER_HOUR actions in an hour tells the owner, once an hour.
 */
export async function noteRegistryAction(actor: RegistryActor): Promise<void> {
    if (actor.role !== "moderator") return;
    const underAlarm = await checkRateLimit("registry_speed", SPEED_ALARM_PER_HOUR, 60, idFor(actor));
    if (underAlarm) return;
    if (await checkRateLimit("registry_speed_alarm", 1, 60, idFor(actor))) {
        await alertOwner(
            "speed",
            `Speed alarm: @${actor.alias} made more than ${SPEED_ALARM_PER_HOUR} Registry changes in the last hour.`,
            "/catalog/desk/history",
        );
    }
}
