"use client";

import { useState, useEffect, useRef } from"react";
import { getGroupFiles, uploadGroupFile, deleteGroupFile, type GroupFile } from"@/app/actions/groups";
import { createClient } from "@/lib/supabase/client";
import { GROUP_FILE_MAX_SIZE, GROUP_FILE_ALLOWED_EXTENSIONS, GROUP_FILE_MIME_TYPES } from "@/lib/groupFiles";
import { safeUUID } from"@/lib/utils/uuid";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
 groupId: string;
 canUpload: boolean; // admin/owner/mod
 canDelete: boolean; // admin/owner
}

const fileIcon = (type: string) => {
 switch (type) {
 case"pdf":
 return"📄";
 case"image":
 return"🖼️";
 case"doc":
 return"📝";
 default:
 return"📎";
 }
};

const formatSize = (bytes: number | null) => {
 if (!bytes) return"";
 if (bytes < 1024) return `${bytes} B`;
 if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
 return `${(bytes / 1048576).toFixed(1)} MB`;
};

const timeAgo = (dateStr: string) => {
 const d = new Date(dateStr);
 const now = new Date();
 const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
 if (diff < 60) return"just now";
 if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
 if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
 if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
 return d.toLocaleDateString();
};

export default function GroupFiles({ groupId, canUpload, canDelete }: Props) {
 const [files, setFiles] = useState<GroupFile[]>([]);
 const [loading, setLoading] = useState(true);
 const [uploading, setUploading] = useState(false);
 const [description, setDescription] = useState("");
 const fileRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 getGroupFiles(groupId).then((data) => {
 setFiles(data);
 setLoading(false);
 });
 }, [groupId]);

 const handleUpload = async () => {
 const file = fileRef.current?.files?.[0];
 if (!file) return;

 const ext = file.name.split(".").pop()?.toLowerCase() ||"";
 if (!GROUP_FILE_ALLOWED_EXTENSIONS.includes(ext)) {
 alert("File type not allowed. Use PDF, Word, or image files.");
 return;
 }
 if (file.size > GROUP_FILE_MAX_SIZE) {
 alert(`${file.name} is too large (max 10MB).`);
 return;
 }

 setUploading(true);
 const supabase = createClient();
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) {
 alert("You must be signed in to upload files.");
 setUploading(false);
 return;
 }

 // Upload the bytes to the private group-files bucket
 // (path pattern {user_id}/{group_id}/… matches the bucket RLS policy)
 const safeName = file.name.replace(/[^\w.-]/g,"_");
 const path = `${user.id}/${groupId}/${safeUUID()}-${safeName}`;
 const { error: uploadError } = await supabase.storage
 .from("group-files")
 .upload(path, file, {
 contentType: GROUP_FILE_MIME_TYPES[ext] || file.type,
 upsert: false,
 });

 if (uploadError) {
 alert(`Upload failed: ${uploadError.message}`);
 setUploading(false);
 return;
 }

 // Link the uploaded object via the server action
 const result = await uploadGroupFile(groupId, path, file.name, file.size, description);

 if (result.success) {
 setDescription("");
 if (fileRef.current) fileRef.current.value ="";
 const updated = await getGroupFiles(groupId);
 setFiles(updated);
 } else {
 // Don't leave an orphaned object behind if the row insert failed
 await supabase.storage.from("group-files").remove([path]);
 alert(result.error ||"Upload failed. Please try again.");
 }
 setUploading(false);
 };

 const handleDelete = async (fileId: string) => {
 if (!confirm("Delete this file?")) return;
 await deleteGroupFile(fileId);
 setFiles(files.filter((f) => f.id !== fileId));
 };

 if (loading) return <p className="text-muted-foreground">Loading files…</p>;

 return (
 <div>
 {/* Upload Form */}
 {canUpload && (
 <div className="group-file-upload mb-6">
 <div className="flex flex-wrap items-end gap-2">
 <div className="min-w-[200] flex-1">
 <label className="text-foreground mb-1 block text-sm font-semibold">Upload File</label>
 <Input
 ref={fileRef}
 type="file"
 
 accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
 title="Choose file to upload"
 />
 </div>
 <div className="min-w-[200] flex-1">
 <label className="text-foreground mb-1 block text-sm font-semibold">Description (optional)</label>
 <Input
 
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="What's this file about?"
 />
 </div>
 <Button
 onClick={handleUpload}
 disabled={uploading}
 >
 {uploading ?"Uploading…" :"📤 Upload"}
 </Button>
 </div>
 </div>
 )}

 {/* File List */}
 {files.length === 0 ? (
 <div className="flex flex-col items-center justify-center rounded-lg border border-input bg-card p-8 text-center shadow-sm">
 <p>No files uploaded yet.</p>
 </div>
 ) : (
 <div className="flex flex-col gap-1">
 {files.map((f) => (
 <div
 key={f.id}
 className="border-input flex items-center gap-4 rounded-md border bg-black/[0.02] p-4 transition-colors hover:bg-black/[0.05]"
 >
 <div className="shrink-0 text-2xl">{fileIcon(f.fileType)}</div>
 <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
 {f.downloadUrl ? (
 <a
 href={f.downloadUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="text-foreground overflow-hidden text-sm font-semibold text-ellipsis whitespace-nowrap hover:underline"
 >
 {f.fileName}
 </a>
 ) : (
 <span className="text-muted-foreground overflow-hidden text-sm font-semibold text-ellipsis whitespace-nowrap">
 {f.fileName} <span className="font-normal italic">(file unavailable)</span>
 </span>
 )}
 <span className="text-secondary-foreground text-xs">
 {formatSize(f.fileSize)}
 {f.description && <> · {f.description}</>}
 {" ·"}@{f.uploaderAlias} · {timeAgo(f.createdAt)}
 </span>
 </div>
 <div className="flex gap-1">
 {f.downloadUrl && (
 <Button variant="outline" size="wide" asChild title="Download file">
 <a href={f.downloadUrl} target="_blank" rel="noopener noreferrer">⬇️</a>
 </Button>
 )}
 {canDelete && (
 <Button variant="outline" size="wide"
 onClick={() => handleDelete(f.id)}
 title="Delete file"
 >
 🗑️
 </Button>
 )}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
