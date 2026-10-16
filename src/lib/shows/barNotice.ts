/**
 * What an entrant is told when a host bars them from a show, with or
 * without taking their entries out (barEntrant's scratch sweep and
 * removeEntrantFromShow). One wording for both tools, and it always says
 * which show: a member in three shows can't act on "this show".
 *
 * Deliberately reason-free: the host's reason is bookkeeping on the bar
 * row, never written to be read by the person it is about.
 */
export function barNoticeText(showTitle: string | null | undefined, entriesTaken: number): string {
    const title = showTitle?.trim();
    const host = title ? `The host of "${title}"` : "The host of this show";
    if (entriesTaken > 0) {
        return `${host} has removed your ${entriesTaken === 1 ? "entry" : "entries"}, and you can't re-enter this show. You can message the host about it.`;
    }
    return `${host} has asked that you not enter this show. You can message the host about it.`;
}
