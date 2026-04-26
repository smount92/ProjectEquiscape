"use client";

import { useState } from"react";
import { updateBio } from"@/app/actions/profile";
import { useRouter } from"next/navigation";
import { Textarea } from "@/components/ui/textarea";

interface EditBioButtonProps {
 currentBio: string | null;
}

export default function EditBioButton({ currentBio }: EditBioButtonProps) {
 const router = useRouter();
 const [isEditing, setIsEditing] = useState(false);
 const [bio, setBio] = useState(currentBio ||"");
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const handleSave = async () => {
 setSaving(true);
 setError(null);
 const result = await updateBio(bio);
 if (result.success) {
 setIsEditing(false);
 router.refresh();
 } else {
 setError(result.error ||"Failed to save bio.");
 }
 setSaving(false);
 };

 if (!isEditing) {
 return (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-xs font-semibold text-stone-600 no-underline opacity-70 transition-all"
 onClick={() => setIsEditing(true)}
 id="edit-bio-btn"
 title="Edit bio"
 >
 ✏️ {currentBio ?"Edit Bio" :"Add Bio"}
 </button>
 );
 }

 return (
 <div className="edit-bio-form mt-2 w-full max-w-[480px]">
 <Textarea
 value={bio}
 onChange={(e) => setBio(e.target.value.slice(0, 500))}
 placeholder="Tell collectors about yourself… (500 chars max)"
 className="min-h-[80px] resize-y text-sm"
 maxLength={500}
 id="bio-textarea"
 autoFocus
 />
 <div className="mt-1 flex items-center justify-between gap-2">
 <span
 className={`text-xs ${bio.length > 450 ? "text-red-700" : "text-stone-500"}`}
 >
 {bio.length}/500
 </span>
 <div className="flex gap-2">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={() => {
 setBio(currentBio ||"");
 setIsEditing(false);
 setError(null);
 }}
 disabled={saving}
 >
 Cancel
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={handleSave}
 disabled={saving}
 id="save-bio-btn"
 >
 {saving ?"Saving…" :"Save"}
 </button>
 </div>
 </div>
 {error && (
 <div className="mt-1 text-xs text-red-700">
 {error}
 </div>
 )}
 </div>
 );
}
