"use client";

import { useState, useEffect, useRef } from "react";
import { getGroupFiles, uploadGroupFile, deleteGroupFile, type GroupFile } from "@/app/actions/groups";
import { safeUUID } from "@/lib/utils/uuid";

interface Props {
    groupId: string;
    canUpload: boolean; // admin/owner/mod
    canDelete: boolean; // admin/owner
}

const fileIcon = (type: string) => {
    switch (type) {
        case "pdf":
            return "📄";
        case "image":
            return "🖼️";
        case "doc":
            return "📝";
        default:
            return "📎";
    }
};

const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
};

const timeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return "just now";
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

        setUploading(true);
        // For now, store the file name as the path — actual storage upload would happen here
        const result = await uploadGroupFile(
            groupId,
            `group-files/${groupId}/${safeUUID()}-${file.name}`,
            file.name,
            file.size,
            description,
        );

        if (result.success) {
            setDescription("");
            if (fileRef.current) fileRef.current.value = "";
            const updated = await getGroupFiles(groupId);
            setFiles(updated);
        }
        setUploading(false);
    };

    const handleDelete = async (fileId: string) => {
        if (!confirm("Delete this file?")) return;
        await deleteGroupFile(fileId);
        setFiles(files.filter((f) => f.id !== fileId));
    };

    if (loading) return <p className="text-muted">Loading files…</p>;

    return (
        <div>
            {/* Upload Form */}
            {canUpload && (
                <div className="group-file-upload mb-6">
                    <div className="gap-2" style={{ display: "flex", alignItems: "end", flexWrap: "wrap" }}>
                        <div className="min-w-[200] flex-1">
                            <label className="text-ink mb-1 block text-sm font-semibold">Upload File</label>
                            <input
                                ref={fileRef}
                                type="file"
                                className="form-input"
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                            />
                        </div>
                        <div className="min-w-[200] flex-1">
                            <label className="text-ink mb-1 block text-sm font-semibold">Description (optional)</label>
                            <input
                                className="form-input"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What's this file about?"
                            />
                        </div>
                        <button
                            className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
                            onClick={handleUpload}
                            disabled={uploading}
                        >
                            {uploading ? "Uploading…" : "📤 Upload"}
                        </button>
                    </div>
                </div>
            )}

            {/* File List */}
            {files.length === 0 ? (
                <div className="empty-state">
                    <p>No files uploaded yet.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-1">
                    {files.map((f) => (
                        <div
                            key={f.id}
                            className="border-edge flex items-center gap-4 rounded-md border bg-black/[0.02] p-4 transition-colors hover:bg-black/[0.05]"
                        >
                            <div className="shrink-0 text-2xl">{fileIcon(f.fileType)}</div>
                            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                                <span className="text-ink overflow-hidden text-sm font-semibold text-ellipsis whitespace-nowrap">
                                    {f.fileName}
                                </span>
                                <span className="text-muted text-xs">
                                    {formatSize(f.fileSize)}
                                    {f.description && <> · {f.description}</>}
                                    {" · "}@{f.uploaderAlias} · {timeAgo(f.createdAt)}
                                </span>
                            </div>
                            <div className="gap-1" style={{ display: "flex" }}>
                                {canDelete && (
                                    <button
                                        className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
                                        onClick={() => handleDelete(f.id)}
                                        title="Delete file"
                                    >
                                        🗑️
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
