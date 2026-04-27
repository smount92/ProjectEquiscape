"use client";

import ReactMarkdown from"react-markdown";
import remarkGfm from"remark-gfm";
import Link from"next/link";
import React from"react";

function linkifyMentions(text: string): React.ReactNode[] {
 // Match both @simple and @"quoted with spaces"
 const parts = text.split(/(@"[^"]{3,30}"|@[a-zA-Z0-9_-]{3,30})/g);
 return parts.map((part, i) => {
 if (part.startsWith("@") && part.length > 1) {
 // Strip quotes if present: @"My Alias" -> My Alias
 const alias = part.startsWith('@"') && part.endsWith('"') ? part.slice(2, -1) : part.slice(1);
 return (
 <Link
 key={i}
 href={`/profile/${encodeURIComponent(alias)}`}
 className="font-semibold text-forest no-underline hover:underline"
 >
 @{alias}
 </Link>
 );
 }
 return part;
 });
}

export default function RichText({ content }: { content: string }) {
 return (
 <div className="text-secondary-foreground break-words">
 <ReactMarkdown
 remarkPlugins={[remarkGfm]}
 components={{
 p: ({ children }) => {
 const processed = React.Children.map(children, (child) => {
 if (typeof child ==="string") {
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
