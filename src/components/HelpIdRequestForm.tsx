"use client";

import { useState, useRef } from"react";
import { createIdRequest } from"@/app/actions/help-id";
import { compressImage } from"@/lib/utils/imageCompression";

export default function HelpIdRequestForm() {
 const [isOpen, setIsOpen] = useState(false);
 const [status, setStatus] = useState<"idle" |"submitting" |"success" |"error">("idle");
 const [error, setError] = useState<string | null>(null);
 const [preview, setPreview] = useState<string | null>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);

 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 const reader = new FileReader();
 reader.onload = () => setPreview(reader.result as string);
 reader.readAsDataURL(file);
 }
 };

 const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 setStatus("submitting");
 setError(null);

 const form = e.currentTarget;
 const formData = new FormData(form);

 // Manual validation for photo (hidden input can't show native validation tooltip)
 const imageFile = formData.get("image") as File;
 if (!imageFile || imageFile.size === 0) {
 setStatus("error");
 setError("Please upload a photo of the model.");
 return;
 }

 // Compress image before upload
 if (imageFile.size > 0) {
 try {
 const compressed = await compressImage(imageFile);
 formData.set("image", compressed);
 } catch {
 // Use original if compression fails
 }
 }

 const result = await createIdRequest(formData);

 if (result.success) {
 setStatus("success");
 setPreview(null);
 form.reset();
 // Auto-close after success
 setTimeout(() => {
 setIsOpen(false);
 setStatus("idle");
 }, 2000);
 } else {
 setStatus("error");
 setError(result.error ||"Failed to submit request");
 }
 };

 if (!isOpen) {
 return (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={() => setIsOpen(true)}
 id="new-id-request-btn"
 style={{ marginTop:"var(--space-lg)" }}
 >
 🔍 Submit a Mystery Model
 </button>
 );
 }

 return (
 <div className="help-id-form-bg-card border-edge card animate-fade-in-up mt-6 rounded-lg border shadow-md transition-all">
 <h3 className="mb-4">📸 Submit a Mystery Model</h3>

 {status ==="success" ? (
 <div className="p-8" style={{ textAlign:"center" }}>
 <p className="mb-2 text-[2rem]">✅</p>
 <p className="text-success">Request submitted! The community will help identify your model.</p>
 </div>
 ) : (
 <form onSubmit={handleSubmit}>
 {/* Photo Upload */}
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Photo of the model *</label>
 <div
 className="border-edge bg-card flex cursor-pointer flex-col items-center justify-center rounded-lg border-[2px] border-dashed px-8 py-[var(--space-3xl)] text-center transition-all"
 style={{ padding:"var(--space-xl)", cursor:"pointer" }}
 onClick={() => fileInputRef.current?.click()}
 >
 {preview ? (
 <img
 src={preview}
 alt="Preview"
 style={{ maxHeight: 200, borderRadius:"var(--radius-md)", objectFit:"contain" }}
 />
 ) : (
 <>
 <div className="mb-4 text-[3rem] opacity-[0.7]">📷</div>
 <p className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-edge bg-card p-8 text-center transition-all">
 Click to upload a photo
 <br />
 <span className="text-forest text-sm underline">
 Clear, well-lit photos get the best results
 </span>
 </p>
 </>
 )}
 <input
 ref={fileInputRef}
 type="file"
 name="image"
 accept="image/*"
 onChange={handleFileChange}
 style={{ display:"none" }}
 required={false}
 />
 </div>
 </div>

 {/* Description */}
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold" htmlFor="help-id-description">
 Description
 </label>
 <textarea
 id="help-id-description"
 name="description"
 className="form-input"
 rows={3}
 placeholder="What do you know about this model? Size, material, markings, where you got it..."
 style={{ resize:"vertical" }}
 />
 </div>

 {/* Identifying Marks */}
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold" htmlFor="help-id-marks">
 Any identifying marks?
 </label>
 <input
 id="help-id-marks"
 type="text"
 name="identifyingMarks"
 className="form-input"
 placeholder="Mold marks, stamps, stickers, model numbers..."
 />
 </div>

 {error && (
 <div className="text-danger mt-4 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-6 py-4 text-sm">
 {error}
 </div>
 )}

 <div className="mt-6 gap-4" style={{ display:"flex" }}>
 <button
 type="button"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => {
 setIsOpen(false);
 setPreview(null);
 setError(null);
 }}
 >
 Cancel
 </button>
 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 disabled={status ==="submitting"}
 id="submit-id-request-btn"
 >
 {status ==="submitting" ? (
 <>
 <span className="spinner-inline" /> Submitting…
 </>
 ) : (
"Submit Request"
 )}
 </button>
 </div>
 </form>
 )}
 </div>
 );
}
