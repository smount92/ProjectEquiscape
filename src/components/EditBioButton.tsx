"use client";

import { useState } from"react";
import { updateBio } from"@/app/actions/profile";
import { useRouter } from"next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

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
 <Button variant="outline" size="wide" className="text-xs opacity-70"
 onClick={() => setIsEditing(true)}
 id="edit-bio-btn"
 title="Edit bio"
 >
 ✏️ {currentBio ?"Edit Bio" :"Add Bio"}
 </Button>
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
 className={`text-xs ${bio.length > 450 ? "text-red-700" : "text-muted-foreground"}`}
 >
 {bio.length}/500
 </span>
 <div className="flex gap-2">
 <Button variant="outline" size="wide"
 onClick={() => {
 setBio(currentBio ||"");
 setIsEditing(false);
 setError(null);
 }}
 disabled={saving}
 >
 Cancel
 </Button>
 <Button
 onClick={handleSave}
 disabled={saving}
 id="save-bio-btn"
 >
 {saving ?"Saving…" :"Save"}
 </Button>
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
