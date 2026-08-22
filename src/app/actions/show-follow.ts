"use server";

/**
 * Follow a show — the lightweight subscription (migration 184).
 *
 * No host approval, no state beyond existence: a member says "tell me
 * what happens here" and the lifecycle fan-outs start including them.
 * Entering a horse follows implicitly (see enterClass in shows-v2.ts),
 * because an entrant obviously wants the updates — the fan-outs dedupe
 * the two sets, so nobody is notified twice.
 *
 * Everything here feature-detects migration 184: before the owner
 * pastes it, `supported` is false, the button does not render, and the
 * site behaves exactly as it does today.
 *
 * PRIVACY: these actions only ever read or write the CALLER'S OWN row,
 * under RLS, on the user-scoped client. No action here can return
 * another member's follow, and none returns a follower list.
 */

import { logger } from "@/lib/logger";
import { followDb, getShowFollowSupport, isMissingSchema } from "@/lib/shows/followSupport";
import { createClient } from "@/lib/supabase/server";

export interface ShowFollowState {
    /** False = migration 184 is not applied; hide the control entirely. */
    supported: boolean;
    isFollowing: boolean;
}

/**
 * The viewer's follow state for a show. Called from the server-rendered
 * show page; anonymous visitors get `{ supported, isFollowing: false }`
 * so the page can still decide whether to show a sign-in affordance.
 */
export async function getShowFollowState(showId: string): Promise<ShowFollowState> {
    try {
        const supabase = await createClient();
        const supported = await getShowFollowSupport(supabase);
        if (!supported) return { supported: false, isFollowing: false };

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { supported: true, isFollowing: false };

        const { data, error } = await followDb(supabase)
            .from("show_followers")
            .select("show_id")
            .eq("show_id", showId)
            .eq("user_id", user.id)
            .maybeSingle();
        if (error) {
            if (!isMissingSchema(error)) {
                logger.error("ShowFollow", `Follow state read failed: ${error.message}`);
            }
            return { supported: !isMissingSchema(error), isFollowing: false };
        }
        return { supported: true, isFollowing: !!data };
    } catch (err) {
        // A show page must never fail because the follow probe did.
        logger.error("ShowFollow", "Follow state read threw", err);
        return { supported: false, isFollowing: false };
    }
}

/**
 * Follow / unfollow, driven by the caller's CURRENT state rather than a
 * read-then-write toggle: the client sends what it wants to be true, so
 * a double-click or a stale tab converges instead of flapping.
 *
 * The insert is an upsert on the (show_id, user_id) primary key, which
 * makes "follow" idempotent — the implicit follow on entry and an
 * explicit tap can race freely.
 */
export async function setShowFollow(
    showId: string,
    following: boolean,
): Promise<{ success: boolean; isFollowing?: boolean; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "You must be signed in to follow a show." };

    const db = followDb(supabase);

    if (following) {
        const { error } = await db
            .from("show_followers")
            .upsert({ show_id: showId, user_id: user.id }, { onConflict: "show_id,user_id" });
        if (error) {
            if (isMissingSchema(error)) {
                return { success: false, error: "Following shows isn't available yet." };
            }
            logger.error("ShowFollow", `Follow failed: ${error.message}`);
            return { success: false, error: "That didn't go through — try again." };
        }
        return { success: true, isFollowing: true };
    }

    // RLS scopes the delete to the caller's own row; the explicit
    // user_id filter makes that intent visible at the call site too.
    const { error } = await db
        .from("show_followers")
        .delete()
        .eq("show_id", showId)
        .eq("user_id", user.id);
    if (error) {
        if (isMissingSchema(error)) {
            return { success: false, error: "Following shows isn't available yet." };
        }
        logger.error("ShowFollow", `Unfollow failed: ${error.message}`);
        return { success: false, error: "That didn't go through — try again." };
    }
    return { success: true, isFollowing: false };
}
