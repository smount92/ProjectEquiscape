"use client";

import { useState } from"react";

export default function GuestLinkButton({ commissionId, guestToken }: { commissionId: string; guestToken: string }) {
 const [copied, setCopied] = useState(false);

 const handleCopy = () => {
 const url = `${window.location.origin}/studio/commission/${commissionId}?token=${guestToken}`;
 navigator.clipboard.writeText(url);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 };

 return (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={handleCopy}
 >
 {copied ?"✅ Link Copied!" :"🔗 Copy Guest Link"}
 </button>
 );
}
