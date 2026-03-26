"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import { generateTransferCode, cancelTransfer } from"@/app/actions/hoofprint";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

interface TransferModalProps {
 horseId: string;
 horseName: string;
}

export default function TransferModal({ horseId, horseName }: TransferModalProps) {
 const router = useRouter();
 const [isOpen, setIsOpen] = useState(false);
 const [step, setStep] = useState<"form" |"code">("form");
 const [generating, setGenerating] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [generatedCode, setGeneratedCode] = useState<string | null>(null);
 const [transferId, setTransferId] = useState<string | null>(null);
 const [copied, setCopied] = useState(false);

 const [acquisitionType, setAcquisitionType] = useState<"purchase" |"trade" |"gift" |"transfer">("purchase");
 const [salePrice, setSalePrice] = useState("");
 const [isPricePublic, setIsPricePublic] = useState(false);
 const [notes, setNotes] = useState("");

 const handleGenerate = async () => {
 setGenerating(true);
 setError(null);
 const result = await generateTransferCode({
 horseId,
 acquisitionType,
 salePrice: salePrice ? parseFloat(salePrice) : undefined,
 isPricePublic,
 notes: notes.trim() || undefined,
 });
 if (result.success && result.code) {
 setGeneratedCode(result.code);
 setStep("code");
 } else {
 setError(result.error ||"Failed to generate code.");
 }
 setGenerating(false);
 };

 const handleCopy = async () => {
 if (generatedCode) {
 await navigator.clipboard.writeText(generatedCode);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 }
 };

 const handleCancel = async () => {
 if (transferId) {
 await cancelTransfer(transferId);
 }
 setIsOpen(false);
 setStep("form");
 setGeneratedCode(null);
 setTransferId(null);
 router.refresh();
 };

 const handleClose = () => {
 setIsOpen(false);
 setStep("form");
 setGeneratedCode(null);
 setError(null);
 };

 void transferId;

 return (
 <>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => setIsOpen(true)}
 >
 📦 Transfer Ownership
 </button>

 <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
 <DialogContent className="sm:max-w-[420px]">
 {step ==="form" ? (
 <>
 <DialogHeader>
 <DialogTitle>📦 Transfer &ldquo;{horseName}&rdquo;</DialogTitle>
 <DialogDescription>
 Generate a 6-character code to send to the new owner. They&apos;ll enter it on
 the Claim page to complete the transfer.
 <strong> The code expires in 48 hours.</strong>
 </DialogDescription>
 </DialogHeader>

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">
 Transfer Type
 </label>
 <select
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={acquisitionType}
 onChange={(e) =>
 setAcquisitionType(e.target.value as typeof acquisitionType)
 }
 title="Transfer type"
 >
 <option value="purchase">💲 Sale</option>
 <option value="trade">🔄 Trade</option>
 <option value="gift">🎁 Gift</option>
 <option value="transfer">📦 Transfer</option>
 </select>
 </div>

 {acquisitionType ==="purchase" && (
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">
 Sale Price
 </label>
 <Input
 type="number"
 value={salePrice}
 onChange={(e) => setSalePrice(e.target.value)}
 placeholder="0.00"
 min="0"
 step="0.01"
 />
 <label className="mt-[6px] flex cursor-pointer items-center gap-[6px] text-sm">
 <Input
 type="checkbox"
 checked={isPricePublic}
 onChange={(e) => setIsPricePublic(e.target.checked)}
 />
 Show price on public Hoofprint
 </label>
 </div>
 )}

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">
 Notes (optional)
 </label>
 <Textarea
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 placeholder="e.g. Sold at BreyerFest 2026"
 rows={2}
 />
 </div>

 {error && (
 <p className="mb-2 text-sm text-[#ef4444]">{error}</p>
 )}

 <div className="mt-4 flex justify-end gap-2">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={handleClose}
 >
 Cancel
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleGenerate}
 disabled={generating}
 >
 {generating ?"Generating…" :"Generate Code"}
 </button>
 </div>
 </>
 ) : (
 <>
 <DialogHeader>
 <DialogTitle className="text-center">🐾 Transfer Code Ready!</DialogTitle>
 </DialogHeader>
 <div className="mb-4 rounded-lg border-2 border-dashed border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] p-6 text-center">
 <div className="font-mono text-[2.5rem] font-extrabold tracking-[0.3em] text-[#f59e0b]">
 {generatedCode}
 </div>
 <button
 className="mt-2 inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={handleCopy}
 >
 {copied ?"✅ Copied!" :"📋 Copy Code"}
 </button>
 </div>
 <p className="text-muted text-center text-sm">
 Send this code to the buyer/receiver. They can enter it on
 <strong> /claim</strong> to complete the transfer.
 <br />
 <span className="text-[var(--color-accent,#f59e0b)]">Expires in 48 hours.</span>
 </p>
 <div className="mt-4 flex justify-center gap-2">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={handleCancel}
 >
 Cancel Transfer
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleClose}
 >
 Done
 </button>
 </div>
 </>
 )}
 </DialogContent>
 </Dialog>
 </>
 );
}
