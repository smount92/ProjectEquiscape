/**
 * Registry style rules: when a proposed rule takes effect.
 *
 * Owner rulings 2026-10-16 (docs/DECISIONS.md, and answer 2 in
 * docs/design/registry-desk-phase1-plan.md): moderators write the house
 * style. One proposes, the others agree; at AGREEMENTS_NEEDED agreements
 * the rule takes effect. The proposer's own agreement doesn't count; the
 * owner's does, like any moderator's. The owner can veto at any time, even
 * after the rule is in effect, and can retire a rule that has served its
 * purpose. A proposer can withdraw their rule while it is still proposed.
 *
 * Pure, so the action and the tests read one rule.
 */

export const AGREEMENTS_NEEDED = 3;

export type RuleStatus = "proposed" | "in_effect" | "vetoed" | "withdrawn" | "retired";
export type RuleVote = "agree" | "disagree";

export interface RuleForVote {
    status: RuleStatus;
    proposed_by: string | null;
}

export interface VoteRow {
    voter_id: string;
    vote: RuleVote;
}

/**
 * Whose votes count today: moderators whose seat is active and whose term
 * has not run out, and the owner, whose vote always counts. A moderator
 * removed, resting, stepped down or out of term keeps their vote on the
 * record, but it no longer counts toward the agreements. Omitted: every
 * vote counts (as before seats could end).
 */
export interface CountableVoters {
    active: ReadonlySet<string>;
    owners: ReadonlySet<string>;
}

function counts(voterId: string, voters: CountableVoters | undefined): boolean {
    if (!voters) return true;
    return voters.owners.has(voterId) || voters.active.has(voterId);
}

/** Agreements that count: one per moderator still in their seat (or the owner), never the proposer's. */
export function agreementCount(rule: RuleForVote, votes: VoteRow[], voters?: CountableVoters): number {
    const agreed = new Set(
        votes
            .filter((v) => v.vote === "agree" && v.voter_id !== rule.proposed_by && counts(v.voter_id, voters))
            .map((v) => v.voter_id),
    );
    return agreed.size;
}

/**
 * The rule's status once `votes` are counted. Only a proposed rule moves
 * (to in effect, at AGREEMENTS_NEEDED); a rule already in effect stays in
 * effect if someone takes their agreement back, and a vetoed, withdrawn or
 * retired rule never comes back by vote.
 */
export function ruleStatusAfterVote(rule: RuleForVote, votes: VoteRow[], voters?: CountableVoters): RuleStatus {
    if (rule.status !== "proposed") return rule.status;
    return agreementCount(rule, votes, voters) >= AGREEMENTS_NEEDED ? "in_effect" : "proposed";
}

/** Can this person vote on the rule? Not on their own, and only while it is proposed. */
export function voteProblem(rule: RuleForVote, voterId: string): string | null {
    if (rule.proposed_by === voterId) return "You proposed this rule, so your agreement doesn't count. Ask the others.";
    if (rule.status !== "proposed") return "Voting has closed on this rule.";
    return null;
}

/** The owner may veto a rule at any time unless it is already vetoed, withdrawn or retired. */
export function canVeto(status: RuleStatus): boolean {
    return status === "proposed" || status === "in_effect";
}

/** The owner retires a rule that is in effect. */
export function canRetire(status: RuleStatus): boolean {
    return status === "in_effect";
}

/** The proposer withdraws a rule while it is still proposed. */
export function canWithdraw(rule: RuleForVote, userId: string): boolean {
    return rule.status === "proposed" && rule.proposed_by === userId;
}

/** The status in words, for the Rules tab. */
export function ruleStatusLabel(status: RuleStatus, agreements: number): string {
    switch (status) {
        case "proposed":
            return `${agreements} of ${AGREEMENTS_NEEDED} moderators agree`;
        case "in_effect":
            return "In effect";
        case "vetoed":
            return "Vetoed by the site owner";
        case "withdrawn":
            return "Withdrawn";
        case "retired":
            return "Retired";
    }
}
