"use client";

import { useState } from "react";
import Link from "next/link";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import AiDataPolicySection from "@/components/AiDataPolicySection";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/* FAQ Data */
/* ------------------------------------------------------------------ */

interface FaqItem {
    q: string;
    a: string | React.ReactNode;
    category: string;
}

const FAQ_ITEMS: FaqItem[] = [
    // Getting Started
    {
        category: "Getting Started",
        q: "Is Model Horse Hub really free?",
        a: "Yes! The core platform — including your stable, reference database, photo galleries, the Show Ring, and Hoofprint provenance — is completely free. No credit card required. We plan to offer optional premium features in the future, but the free tier will always be fully functional.",
    },
    {
        category: "Getting Started",
        q: "What do I need to sign up?",
        a: "Just an email address and a display alias (your public username). We don't require your real name, mailing address, or phone number.",
    },
    {
        category: "Getting Started",
        q: "Can I import my existing collection from a spreadsheet?",
        a: 'Yes! Go to your Stable and click "Import CSV." Upload your spreadsheet and we\'ll fuzzy-match each row against our 10,500+ reference database. You can review and confirm matches before importing.',
    },

    // Collection Management
    {
        category: "Your Collection",
        q: "What is the reference database?",
        a: "Our reference database contains 10,500+ entries: 7,000+ Breyer and Stone releases hand-verified from official catalogs, plus 3,500+ artist resins sourced from the Equine Resin Directory. When you add a horse, you search this database to auto-fill mold, manufacturer, scale, and year information.",
    },
    {
        category: "Your Collection",
        q: "Can I add a horse that's not in the reference database?",
        a: "Absolutely. You can skip the reference step and enter your horse as a custom entry. You can also suggest additions to our database from the Add Horse form.",
    },
    {
        category: "Your Collection",
        q: "What photo angles should I upload?",
        a: "We provide 5 dedicated LSQ (Live Show Quality) slots: Near-Side, Off-Side, Front/Chest, Hindquarters, and Belly/Maker's Mark. You can also upload unlimited extra detail photos for flaws, marks, or special features. The more angles, the better your horse's passport looks!",
    },
    {
        category: "Your Collection",
        q: "What is the Financial Vault?",
        a: "The Financial Vault is where you store purchase prices, estimated values, purchase dates, and insurance notes. This data is protected by row-level security — even our team cannot access it. It's completely private to you.",
    },

    // Privacy & Security
    {
        category: "Privacy & Security",
        q: "Can other users see my financial data?",
        a: "Absolutely not. Your purchase prices, estimated values, and insurance notes are locked behind cryptographic row-level security at the database level. Not even Model Horse Hub administrators can view this data. Only you can access your financial vault.",
    },
    {
        category: "Privacy & Security",
        q: "What does 'public' vs 'private' vs 'unlisted' mean?",
        a: '"Public" horses appear in the Show Ring and search results. "Unlisted" horses can be viewed via direct link but don\'t appear in search. "Private" horses are visible only to you. You control this per-horse from your stable.',
    },
    {
        category: "Privacy & Security",
        q: "How are my photos stored?",
        a: "Photos are stored in secure cloud storage and accessed via time-limited signed URLs. They cannot be hotlinked or scraped by third parties. Each URL expires and must be re-signed for access.",
    },

    // Hoofprint
    {
        category: "Hoofprint Provenance",
        q: "What is Hoofprint?",
        a: "Hoofprint is the first living provenance system for model horses. It creates a permanent digital identity for each horse — tracking ownership history, customization records, show results, and photos. Think of it as a CarFax for model horses.",
    },
    {
        category: "Hoofprint Provenance",
        q: "What happens when I sell or transfer a horse?",
        a: "When you transfer a horse, the entire Hoofprint history — ownership chain, show results, photos — travels with the horse to the new owner. Your financial vault data (prices, values) is NEVER transferred. The new owner gets the horse's story; your private data stays private.",
    },
    {
        category: "Hoofprint Provenance",
        q: "Can I delete Hoofprint records?",
        a: "Hoofprint provenance events are permanent by design. This is what makes them trustworthy — like a title history for a car. You can delete your account, but any provenance already transferred to another user's horse will remain.",
    },

    // Commerce
    {
        category: "Buying & Selling",
        q: "How does Safe-Trade work?",
        a: "Safe-Trade provides structured buy/sell coordination: you list a horse, receive offers, accept terms, and use PIN-based transfer to hand off the horse. Payment is handled between you and the buyer directly (PayPal, Venmo, etc.) — Model Horse Hub is not a payment processor.",
    },
    {
        category: "Buying & Selling",
        q: "Are seller ratings permanent?",
        a: "Yes. Transaction ratings cannot be edited or removed once submitted. This ensures trust integrity — every rating reflects a real interaction.",
    },
    {
        category: "Buying & Selling",
        q: "What is the Price Guide?",
        a: 'The Price Guide ("The Blue Book") aggregates real sale data from completed transactions on the platform. It helps collectors understand fair market values for 10,500+ reference models. Prices are based on actual sales, not estimates.',
    },
    {
        category: "Buying & Selling",
        q: "What are qualification cards, and can I verify one before I buy a horse?",
        a: "When a horse places in a Model Horse Hub show, it earns a qualification card — a permanent record that becomes part of the horse's Hoofprint and travels with it if it's ever sold (these are Model Horse Hub platform cards, built on NAMHSA-style class structures, not official NAMHSA/NAN paperwork). Every card has its own public verification page at a short link — anyone, including an anonymous buyer, can check that a card is real before money changes hands. Buying a horse with show history? Ask the seller for its card link.",
    },

    // Shows & Community
    {
        category: "Shows & Community",
        q: "How do virtual photo shows work?",
        a: "Shows are hosted with themed classes, entry deadlines, and voting periods. You enter your horse, the community votes (or an expert judge places), and winners are announced. Results flow into your horse's Hoofprint automatically.",
    },
    {
        category: "Shows & Community",
        q: "Can I host a live, in-person show?",
        a: "Yes. Open a show from /shows/host and choose the Live mode, and you get a full show-day toolkit: a one-click classlist builder from a NAMHSA-style template, entry and steward management, and a ring console you run right from your phone — record leg-tag placings table by table, run champion callbacks, and export NAMHSA-format results when you're done. No spreadsheets, no paper tally sheets.",
    },
    {
        category: "Shows & Community",
        q: "Can I host an online photo show?",
        a: "Yes. Choose the Online mode when you create your show, and entrants submit photos to your classes during the entry window. Judge it yourself, invite an outside judge, or open it to community voting. Results post automatically and flow straight into every entrant's Hoofprint.",
    },
    {
        category: "Shows & Community",
        q: "Can I create my own show?",
        a: "Yes! Any registered user can host a show — live or online — with custom classes, timeframes, and judging methods. Start from /shows/host and build your classlist in one click with a NAMHSA-style template, or customize it entirely from scratch.",
    },
    {
        category: "Shows & Community",
        q: "What are Groups?",
        a: "Groups are collector communities within Model Horse Hub — like clubs, for your region, your collecting focus (Traditionals, Stablemates, resins), or any shared interest. Every group has its own Notice Board: threaded discussions, dedicated channels, and pinned posts, so conversations stay organized instead of scattered across Facebook and Discord.",
    },

    // Account
    {
        category: "Your Account",
        q: "Can I delete my account?",
        a: "Yes, from your Settings page. Account deletion permanently removes all your collection data, photos, and private information. Hoofprint provenance records for horses already transferred to other users will remain, as they're part of the horse's history.",
    },
    {
        category: "Your Account",
        q: "Can I export my data?",
        a: "Yes, anytime — your data is never trapped here. Download your entire collection (horses, records, and qualification cards) as a CSV file, or generate PDF reports, right from your Dashboard. We also back up everything automatically every night. This hobby has been burned before — Model Horse Blab went dark for years, MH$P was hit by ransomware — so we built exports in from day one, and if we ever wind Model Horse Hub down, every user gets a real advance-notice export window first. Your data is yours, full stop.",
    },
];

const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.filter((item) => typeof item.a === "string").map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
            "@type": "Answer",
            text: item.a as string,
        },
    })),
};

/* ------------------------------------------------------------------ */
/* Component */
/* ------------------------------------------------------------------ */

export default function FaqPage() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>("all");

    const categories = ["all", ...Array.from(new Set(FAQ_ITEMS.map((item) => item.category)))];

    const filteredItems =
        activeCategory === "all" ? FAQ_ITEMS : FAQ_ITEMS.filter((item) => item.category === activeCategory);

    const toggle = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <ExplorerLayout
            title={
                <>
                    Frequently Asked <span className="text-forest">Questions</span>
                </>
            }
            description="Everything you need to know about Model Horse Hub."
        >
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
            <div className="animate-fade-in-up mx-auto max-w-[860px]">
                {/* Page Header */}
                <div className="mb-8">
                    <h1>
                        Frequently Asked <span className="text-forest">Questions</span>
                    </h1>
                    <p className="text-secondary-foreground mt-2 text-lg">
                        Everything you need to know about Model Horse Hub. Can&apos;t find your answer?{" "}
                        <Link href="/contact">Contact us</Link>.
                    </p>
                </div>

                {/* Category Filter */}
                <div className="mb-12 flex flex-wrap justify-center gap-2">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            className={`border-input cursor-pointer rounded-full border px-4 py-1 text-sm font-semibold whitespace-nowrap transition-all ${
                                activeCategory === cat
                                    ? "bg-forest !border-forest text-white"
                                    : "bg-card text-muted-foreground hover:border-forest hover:text-foreground"
                            }`}
                            onClick={() => {
                                setActiveCategory(cat);
                                setOpenIndex(null);
                            }}
                        >
                            {cat === "all" ? "All" : cat}
                        </button>
                    ))}
                </div>

                {/* FAQ Items */}
                <div className="flex flex-col gap-3">
                    {filteredItems.map((item, idx) => {
                        const isOpen = openIndex === idx;
                        return (
                            <div
                                key={`${item.category}-${idx}`}
                                className={`overflow-hidden rounded-lg border transition-colors ${
                                    isOpen ? "border-forest/30" : "border-input"
                                }`}
                            >
                                <button
                                    className="bg-card text-foreground flex w-full cursor-pointer items-center justify-between gap-4 rounded-lg border-none px-6 py-5 text-left text-base font-semibold transition-colors hover:bg-[var(--muted)]"
                                    onClick={() => toggle(idx)}
                                >
                                    <span>{item.q}</span>
                                    <svg
                                        className={`shrink-0 transition-transform ${
                                            isOpen ? "text-forest rotate-180" : "text-muted-foreground"
                                        }`}
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </button>
                                {isOpen && (
                                    <div
                                        className="animate-fade-in-up bg-card text-secondary-foreground rounded-lg px-6 pb-5 text-base leading-[1.8]"
                                        id={`faq-a-${idx}`}
                                    >
                                        <p>{item.a}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* AI, Data Collection, and Copyright Policy — full section */}
                <AiDataPolicySection />

                {/* CTA */}
                <div className="bg-card border-input mt-12 rounded-lg border text-center">
                    <p>Still have questions?</p>
                    <Button asChild variant="outline">
                        <Link href="/contact" id="faq-cta-contact">
                            Contact Us
                        </Link>
                    </Button>
                </div>
            </div>
        </ExplorerLayout>
    );
}
