/**
 * Message the host (MHH-026): the pieces the page and the action share.
 */

/** Room left for the "About ..." line inside the 2,000-character message cap. */
export const HOST_MESSAGE_MAX = 1700;

export interface HostMessageEntry {
    entryNumber: number | null;
    horseName: string;
    className: string | null;
}

/** The line that opens the message: the show, then the entry if one was picked. */
export function hostMessageHeading(showTitle: string, entry: HostMessageEntry | null): string {
    if (!entry) return `About "${showTitle}":`;
    const number = entry.entryNumber !== null ? `entry #${entry.entryNumber}, ` : "";
    const where = entry.className ? ` in ${entry.className}` : "";
    return `About "${showTitle}", ${number}${entry.horseName}${where}:`;
}
