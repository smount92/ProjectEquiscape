"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { canOpenDesk } from "@/app/actions/registry-desk";

/**
 * "Edit in the Desk" on a reference page, for Registry moderators and the
 * owner only. The page is cached and the same for everyone, so the link
 * is decided in the browser: nothing at all for a visitor who isn't
 * signed in (no request), and one role check for a signed-in member.
 */
export default function EditInDeskLink({ itemId, className }: { itemId: string; className?: string }) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        let live = true;
        (async () => {
            try {
                const { data } = await createClient().auth.getSession();
                if (!live || !data.session) return;
                const r = await canOpenDesk();
                if (live && r.success) setShow(true);
            } catch {
                /* no link is the safe answer */
            }
        })();
        return () => {
            live = false;
        };
    }, []);

    if (!show) return null;
    return (
        <Link href={`/catalog/desk/mold/${itemId}`} className={className} data-testid="edit-in-desk">
            🗂️ Edit in the Desk
        </Link>
    );
}
