---
description: Add photo/image attachment support to DM conversations. Uses existing media_attachments table (message_id FK). Upload to Supabase Storage, render inline in chat bubbles.
---

# Feature: DM Photo Attachments

> **Context:** Beta users want to share photos in conversations (screenshots, horse photos for reference). The `media_attachments` table already has a `message_id` FK — the schema is ready, we just need the server action, storage, and UI.
> **Investigation:** See `.agents/docs/user-bug-report-investigation.md` for full analysis.

**MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` and `.agents/MASTER_SUPABASE.md` first.

// turbo-all

---

## Pre-flight: Verify Schema

The `media_attachments` table already exists with the correct FK:

```
media_attachments:
    id: uuid (PK)
    storage_path: text (required)
    uploader_id: uuid → users.id
    message_id: uuid → messages.id (nullable)
    post_id: uuid → posts.id (nullable)
    commission_id: uuid → commissions.id (nullable)
    event_id: uuid → events.id (nullable)
    help_request_id: uuid → id_requests.id (nullable)
    caption: text (nullable)
    created_at: timestamptz
```

No migration needed. ✅

---

## Phase 1: Storage Bucket Setup (~5 min)

### 1.1 Verify or Create Storage Bucket

Check if a suitable bucket exists for DM attachments. The `horse-images` bucket is PUBLIC — DMs should be PRIVATE (only conversation participants can view).

**Option A:** If a `chat-attachments` or `dm-attachments` bucket doesn't exist, create one via Supabase Dashboard:
- Bucket name: `chat-attachments`
- Public: **No** (private — requires signed URL or RLS for reads)
- File size limit: 5MB
- Allowed MIME types: `image/jpeg, image/png, image/webp, image/gif`

**Option B:** Check via Supabase CLI:
```powershell
# List existing buckets (requires Supabase CLI configured)
# If not using CLI, check Supabase Dashboard → Storage
```

### 1.2 Storage RLS Policy (if using Supabase Dashboard)

Create RLS policy for `chat-attachments` bucket:

```sql
-- Upload: Only authenticated users can upload to their own folder
CREATE POLICY "Users can upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Read: Only conversation participants can view
-- This is enforced at the application level via signed URLs
CREATE POLICY "Users can read own chat attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- The other participant reads via signed URL generated server-side
-- after verifying conversation membership
```

> [!IMPORTANT]
> Because DMs are private, we use **signed URLs** (not public URLs) for the other participant. The sender's folder stores the file, and the server generates a signed URL for the recipient.

---

## Phase 2: Server Action — `sendMessageWithAttachments()` (~15 min)

### 2.1 Expand `sendMessage()` in `src/app/actions/messaging.ts`

Add an optional `attachments` parameter:

```ts
/**
 * Send a message in a conversation, optionally with image attachments.
 * Images should already be uploaded to the `chat-attachments` bucket
 * by the client before calling this action.
 */
export async function sendMessage(
    conversationId: string,
    content: string,
    attachments?: { storagePath: string; caption?: string }[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };
    if (!content.trim() && (!attachments || attachments.length === 0)) {
        return { success: false, error: "Message cannot be empty." };
    }

    // Guard: max 5 attachments per message
    if (attachments && attachments.length > 5) {
        return { success: false, error: "Maximum 5 images per message." };
    }

    // Insert message
    const { data: message, error } = await supabase
        .from("messages")
        .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: sanitizeText(content || "📷 Sent a photo"),
        })
        .select("id")
        .single<{ id: string }>();

    if (error || !message) return { success: false, error: error?.message || "Failed to send." };

    // Insert media attachments if any
    if (attachments && attachments.length > 0) {
        const mediaInserts = attachments.map((att) => ({
            message_id: message.id,
            uploader_id: user.id,
            storage_path: att.storagePath,
            caption: att.caption || null,
        }));

        const { error: mediaError } = await supabase
            .from("media_attachments")
            .insert(mediaInserts);

        if (mediaError) {
            // Non-blocking: message was sent, attachments failed
            // Log but don't return error
            const { logger } = await import("@/lib/logger");
            logger.error("Messaging", "Failed to insert media attachments", mediaError);
        }
    }

    // Update conversation's updated_at
    await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

    // ... (keep existing email notification logic unchanged) ...

    return { success: true, messageId: message.id };
}
```

### 2.2 Add `getSignedAttachmentUrl()` helper

Add a new server action for generating signed URLs for DM attachments:

```ts
/**
 * Generate a signed URL for a DM attachment.
 * Verifies the requesting user is a participant in the conversation.
 */
export async function getSignedAttachmentUrl(
    storagePath: string,
    conversationId: string
): Promise<{ url: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { url: null };

    // Verify participant
    const { data: convo } = await supabase
        .from("conversations")
        .select("buyer_id, seller_id")
        .eq("id", conversationId)
        .single();

    if (!convo) return { url: null };
    const c = convo as { buyer_id: string; seller_id: string };
    if (c.buyer_id !== user.id && c.seller_id !== user.id) return { url: null };

    // Generate 1-hour signed URL
    const { data } = await supabase.storage
        .from("chat-attachments")
        .createSignedUrl(storagePath, 3600);

    return { url: data?.signedUrl || null };
}
```

### 2.3 Add `getMessageAttachments()` for loading existing attachments

```ts
/**
 * Fetch all media attachments for messages in a conversation.
 * Returns a map of messageId → attachment URLs.
 */
export async function getConversationAttachments(
    conversationId: string
): Promise<Map<string, { url: string; caption: string | null }[]>> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Map();

    // Verify participant
    const { data: convo } = await supabase
        .from("conversations")
        .select("buyer_id, seller_id")
        .eq("id", conversationId)
        .single();

    if (!convo) return new Map();
    const c = convo as { buyer_id: string; seller_id: string };
    if (c.buyer_id !== user.id && c.seller_id !== user.id) return new Map();

    // Get all message IDs in conversation
    const { data: messages } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId);

    if (!messages || messages.length === 0) return new Map();

    const messageIds = messages.map((m: { id: string }) => m.id);

    // Fetch attachments
    const { data: attachments } = await supabase
        .from("media_attachments")
        .select("message_id, storage_path, caption")
        .in("message_id", messageIds);

    if (!attachments || attachments.length === 0) return new Map();

    // Generate signed URLs for all attachments
    const result = new Map<string, { url: string; caption: string | null }[]>();

    for (const att of attachments as { message_id: string; storage_path: string; caption: string | null }[]) {
        const { data: signedUrl } = await supabase.storage
            .from("chat-attachments")
            .createSignedUrl(att.storage_path, 3600);

        if (signedUrl?.signedUrl) {
            const existing = result.get(att.message_id) || [];
            existing.push({ url: signedUrl.signedUrl, caption: att.caption });
            result.set(att.message_id, existing);
        }
    }

    return result;
}
```

---

## Phase 3: ChatThread UI — Attach & Display (~25 min)

### 3.1 Update `ChatMessage` interface

**File:** `src/components/ChatThread.tsx`

```ts
interface ChatMessage {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
    isMe: boolean;
    attachments?: { url: string; caption: string | null }[]; // NEW
}

interface ChatThreadProps {
    conversationId: string;
    currentUserId: string;
    otherAlias: string;
    initialMessages: ChatMessage[];
}
```

### 3.2 Add attachment button to input area

Beside the existing send button (line 230-258), add an attach button:

```tsx
{/* Input area */}
<div className="...">
    <div className="flex items-end gap-2">
        {/* NEW: Attach button */}
        <label
            className="flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center
                       justify-center rounded-full border border-[#E0D5C1]
                       bg-[#FEFCF8] text-muted transition-all
                       hover:bg-[#F4EFE6] hover:text-ink"
            title="Attach photo"
        >
            <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                disabled={sending}
            />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                 strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
        </label>

        <textarea ... /> {/* existing */}
        <button ... /> {/* existing send button */}
    </div>
</div>
```

### 3.3 Add file upload state and handler

```tsx
const [pendingFiles, setPendingFiles] = useState<File[]>([]);
const [uploadProgress, setUploadProgress] = useState(false);

const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 5) {
        alert("Maximum 5 images per message.");
        return;
    }

    // Validate size (5MB max each)
    const oversized = files.find(f => f.size > 5 * 1024 * 1024);
    if (oversized) {
        alert(`${oversized.name} is too large (max 5MB).`);
        return;
    }

    setPendingFiles(files);
    // Auto focus the input so user can add a caption message
    inputRef.current?.focus();
};
```

### 3.4 Add preview strip for pending files

Show thumbnails of selected files above the input:

```tsx
{pendingFiles.length > 0 && (
    <div className="mx-4 mb-2 flex gap-2 overflow-x-auto rounded-lg border
                    border-[#E0D5C1] bg-[#F4EFE6] p-2">
        {pendingFiles.map((file, i) => (
            <div key={i} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-16 w-16 rounded-md object-cover"
                />
                <button
                    onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 flex h-5 w-5 items-center
                               justify-center rounded-full bg-red-500 text-[10px]
                               text-white"
                >
                    ✕
                </button>
            </div>
        ))}
        <span className="self-center text-xs text-muted">
            {pendingFiles.length} photo{pendingFiles.length > 1 ? "s" : ""}
        </span>
    </div>
)}
```

### 3.5 Update `handleSend()` to upload files before sending

```tsx
const handleSend = async () => {
    if (!newMessage.trim() && pendingFiles.length === 0) return;
    if (sending) return;

    const content = newMessage.trim();
    setSending(true);
    setNewMessage("");

    let attachments: { storagePath: string; caption?: string }[] | undefined;

    // Upload pending files if any
    if (pendingFiles.length > 0) {
        setUploadProgress(true);
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        attachments = [];

        for (const file of pendingFiles) {
            const ext = file.name.split(".").pop() || "jpg";
            const path = `${currentUserId}/${conversationId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from("chat-attachments")
                .upload(path, file, {
                    contentType: file.type,
                    upsert: false,
                });

            if (!uploadError) {
                attachments.push({ storagePath: path });
            }
        }

        setPendingFiles([]);
        setUploadProgress(false);
    }

    // Optimistic message (no attachments shown until server confirms)
    const optimisticMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        senderId: currentUserId,
        content: content || "📷 Sent a photo",
        createdAt: new Date().toISOString(),
        isMe: true,
        // Show local previews as optimistic attachments
        attachments: pendingFiles.length > 0
            ? pendingFiles.map(f => ({ url: URL.createObjectURL(f), caption: null }))
            : undefined,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const result = await sendMessage(
        conversationId,
        content,
        attachments && attachments.length > 0 ? attachments : undefined
    );

    if (!result.success) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        setNewMessage(content);
    } else {
        router.refresh(); // Refresh to get real server data with signed URLs
    }

    setSending(false);
    inputRef.current?.focus();
};
```

### 3.6 Render attachments inline in message bubbles

In the message rendering loop (line 181-194), add attachment rendering after the text content:

```tsx
<div className="break-words whitespace-pre-wrap">{msg.content}</div>

{/* Attached images */}
{msg.attachments && msg.attachments.length > 0 && (
    <div className={`mt-2 grid gap-1.5 ${
        msg.attachments.length === 1 ? "grid-cols-1" : "grid-cols-2"
    }`}>
        {msg.attachments.map((att, idx) => (
            <a
                key={idx}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-lg"
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={att.url}
                    alt={att.caption || `Photo ${idx + 1}`}
                    className="max-h-[200px] w-full object-cover transition-transform hover:scale-105"
                    loading="lazy"
                />
            </a>
        ))}
    </div>
)}

<div className="...timestamp...">{formatTime(msg.createdAt)}</div>
```

---

## Phase 4: Inbox Page — Pass Attachments to ChatThread (~10 min)

### 4.1 Update `src/app/inbox/[id]/page.tsx`

The inbox page fetches messages and passes them as `initialMessages`. Update to also fetch attachments:

```ts
import { getConversationAttachments } from "@/app/actions/messaging";

// After fetching messages, fetch their attachments:
const attachmentMap = await getConversationAttachments(conversationId);

// Merge attachments into message objects:
const messagesWithAttachments = messages.map(msg => ({
    ...msg,
    attachments: attachmentMap.get(msg.id) || undefined,
}));
```

Pass `messagesWithAttachments` instead of `messages` to `<ChatThread>`.

### 4.2 Handle Realtime for new messages with attachments

In `ChatThread.tsx`'s Realtime subscription (lines 46-86), new messages from the other user arrive without attachment data. After receiving a new message via Realtime:

```tsx
// In the postgres_changes handler:
if (newMsg.sender_id !== currentUserId) {
    // Fetch attachments for this new message
    import("@/app/actions/messaging").then(({ getSignedAttachmentUrl }) => {
        // For now, just refresh to get full data
        router.refresh();
    });

    // Immediately show the message (without attachments)
    setMessages((prev) => [
        ...prev,
        {
            id: newMsg.id,
            senderId: newMsg.sender_id,
            content: newMsg.content,
            createdAt: newMsg.created_at,
            isMe: false,
            // Attachments will appear after router.refresh()
        },
    ]);
}
```

---

## Phase 5: Validation (~10 min)

### 5.1 Functional tests

1. Open a DM conversation
2. Click the attach/paperclip button → file picker opens
3. Select 1 photo (JPEG, <5MB) → preview shows above input
4. Type a message + press Send → photo uploads, message sends, photo displays inline
5. Select 3 photos → all show in preview strip, all show in message
6. Try 6 photos → error: "Maximum 5 images per message"
7. Try a file >5MB → error: "too large (max 5MB)"
8. Open the conversation on the OTHER user's account → photos visible to them
9. Remove a pending photo via ✕ button → preview updates correctly
10. Send a photo-only message (no text) → shows "📷 Sent a photo" text

### 5.2 Mobile test

At 390px viewport:
- Attach button doesn't overflow
- Preview strip scrolls horizontally
- Inline photos scale to max bubble width
- Touch target on attach button ≥44px

### 5.3 Build gate

```powershell
cmd /c "npx next build 2>&1"
```

Must pass with 0 errors.

### 5.4 Update documentation

**File:** `.agents/workflows/dev-nextsteps.md`

Add:
```markdown
## ✅ Task DM-1: DM Photo Attachments — DONE (YYYY-MM-DD)
- ✅ `chat-attachments` storage bucket (private, 5MB limit)
- ✅ `sendMessage()` expanded with optional `attachments` parameter
- ✅ `getConversationAttachments()` for loading signed URLs
- ✅ ChatThread UI: attach button, preview strip, inline display
- ✅ Signed URLs for recipient (conversation membership verified)
- ✅ Mobile responsive at 390px
```

**File:** `.agents/MASTER_SUPABASE.md`

Add to Storage section:
```markdown
| `chat-attachments` | Private | Signed URLs | DM image attachments. RLS: uploader can write to own folder, both conversation participants can read via signed URL. Max 5MB per file. |
```

---

## 🛑 HUMAN VERIFICATION GATE 🛑

**Present to Stephen for approval:**
1. Send a photo in a DM → it renders inline in the chat bubble
2. The other user sees the photo in their view
3. Preview strip shows selected photos before send
4. 5-photo and 5MB limits enforce correctly
5. Build passes clean

Await: "DM Photo Attachments Verified. Mark complete."
