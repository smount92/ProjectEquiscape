"use client";

import { useState } from"react";
import { createPortal } from"react-dom";
import { useRouter } from"next/navigation";
import { deleteHorse } from"@/app/actions/horse";

interface DeleteHorseModalProps {
 horseId: string;
 horseName: string;
 imageUrls: string[]; // stored image_url values from horse_images
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
 if (!result.success) {
 throw new Error(result.error ||"Failed to delete.");
 }
 // Redirect to dashboard with success toast
 router.push("/dashboard?toast=deleted&name=" + encodeURIComponent(horseName));
 } catch (err) {
 setError(err instanceof Error ? err.message :"Failed to delete. Please try again.");
 setIsDeleting(false);
 }
 };

 return (
 <>
 {/* Trigger button */}
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 onClick={() => setShowModal(true)}
 id="delete-horse-button"
 >
 <svg
 width="16"
 height="16"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <polyline points="3 6 5 6 21 6" />
 <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
 <line x1="10" y1="11" x2="10" y2="17" />
 <line x1="14" y1="11" x2="14" y2="17" />
 </svg>
 Delete from Stable
 </button>

 {/* Modal overlay — portaled to body to escape CSS containment */}
 {showModal &&
 createPortal(
 <div
 className="modal-overlay"
 onClick={(e) => {
 if (e.target === e.currentTarget && !isDeleting) setShowModal(false);
 }}
 role="dialog"
 aria-modal="true"
 aria-labelledby="delete-modal-title"
 >
 <div className="bg-card border-edge danger rounded-lg border shadow-md transition-all">
 <div className="mb-4 text-center text-[3rem]">⚠️</div>
 <h2 id="delete-modal-title">Delete &ldquo;{horseName}&rdquo;?</h2>
 <p>
 <strong>This cannot be undone.</strong> All photos, financial vault data, and catalog
 information for this model will be permanently deleted from your stable.
 </p>

 {error && (
 <div
 className="text-danger mt-2 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm"
 role="alert"
 style={{ marginBottom:"var(--space-lg)" }}
 >
 <svg
 width="16"
 height="16"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 >
 <circle cx="12" cy="12" r="10" />
 <line x1="15" y1="9" x2="9" y2="15" />
 <line x1="9" y1="9" x2="15" y2="15" />
 </svg>
 {error}
 </div>
 )}

 <div className="flex gap-4">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => setShowModal(false)}
 disabled={isDeleting}
 id="delete-cancel"
 >
 Cancel
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 onClick={handleDelete}
 disabled={isDeleting}
 id="delete-confirm"
 >
 {isDeleting ? (
 <>
 <span
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 aria-hidden="true"
 />
 Deleting…
 </>
 ) : (
 <>🗑️ Yes, Delete Permanently</>
 )}
 </button>
 </div>
 </div>
 </div>,
 document.body,
 )}
 </>
 );
}
