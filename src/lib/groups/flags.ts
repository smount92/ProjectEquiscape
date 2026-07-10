/**
 * Groups forum feature flag. The "Notice Board" group rebuild ships
 * dark: set NEXT_PUBLIC_GROUPS_FORUM=1 to enable. Default OFF —
 * with the flag off, groups render today's flat-feed UI untouched.
 */
export function groupsForumEnabled(): boolean {
    return process.env.NEXT_PUBLIC_GROUPS_FORUM === "1";
}
