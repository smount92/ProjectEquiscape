"use client";

import { useState } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  FAQ Data                                                           */
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
        a: "Yes! The core platform — including your stable, reference database, photo galleries, the Show Ring, and Hoofprint™ provenance — is completely free. No credit card required. We plan to offer optional premium features in the future, but the free tier will always be fully functional.",
    },
    {
        category: "Getting Started",
        q: "What do I need to sign up?",
        a: "Just an email address and a display alias (your public username). We don't require your real name, mailing address, or phone number.",
    },
    {
        category: "Getting Started",
        q: "Can I import my existing collection from a spreadsheet?",
        a: "Yes! Go to your Stable and click \"Import CSV.\" Upload your spreadsheet and we'll fuzzy-match each row against our 10,500+ reference database. You can review and confirm matches before importing.",
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
        a: "\"Public\" horses appear in the Show Ring and search results. \"Unlisted\" horses can be viewed via direct link but don't appear in search. \"Private\" horses are visible only to you. You control this per-horse from your stable.",
    },
    {
        category: "Privacy & Security",
        q: "How are my photos stored?",
        a: "Photos are stored in secure cloud storage and accessed via time-limited signed URLs. They cannot be hotlinked or scraped by third parties. Each URL expires and must be re-signed for access.",
    },

    // Hoofprint™
    {
        category: "Hoofprint™ Provenance",
        q: "What is Hoofprint™?",
        a: "Hoofprint™ is the first living provenance system for model horses. It creates a permanent digital identity for each horse — tracking ownership history, customization records, show results, and photos. Think of it as a CarFax for model horses.",
    },
    {
        category: "Hoofprint™ Provenance",
        q: "What happens when I sell or transfer a horse?",
        a: "When you transfer a horse, the entire Hoofprint™ history — ownership chain, show results, photos — travels with the horse to the new owner. Your financial vault data (prices, values) is NEVER transferred. The new owner gets the horse's story; your private data stays private.",
    },
    {
        category: "Hoofprint™ Provenance",
        q: "Can I delete Hoofprint™ records?",
        a: "Hoofprint™ provenance events are permanent by design. This is what makes them trustworthy — like a title history for a car. You can delete your account, but any provenance already transferred to another user's horse will remain.",
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
        a: "The Price Guide (\"The Blue Book\") aggregates real sale data from completed transactions on the platform. It helps collectors understand fair market values for 10,500+ reference models. Prices are based on actual sales, not estimates.",
    },

    // Shows & Community
    {
        category: "Shows & Community",
        q: "How do virtual photo shows work?",
        a: "Shows are hosted with themed classes, entry deadlines, and voting periods. You enter your horse, the community votes (or an expert judge places), and winners are announced. Results flow into your horse's Hoofprint™ automatically.",
    },
    {
        category: "Shows & Community",
        q: "Can I create my own show?",
        a: "Yes! Any registered user can host a virtual photo show with custom classes, timeframes, and judging methods (community voting or expert judging).",
    },
    {
        category: "Shows & Community",
        q: "What are Groups?",
        a: "Groups are collector communities within Model Horse Hub — like clubs. Join groups for your region, your collecting focus (Traditionals, Stablemates, resins), or any shared interest. Groups have their own discussion feeds, events, and member lists.",
    },

    // Account
    {
        category: "Your Account",
        q: "Can I delete my account?",
        a: "Yes, from your Settings page. Account deletion permanently removes all your collection data, photos, and private information. Hoofprint™ provenance records for horses already transferred to other users will remain, as they're part of the horse's history.",
    },
    {
        category: "Your Account",
        q: "Can I export my data?",
        a: "Yes. You can download your entire collection as a CSV file from your Dashboard at any time. Your data is yours.",
    },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FaqPage() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>("all");

    const categories = ["all", ...Array.from(new Set(FAQ_ITEMS.map((item) => item.category)))];

    const filteredItems =
        activeCategory === "all"
            ? FAQ_ITEMS
            : FAQ_ITEMS.filter((item) => item.category === activeCategory);

    const toggle = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <div className="static-page">
            <div className="static-page-inner animate-fade-in-up" style={{ maxWidth: "860px" }}>
                {/* Page Header */}
                <div className="static-page-header">
                    <h1>
                        Frequently Asked{" "}
                        <span className="text-gradient">Questions</span>
                    </h1>
                    <p className="static-page-lead">
                        Everything you need to know about Model Horse Hub.
                        Can&apos;t find your answer? <Link href="/contact">Contact us</Link>.
                    </p>
                </div>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-2 justify-center mb-12">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            className={`py-1 px-4 font-[var(--font-family)] text-sm font-semibold border border-edge rounded-full cursor-pointer transition-all whitespace-nowrap ${activeCategory === cat ? "text-white bg-forest !border-accent-primary" : "text-muted bg-[var(--color-bg-input)] hover:text-ink hover:border-forest"}`}
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
                <div className="flex flex-col gap-2">
                    {filteredItems.map((item, idx) => {
                        const isOpen = openIndex === idx;
                        return (
                            <div
                                key={`${item.category}-${idx}`}
                                className={`border rounded-lg overflow-hidden transition-colors ${isOpen ? "border-[rgba(44,85,69,0.3)]" : "border-edge"}`}
                            >
                                <button
                                    className="flex items-center justify-between w-full py-6 px-8 bg-[var(--color-bg-card)] border-none text-ink font-[var(--font-family)] text-base font-semibold text-left cursor-pointer transition-colors gap-4 hover:bg-[var(--color-bg-card-hover)]"
                                    onClick={() => toggle(idx)}
                                    aria-expanded={isOpen}
                                    id={`faq-q-${idx}`}
                                >
                                    <span>{item.q}</span>
                                    <svg
                                        className={`shrink-0 transition-transform ${isOpen ? "rotate-180 text-forest" : "text-muted"}`}
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
                                    <div className="px-8 pb-6 bg-[var(--color-bg-card)] animate-fade-in-up [&_p]:text-base [&_p]:text-text-secondary [&_p]:leading-[1.8] [&_p]:m-0" id={`faq-a-${idx}`}>
                                        <p>{item.a}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* CTA */}
                <div className="static-cta" style={{ marginTop: "var(--space-3xl)" }}>
                    <p>Still have questions?</p>
                    <Link href="/contact" className="btn btn-primary btn-lg" id="faq-cta-contact">
                        Contact Us
                    </Link>
                </div>
            </div>
        </div>
    );
}
