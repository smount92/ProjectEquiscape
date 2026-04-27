"use client";

import { useState, useTransition } from"react";
import { blockUser, unblockUser } from"@/app/actions/blocks";

interface BlockButtonProps {
 targetId: string;
 targetAlias: string;
 initialBlocked: boolean;
}

export default function BlockButton({ targetId, targetAlias, initialBlocked }: BlockButtonProps) {
 const [blocked, setBlocked] = useState(initialBlocked);
 const [isPending, startTransition] = useTransition();

 const handleToggle = () => {
 const action = blocked ?"unblock" :"block";
 const confirmMsg = blocked
 ? `Unblock @${targetAlias}?`
 : `Block @${targetAlias}? They won't be able to message you, and their content will be hidden from your feeds.`;

 if (!confirm(confirmMsg)) return;

 const wasBlocked = blocked;
 setBlocked(!blocked);

 startTransition(async () => {
 const result = action ==="block" ? await blockUser(targetId) : await unblockUser(targetId);

 if (!result.success) {
 setBlocked(wasBlocked); // Revert
 }
 });
 };

 return (
 <button
 className={`inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold no-underline transition-all ${blocked ?"text-muted-foreground" :"text-red-700"}`}
 onClick={handleToggle}
 disabled={isPending}
 >
 {blocked ?"✓ Blocked — Unblock" :"🚫 Block User"}
 </button>
 );
}
