import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { registryRoleOf } from "@/lib/auth";

/**
 * "Registry Desk" on the Registry's masthead, for moderators and the owner
 * only. Everyone else gets nothing (the Desk's own pages refuse them too).
 */
export default async function DeskLink() {
    const who = await registryRoleOf();
    if (!who) return null;
    return (
        <Link href="/catalog/desk" className="btn-ghostleather !px-4 !py-2 !text-xs">
            <ClipboardList size={14} strokeWidth={1.5} /> Registry Desk
        </Link>
    );
}
