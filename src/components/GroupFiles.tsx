"use client";

import { useState, useEffect, useRef } from "react";
import { getGroupFiles, uploadGroupFile, deleteGroupFile, type GroupFile } from "@/app/actions/groups";
import { safeUUID } from "@/lib/utils/uuid";
import styles from "./GroupFiles.module.css";

interface Props {
    groupId: string;
    canUpload: boolean; // admin/owner/mod
    canDelete: boolean; // admin/owner
}

const fileIcon = (type: string) => {
    switch (type) {
        case "pdf": return "📄";
        case "image": return "🖼️";
        case "doc": return "📝";
        default: return "📎";
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
        getGroupFiles(groupId).then(data => {
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
            description
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
        setFiles(files.filter(f => f.id !== fileId));
    };

    if (loading) return <p style={{ color: "var(--color-text-muted)" }}>Loading files…</p>;

    return (
        <div>
            {/* Upload Form */}
            {canUpload && (
                <div className="group-file-upload" style={{ marginBottom: "var(--space-lg)" }}>
                    <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "end", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <label className="form-label">Upload File</label>
                            <input
                                ref={fileRef}
                                type="file"
                                className="form-input"
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <label className="form-label">Description (optional)</label>
                            <input
                                className="form-input"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="What's this file about?"
                            />
                        </div>
                        <button
                            className="btn btn-primary"
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
                <div className={styles.fileList}>
                    {files.map(f => (
                        <div key={f.id} className={styles.fileItem}>
                            <div className={styles.fileIcon}>{fileIcon(f.fileType)}</div>
                            <div className={styles.fileInfo}>
                                <span className={styles.fileName}>{f.fileName}</span>
                                <span className={styles.fileMeta}>
                                    {formatSize(f.fileSize)}
                                    {f.description && <> · {f.description}</>}
                                    {" · "}@{f.uploaderAlias} · {timeAgo(f.createdAt)}
                                </span>
                            </div>
                            <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                                {canDelete && (
                                    <button
                                        className="btn btn-ghost btn-sm"
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
