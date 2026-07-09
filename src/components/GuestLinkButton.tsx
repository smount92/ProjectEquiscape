"use client";

import { useState } from"react";
import { Button } from "@/components/ui/button";

export default function GuestLinkButton({ commissionId, guestToken }: { commissionId: string; guestToken: string }) {
 const [copied, setCopied] = useState(false);

 const handleCopy = () => {
 const url = `${window.location.origin}/studio/commission/${commissionId}?token=${guestToken}`;
 navigator.clipboard.writeText(url);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 };

 return (
 <Button variant="outline" size="wide"
 onClick={handleCopy}
 >
 {copied ?"✅ Link Copied!" :"🔗 Copy Guest Link"}
 </Button>
 );
}
