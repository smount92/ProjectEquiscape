"use client";

import { useState } from "react";
import { createTextPost } from "@/app/actions/activity";
import { useRouter } from "next/navigation";

export default function FeedComposeBar() {
    const [text, setText] = useState("");
    const [isPosting, setIsPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handlePost = async () => {
        if (!text.trim()) return;
        setIsPosting(true);
        setError(null);

        const result = await createTextPost(text);
        if (result.success) {
            setText("");
            router.refresh(); // Refresh feed with new post
        } else {
            setError(result.error || "Failed to post.");
        }
        setIsPosting(false);
    };

    return (
        <div className="feed-compose-bar">
            <textarea
                className="form-textarea feed-compose-input"
                placeholder="Share an update with the community…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                rows={2}
            />
            <div className="feed-compose-footer">
                <span className="feed-compose-count">
                    {text.length}/500
                </span>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={handlePost}
                    disabled={isPosting || !text.trim()}
                >
                    {isPosting ? "Posting…" : "📝 Post"}
                </button>
            </div>
            {error && <p className="form-error" style={{ marginTop: "var(--space-xs)" }}>{error}</p>}
        </div>
    );
}
