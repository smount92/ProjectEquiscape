"use client";

import ReactMarkdown from"react-markdown";
import remarkGfm from"remark-gfm";
import Link from"next/link";
import React from"react";
import { splitMentionSegments } from"@/lib/feed/mentionMatch";

/**
 * Linkify @mentions inside a run of plain text.
 *
 * `knownAliases` is optional and STRICTLY ADDITIVE: with it, a spaced
 * alias ("@black fox farm") links as one name instead of tagging
 * "@black" and leaving " fox farm" as prose. Without it — which is
 * every one of RichText's existing sitewide callers — the behaviour
 * is byte-for-byte the old one: `@"quoted names"` and bare `@handles`
 * link, everything else is text.
 */
function linkifyMentions(text: string, knownAliases: readonly string[]): React.ReactNode[] {
 return splitMentionSegments(text, knownAliases).map((segment, i) => {
 if (segment.type ==="text") return segment.value;
 return (
 <Link
 key={i}
 href={`/profile/${encodeURIComponent(segment.value)}`}
 className="font-semibold text-forest no-underline hover:underline"
 >
 @{segment.value}
 </Link>
 );
 });
}

export default function RichText({
 content,
 knownAliases = [],
}: {
 content: string;
 /** Real aliases appearing in this content, so multi-word names resolve. */
 knownAliases?: readonly string[];
}) {
 return (
 <div className="text-secondary-foreground break-words">
 <ReactMarkdown
 remarkPlugins={[remarkGfm]}
 components={{
 p: ({ children }) => {
 const processed = React.Children.map(children, (child) => {
 if (typeof child ==="string") {
 return <>{linkifyMentions(child, knownAliases)}</>;
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
