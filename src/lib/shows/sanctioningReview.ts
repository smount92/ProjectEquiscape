/**
 * Sanctioning review — what the admin looks at before granting.
 *
 * The owner's rule: give the tools, don't make the choice. So these
 * are OBSERVATIONS about a show, not gates — each one says what it
 * saw and lets the admin weigh it. "ok" reads green, "warn" amber,
 * "info" neutral. Pure so the wording is tested once and the page
 * just prints.
 */

import type { ShowJudging, ShowMode, ShowStatus } from "@/lib/shows/types";

export interface SanctioningCheckInput {
    mode: ShowMode;
    judging: ShowJudging;
    status: ShowStatus;
    showDate: string | null;
    entriesOpenAt: string | null;
    entriesCloseAt: string | null;
    judgingEndsAt: string | null;
    aboutMd: string | null;
    rulesMd: string | null;
    divisionCount: number;
    classCount: number;
    qualifyingClassCount: number;
    judgeCount: number;
    /** Shows this host has taken all the way to results on MHH. */
    hostCompletedShows: number;
    hostTotalShows: number;
}

export type CheckLevel = "ok" | "warn" | "info";

export interface SanctioningCheck {
    key: string;
    level: CheckLevel;
    label: string;
    detail: string;
}

function plural(n: number, one: string, many = `${one}s`): string {
    return `${n} ${n === 1 ? one : many}`;
}

export function buildSanctioningChecks(i: SanctioningCheckInput): SanctioningCheck[] {
    const checks: SanctioningCheck[] = [];

    // Judged vs voted — the Series is about a judge's placings.
    checks.push(
        i.judging === "judged"
            ? {
                  key: "judging",
                  level: "ok",
                  label: "Judged show",
                  detail: "Placings come from a judge, which is what Series points and cards are built on.",
              }
            : {
                  key: "judging",
                  level: "warn",
                  label: "Community-vote show",
                  detail: "Placings are votes, not a judge's call. Sanctioning would let voted placings earn Series points.",
              },
    );

    // Dates — a show with no calendar can't score into a season.
    if (i.mode === "live") {
        checks.push(
            i.showDate
                ? {
                      key: "dates",
                      level: "ok",
                      label: "Show date set",
                      detail: `Live show on ${i.showDate}.`,
                  }
                : {
                      key: "dates",
                      level: "warn",
                      label: "No show date",
                      detail: "A live show needs its date before it can score into a season.",
                  },
        );
    } else {
        const haveAll = !!(i.entriesOpenAt && i.entriesCloseAt && i.judgingEndsAt);
        const ordered =
            haveAll &&
            new Date(i.entriesOpenAt!) < new Date(i.entriesCloseAt!) &&
            new Date(i.entriesCloseAt!) <= new Date(i.judgingEndsAt!);
        checks.push(
            haveAll && ordered
                ? {
                      key: "dates",
                      level: "ok",
                      label: "Windows set",
                      detail: "Entries open, entries close and judging ends are all set and in order.",
                  }
                : haveAll
                  ? {
                        key: "dates",
                        level: "warn",
                        label: "Windows out of order",
                        detail: "Entries should open before they close, and judging should end after entries close.",
                    }
                  : {
                        key: "dates",
                        level: "warn",
                        label: "Windows incomplete",
                        detail: "An online show needs entries-open, entries-close and judging-ends before it can run.",
                    },
        );
    }

    // Classlist — what's actually on offer.
    checks.push(
        i.classCount > 0
            ? {
                  key: "classlist",
                  level: "ok",
                  label: `${plural(i.classCount, "class", "classes")} across ${plural(i.divisionCount, "division")}`,
                  detail:
                      i.qualifyingClassCount > 0
                          ? `${plural(i.qualifyingClassCount, "class", "classes")} marked qualifying — those are the ones that would pay points and mint cards.`
                          : "No class is marked qualifying yet — sanctioning the show pays nothing until the host marks some.",
              }
            : {
                  key: "classlist",
                  level: "warn",
                  label: "No classes yet",
                  detail: "The classlist is empty. There is nothing to sanction until the host builds it.",
              },
    );

    // Rules + about — does the show say what it is?
    checks.push(
        i.rulesMd?.trim()
            ? { key: "rules", level: "ok", label: "Rules written", detail: "Read them below." }
            : {
                  key: "rules",
                  level: "warn",
                  label: "No rules written",
                  detail: "Entrants will have nothing to go on. Worth asking the host before granting.",
              },
    );
    checks.push(
        i.aboutMd?.trim()
            ? { key: "about", level: "ok", label: "About written", detail: "Read it below." }
            : { key: "about", level: "info", label: "No about text", detail: "Not required, but a blank show page reads thin." },
    );

    // A judge on staff — judged shows need one eventually; the host
    // may judge their own show, so this is information, not a flag.
    if (i.judging === "judged") {
        checks.push(
            i.judgeCount > 0
                ? { key: "judge", level: "ok", label: plural(i.judgeCount, "judge") + " on staff", detail: "Named in the staff list below." }
                : {
                      key: "judge",
                      level: "info",
                      label: "No judge on staff yet",
                      detail: "The host can judge it themselves or add a judge later.",
                  },
        );
    }

    // Host track record — first-time hosts aren't a problem, just a fact.
    checks.push(
        i.hostCompletedShows > 0
            ? {
                  key: "host",
                  level: "ok",
                  label: `Host has completed ${plural(i.hostCompletedShows, "show")} on MHH`,
                  detail: `${plural(i.hostTotalShows, "show")} created in total.`,
              }
            : {
                  key: "host",
                  level: "info",
                  label: "First show from this host",
                  detail:
                      i.hostTotalShows > 1
                          ? `${plural(i.hostTotalShows, "show")} created, none completed yet.`
                          : "Nothing completed on MHH yet — that's fine, everyone starts somewhere.",
              },
    );

    // Where it is in its life.
    checks.push(
        i.status === "draft"
            ? {
                  key: "status",
                  level: "info",
                  label: "Still a draft",
                  detail: "Not public yet. Granting now is fine — sanctioning takes effect when the host publishes.",
              }
            : {
                  key: "status",
                  level: "info",
                  label: `Status: ${i.status.replace(/_/g, " ")}`,
                  detail: "The public page is live; open it from the header to see it as entrants do.",
              },
    );

    return checks;
}
