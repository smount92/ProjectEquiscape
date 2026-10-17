import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { registryRoleOf } from "@/lib/auth";

export const metadata: Metadata = {
    title: "Moderators' guide · Registry Desk",
    robots: { index: false, follow: false },
};

/** The guide is one file in the repo (docs/guides), so the words live in one place. */
async function readGuide(): Promise<string | null> {
    try {
        return await readFile(path.join(process.cwd(), "docs", "guides", "registry-moderation.md"), "utf8");
    } catch {
        return null;
    }
}

const COMPONENTS: Components = {
    h1: ({ children }) => <h2 className="mt-0 mb-3 font-serif text-2xl font-bold text-foreground">{children}</h2>,
    h2: ({ children }) => <h3 className="mt-8 mb-2 font-serif text-xl font-bold text-forest">{children}</h3>,
    h3: ({ children }) => <h4 className="mt-6 mb-2 text-base font-bold text-foreground">{children}</h4>,
    p: ({ children }) => <p className="my-2 text-secondary-foreground">{children}</p>,
    ul: ({ children }) => <ul className="my-2 list-disc pl-6 text-secondary-foreground">{children}</ul>,
    ol: ({ children }) => <ol className="my-2 list-decimal pl-6 text-secondary-foreground">{children}</ol>,
    li: ({ children }) => <li className="my-1">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    code: ({ children }) => (
        <code className="rounded bg-muted px-1 py-0.5 text-[0.85em] text-foreground">{children}</code>
    ),
    hr: () => <hr className="my-6 border-input" />,
    // Site paths stay in the app; anything else opens in a new tab.
    a: ({ href: to, children }) =>
        to?.startsWith("/") ? (
            <Link href={to} className="font-semibold text-forest">
                {children}
            </Link>
        ) : (
            <a href={to ?? "#"} className="font-semibold text-forest" target="_blank" rel="noreferrer">
                {children}
            </a>
        ),
    table: ({ children }) => (
        <div className="my-3 overflow-x-auto rounded-lg border border-input">
            <table className="w-full border-collapse text-sm">{children}</table>
        </div>
    ),
    th: ({ children }) => (
        <th className="bg-muted px-3 py-2 text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {children}
        </th>
    ),
    td: ({ children }) => (
        <td className="border-t border-input px-3 py-2 align-top text-secondary-foreground">{children}</td>
    ),
};

/** The moderators' guide, on the Desk, for moderators and the owner. */
export default async function DeskGuidePage() {
    // Own role check as well as the Desk layout's: a page never trusts its frame.
    if (!(await registryRoleOf())) notFound();
    const guide = await readGuide();
    if (!guide) {
        return (
            <div role="alert" className="ledger-card text-secondary-foreground">
                The guide could not be opened just now. Please try again in a moment.
            </div>
        );
    }
    return (
        <article className="ledger-card max-w-[80ch]" aria-label="Moderators' guide">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
                {guide}
            </ReactMarkdown>
        </article>
    );
}
