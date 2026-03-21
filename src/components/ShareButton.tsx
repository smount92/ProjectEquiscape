"use client";

import { useState, useCallback } from"react";

interface ShareButtonProps {
 /** The title for the share dialog */
 title: string;
 /** Optional text description */
 text?: string;
 /** Label text shown beside the icon (optional) */
 label?: string;
 /** CSS class variant:"icon" (default compact) or"full" (styled button) */
 variant?:"icon" |"full";
}

export default function ShareButton({ title, text, label, variant ="icon" }: ShareButtonProps) {
 const [showToast, setShowToast] = useState(false);
 const [toastMessage, setToastMessage] = useState("");

 const handleShare = useCallback(async () => {
 const url = window.location.href;

 // Try native Web Share API first (iOS/Android)
 if (typeof navigator !=="undefined" && navigator.share) {
 try {
 await navigator.share({
 title,
 text: text || title,
 url,
 });
 return; // User completed or cancelled the native share
 } catch (err) {
 // AbortError = user cancelled, which is fine
 if (err instanceof Error && err.name ==="AbortError") return;
 // Fall through to clipboard fallback
 }
 }

 // Fallback: copy URL to clipboard
 try {
 await navigator.clipboard.writeText(url);
 setToastMessage("Link copied!");
 } catch {
 // Very old browser fallback
 const textArea = document.createElement("textarea");
 textArea.value = url;
 textArea.style.position ="fixed";
 textArea.style.opacity ="0";
 document.body.appendChild(textArea);
 textArea.select();
 document.execCommand("copy");
 document.body.removeChild(textArea);
 setToastMessage("Link copied!");
 }

 setShowToast(true);
 setTimeout(() => setShowToast(false), 2500);
 }, [title, text]);

 const shareIcon = (
 <svg
 width="18"
 height="18"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden="true"
 >
 <circle cx="18" cy="5" r="3" />
 <circle cx="6" cy="12" r="3" />
 <circle cx="18" cy="19" r="3" />
 <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
 <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
 </svg>
 );

 return (
 <>
 <button
 className={variant ==="full" ?"btn btn-ghost share-btn" :"share-icon-btn"}
 onClick={handleShare}
 id="share-button"
 title="Share this page"
 aria-label="Share"
 type="button"
 >
 {shareIcon}
 {label && <span>{label}</span>}
 </button>

 {/*"Link Copied!" Toast */}
 {showToast && (
 <div
 className="share-toast max-[400px]:right-[var(--space-md)] max-[400px]:left-[var(--space-md)] max-[400px]:transform-none max-[400px]:justify-center"
 role="status"
 aria-live="polite"
 >
 <svg
 width="16"
 height="16"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2.5"
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden="true"
 >
 <polyline points="20 6 9 17 4 12" />
 </svg>
 {toastMessage}
 </div>
 )}
 </>
 );
}
