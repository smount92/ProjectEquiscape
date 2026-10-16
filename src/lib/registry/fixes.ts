// PLACEHOLDER for Package A/C: replaced at merge
/* eslint-disable @typescript-eslint/no-unused-vars -- placeholder signatures; the real module uses its arguments */
/**
 * Suggested fixes from the moderators' style rules (Package C builds them;
 * names from docs/design/registry-desk-phase1-plan.md §2). This stand-in
 * suggests nothing until Package C's file replaces it.
 */
import type { CheckRow, FlagKey } from "@/lib/registry/checks";

export interface RuleInEffect {
    id: string;
    title: string;
    check_key: string | null;
    params: Record<string, unknown> | null;
}

export interface SuggestedFix {
    ruleId: string;
    ruleTitle: string;
    flag: FlagKey;
    /** Field key → the value the rule would give it. */
    changes: Record<string, string>;
}

export function suggestedFixes(_row: CheckRow, _flags: FlagKey[], _rulesInEffect: RuleInEffect[]): SuggestedFix[] {
    return [];
}
