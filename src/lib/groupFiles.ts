/**
 * Shared constants for the group Files feature.
 * Kept out of the server-actions file ("use server" modules may
 * only export async functions) so the client component can import them too.
 */

/** Must match the group-files bucket file_size_limit (migration 121) */
export const GROUP_FILE_MAX_SIZE = 10 * 1024 * 1024; // 10MB

/** Must match the group-files bucket allowed_mime_types (migration 121) */
export const GROUP_FILE_ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "jpg", "jpeg", "png", "gif", "webp"];

export const GROUP_FILE_MIME_TYPES: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
};
