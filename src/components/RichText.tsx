"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import React from "react";

function linkifyMentions(text: string): React.ReactNode[] {
    const parts = text.split(/(@[a-zA-Z0-9_-]{3,30})/g);
    return parts.map((part, i) => {
        if (part.startsWith("@") && part.length > 1) {
            const alias = part.slice(1);
            return (
                <Link key={i} href={`/profile/${encodeURIComponent(alias)}`} className="mention-link">
                    {part}
                </Link>
            );
        }
        return part;
    });
}

export default function RichText({ content }: { content: string }) {
    return (
        <div className="activity-post-content">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    p: ({ children }) => {
                        const processed = React.Children.map(children, (child) => {
                            if (typeof child === "string") {
                                return <>{linkifyMentions(child)}</>;
                            }
                            return child;
                        });
                        return <p>{processed}</p>;
                    },
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
