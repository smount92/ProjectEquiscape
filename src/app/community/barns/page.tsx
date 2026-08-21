import { redirect } from "next/navigation";

/**
 * /community/barns → /community/groups
 *
 * The room is called a Barn everywhere a member reads; the route
 * still says "groups" because the slugs, notification deep links and
 * shared permalinks in the wild all point there. This alias lets the
 * new name work as a URL too, without breaking a single old link.
 */
export default function BarnsAlias() {
    redirect("/community/groups");
}
