/**
 * Style rules (Package C; owner answer 2, 2026-10-16): the proposer
 * doesn't count, 3 agreements and the owner's counts, veto any time.
 */
import { describe, expect, it } from "vitest";
import {
    AGREEMENTS_NEEDED,
    agreementCount,
    canRetire,
    canVeto,
    canWithdraw,
    ruleStatusAfterVote,
    ruleStatusLabel,
    voteProblem,
    type RuleStatus,
    type VoteRow,
} from "@/lib/registry/rules";

const proposed = { status: "proposed" as RuleStatus, proposed_by: "maple" };
const agree = (voter_id: string): VoteRow => ({ voter_id, vote: "agree" });

describe("ruleStatusAfterVote", () => {
    it("takes effect at 3 agreements", () => {
        expect(AGREEMENTS_NEEDED).toBe(3);
        expect(ruleStatusAfterVote(proposed, [agree("bay"), agree("ridge")])).toBe("proposed");
        expect(ruleStatusAfterVote(proposed, [agree("bay"), agree("ridge"), agree("fern")])).toBe("in_effect");
    });

    it("the proposer's own agreement doesn't count", () => {
        const votes = [agree("maple"), agree("bay"), agree("ridge")];
        expect(agreementCount(proposed, votes)).toBe(2);
        expect(ruleStatusAfterVote(proposed, votes)).toBe("proposed");
        expect(voteProblem(proposed, "maple")).toMatch(/proposed this rule/);
    });

    it("the owner's agreement counts like any moderator's", () => {
        expect(ruleStatusAfterVote(proposed, [agree("bay"), agree("ridge"), agree("owner")])).toBe("in_effect");
    });

    it("a disagreement is recorded but is not an agreement", () => {
        const votes: VoteRow[] = [agree("bay"), agree("ridge"), { voter_id: "fern", vote: "disagree" }];
        expect(ruleStatusAfterVote(proposed, votes)).toBe("proposed");
    });

    it("never moves a rule that isn't proposed", () => {
        const many = [agree("a"), agree("b"), agree("c"), agree("d")];
        for (const status of ["vetoed", "withdrawn", "retired", "in_effect"] as RuleStatus[])
            expect(ruleStatusAfterVote({ status, proposed_by: "maple" }, many)).toBe(status);
        // Taking an agreement back doesn't undo a rule in effect.
        expect(ruleStatusAfterVote({ status: "in_effect", proposed_by: "maple" }, [agree("a")])).toBe("in_effect");
        expect(voteProblem({ status: "in_effect", proposed_by: "maple" }, "bay")).toMatch(/closed/);
    });
});

describe("veto, retire, withdraw", () => {
    it("the owner can veto at any time while a rule is proposed or in effect", () => {
        expect(canVeto("proposed")).toBe(true);
        expect(canVeto("in_effect")).toBe(true);
        expect(canVeto("vetoed")).toBe(false);
        expect(canVeto("withdrawn")).toBe(false);
        expect(canVeto("retired")).toBe(false);
    });

    it("only a rule in effect can be retired", () => {
        expect(canRetire("in_effect")).toBe(true);
        expect(canRetire("proposed")).toBe(false);
    });

    it("only the proposer withdraws, and only while proposed", () => {
        expect(canWithdraw(proposed, "maple")).toBe(true);
        expect(canWithdraw(proposed, "bay")).toBe(false);
        expect(canWithdraw({ status: "in_effect", proposed_by: "maple" }, "maple")).toBe(false);
    });

    it("says the status in words", () => {
        expect(ruleStatusLabel("proposed", 2)).toBe("2 of 3 moderators agree");
        expect(ruleStatusLabel("in_effect", 3)).toBe("In effect");
    });
});

describe("votes from moderators who are no longer active", () => {
    const voters = { active: new Set(["bay", "ridge"]), owners: new Set(["owner"]) };

    it("don't count toward the agreements; their vote stays on the record", () => {
        const votes = [agree("bay"), agree("ridge"), agree("fern")]; // fern's seat or term has ended
        expect(agreementCount(proposed, votes, voters)).toBe(2);
        expect(ruleStatusAfterVote(proposed, votes, voters)).toBe("proposed");
        // Without the seat list every vote counts, as before seats could end.
        expect(ruleStatusAfterVote(proposed, votes)).toBe("in_effect");
    });

    it("the owner's vote always counts, with no seat", () => {
        const votes = [agree("bay"), agree("ridge"), agree("owner")];
        expect(agreementCount(proposed, votes, voters)).toBe(3);
        expect(ruleStatusAfterVote(proposed, votes, voters)).toBe("in_effect");
    });

    it("the proposer still never counts, even as the owner", () => {
        const own = { status: "proposed" as RuleStatus, proposed_by: "owner" };
        expect(agreementCount(own, [agree("owner"), agree("bay")], voters)).toBe(1);
    });
});
