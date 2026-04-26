"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import { deleteHorse } from"@/app/actions/horse";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

interface DeleteHorseModalProps {
 horseId: string;
 horseName: string;
 imageUrls: string[];
}

export default function DeleteHorseModal({ horseId, horseName }: DeleteHorseModalProps) {
 const [showModal, setShowModal] = useState(false);
 const [isDeleting, setIsDeleting] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const router = useRouter();

 const handleDelete = async () => {
 setIsDeleting(true);
 setError(null);
 try {
 const result = await deleteHorse(horseId);
 if (!result.success) throw new Error(result.error ||"Failed to delete.");
 router.push("/dashboard?toast=deleted&name=" + encodeURIComponent(horseName));
 } catch (err) {
 setError(err instanceof Error ? err.message :"Failed to delete. Please try again.");
 setIsDeleting(false);
 }
 };

 return (
 <>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 onClick={() => setShowModal(true)}
 id="delete-horse-button"
 >
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="3 6 5 6 21 6" />
 <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
 <line x1="10" y1="11" x2="10" y2="17" />
 <line x1="14" y1="11" x2="14" y2="17" />
 </svg>
 Delete from Stable
 </button>

 <Dialog open={showModal} onOpenChange={(open) => { if (!isDeleting) setShowModal(open); }}>
 <DialogContent className="sm:max-w-md border-[#9B3028]/30">
 <DialogHeader>
 <DialogTitle className="text-center">
 <span className="mb-2 block text-[3rem]">⚠️</span>
 Delete &ldquo;{horseName}&rdquo;?
 </DialogTitle>
 <DialogDescription className="text-center">
 <strong>This cannot be undone.</strong> All photos, financial vault data, and catalog
 information for this model will be permanently deleted from your stable.
 </DialogDescription>
 </DialogHeader>

 {error && (
 <div className="text-red-700 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm" role="alert">
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
 <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
 </svg>
 {error}
 </div>
 )}

 <div className="flex justify-end gap-4 pt-2">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={() => setShowModal(false)}
 disabled={isDeleting}
 id="delete-cancel"
 >
 Cancel
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-[#9B3028]/40 bg-[#9B3028]/10 px-6 py-2 text-sm font-semibold text-[#9B3028] no-underline transition-all hover:bg-[#9B3028]/20"
 onClick={handleDelete}
 disabled={isDeleting}
 id="delete-confirm"
 >
 {isDeleting ? "Deleting…" : "🗑️ Yes, Delete Permanently"}
 </button>
 </div>
 </DialogContent>
 </Dialog>
 </>
 );
}
