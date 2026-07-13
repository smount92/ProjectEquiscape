"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelTransfer } from "@/app/actions/hoofprint";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RevokeTransferButtonProps {
    transferId: string;
    horseName: string;
}

/** Confirm-then-revoke control for a pending outgoing transfer code. */
export default function RevokeTransferButton({ transferId, horseName }: RevokeTransferButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [revoking, setRevoking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRevoke = async () => {
        setRevoking(true);
        setError(null);
        const result = await cancelTransfer(transferId);
        setRevoking(false);
        if (result.success) {
            setOpen(false);
            router.refresh();
        } else {
            setError(result.error || "Failed to revoke transfer.");
        }
    };

    return (
        <>
            <Button variant="destructive-outline" size="sm" onClick={() => setOpen(true)}>
                Revoke
            </Button>
            <Dialog open={open} onOpenChange={(next) => { if (!revoking) setOpen(next); }}>
                <DialogContent className="sm:max-w-[380px]">
                    <DialogHeader>
                        <DialogTitle>Revoke transfer code?</DialogTitle>
                        <DialogDescription>
                            This cancels the pending transfer code for &ldquo;{horseName}&rdquo;. Anyone holding the code
                            will no longer be able to claim it.
                        </DialogDescription>
                    </DialogHeader>
                    {error && <p className="text-sm text-[#ef4444]">{error}</p>}
                    <DialogFooter>
                        <Button variant="outline" size="wide" onClick={() => setOpen(false)} disabled={revoking}>
                            Keep Code
                        </Button>
                        <Button variant="destructive-outline" size="wide" onClick={handleRevoke} disabled={revoking}>
                            {revoking ? "Revoking…" : "Revoke Transfer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
