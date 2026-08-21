import { getUserTier, isPro } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchSupporterBadge, formatSupporterSince } from "@/lib/supporter";
import { redirect } from "next/navigation";
import Link from "next/link";
import UpgradeButton from "@/components/UpgradeButton";
import StudioProButton from "@/components/StudioProButton";
import SupporterButton from "@/components/SupporterButton";
import SupporterLedgerToggle from "@/components/SupporterLedgerToggle";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import {
    BarChart3,
    Bot,
    Camera,
    CheckCircle,
    ClipboardList,
    FileText,
    Lamp,
    Link2,
    Palette,
    PartyPopper,
    Sparkles,
    Tag,
    type LucideIcon,
} from "lucide-react";

// ── Supporter price display ──
// The amount + yearly interval live entirely in Stripe (STRIPE_SUPPORTER_PRICE_ID)
// — never hardcoded here. Dark ship: env unset → null → the Supporter card and
// its FAQ entry simply don't render. A misconfigured price id behaves the same.
// Tiny module-level memo so the upgrade page doesn't call Stripe on every view.
let supporterPriceCache: { key: string; label: string | null; at: number } | null = null;

async function getSupporterPriceLabel(): Promise<string | null> {
    const priceId = process.env.STRIPE_SUPPORTER_PRICE_ID;
    if (!priceId || !process.env.STRIPE_SECRET_KEY) return null;

    const ttl = supporterPriceCache?.label ? 10 * 60 * 1000 : 60 * 1000;
    if (supporterPriceCache?.key === priceId && Date.now() - supporterPriceCache.at < ttl) {
        return supporterPriceCache.label;
    }

    let label: string | null = null;
    try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: "2026-02-25.clover",
        });
        const price = await stripe.prices.retrieve(priceId);
        if (typeof price.unit_amount === "number" && price.currency) {
            const amount = price.unit_amount / 100;
            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: price.currency.toUpperCase(),
                minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
            }).format(amount);
            label = `${formatted}/${price.recurring?.interval ?? "year"}`;
        }
    } catch {
        label = null;
    }
    supporterPriceCache = { key: priceId, label, at: Date.now() };
    return label;
}

export const metadata = {
    title: "Upgrade to MHH Pro",
    description: "Sales-history charts, expanded photo storage and market-valued insurance reports — while every trust feature stays free.",
};

// Ordered by concrete value today (audit 2026-08: lead with what a
// collector uses this week; the analytics honestly described as
// growing with the market rather than "5-year trends" we don't have).
const PRO_FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
    {
        icon: Camera,
        title: "Photo Suite+",
        description: "Up to 30 extra detail photos per horse — close-ups, markings, and more",
    },
    {
        icon: Tag,
        title: "Printable Show Tags",
        description: "Generate cut-out PDF tags for your live show entries",
    },
    {
        icon: FileText,
        title: "Smart Insurance Reports",
        description: "PDFs stamped with Market Replacement Values from real completed sales",
    },
    {
        icon: Bot,
        title: "Monthly Stablemaster Report",
        description: "A monthly collection ledger — totals and Blue Book movers — delivered to your inbox",
    },
    {
        icon: BarChart3,
        title: "Blue Book PRO",
        description: "Sales-history charts on every reference page — built from real Hub sales, growing richer with every one logged",
    },
    {
        icon: Sparkles,
        title: "Early Access & Priority Support",
        description: "Be first to try new features and get direct access to the MHH team",
    },
];

const STUDIO_FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
    {
        icon: ClipboardList,
        title: "Unlimited Commission Bench",
        description:
            "Every studio is free to open, with up to 3 active commissions at a time — Studio Pro removes the cap entirely",
    },
    {
        icon: Camera,
        title: "WIP Photo Portal",
        description: "Share work-in-progress updates with clients — every brushstroke becomes provenance",
    },
    {
        icon: Link2,
        title: "Hoofprint Artist Credit",
        description: "Your name permanently linked to every custom you create via Hoofprint provenance",
    },
    {
        icon: BarChart3,
        title: "Everything in MHH Pro",
        description: "Blue Book PRO, Photo Suite+, Smart Insurance Reports, the Monthly Stablemaster Report — all included",
    },
];

const FREE_FEATURES = [
    "Unlimited horses in your stable",
    "Hoofprint provenance tracking",
    "Community Show Ring & social features",
    "Basic Price Guide (avg / median)",
    "5 standard LSQ photo angles per horse",
    "Standard insurance reports",
];

// ── The honest feature table ──
// One matrix, three columns, no asterisks. The first group is the
// house principle written as a table row: everything a collector or a
// buyer needs to TRUST a horse — its record, its condition, its
// provenance, its sale history — is ✓ ✓ ✓ and always will be. Pro buys
// power tools, not trust. Anything we can't honestly promise today
// doesn't get a row.
type MatrixCell = string | boolean;
const TIER_MATRIX: {
    group: string;
    note?: string;
    rows: { feature: string; free: MatrixCell; pro: MatrixCell; studio: MatrixCell }[];
}[] = [
    {
        group: "Trust & records",
        note: "Free for everyone, forever — these are the reason the Hub exists.",
        rows: [
            { feature: "Horses in your stable", free: "Unlimited", pro: "Unlimited", studio: "Unlimited" },
            { feature: "Hoofprint provenance & ownership history", free: true, pro: true, studio: true },
            { feature: "Verified show records & qualification cards", free: true, pro: true, studio: true },
            { feature: "Condition grades & flaw records", free: true, pro: true, studio: true },
            { feature: "Blue Book price guide (avg / median / range)", free: true, pro: true, studio: true },
            { feature: "Marketplace listings & Want List matchmaker", free: true, pro: true, studio: true },
            { feature: "Standard insurance report PDF", free: true, pro: true, studio: true },
            { feature: "Show Ring, barns, events & the Paddock", free: true, pro: true, studio: true },
        ],
    },
    {
        group: "Power tools",
        note: "What a subscription actually buys.",
        rows: [
            { feature: "Detail photos per horse", free: "5 angles", pro: "5 + 30", studio: "5 + 30" },
            { feature: "Blue Book PRO sales-history charts", free: false, pro: true, studio: true },
            { feature: "Market Replacement Values on insurance PDFs", free: false, pro: true, studio: true },
            { feature: "Printable cut-out show tags", free: false, pro: true, studio: true },
            { feature: "Monthly Stablemaster report by email", free: false, pro: true, studio: true },
            { feature: "Early access & priority support", free: false, pro: true, studio: true },
        ],
    },
    {
        group: "Studio tools",
        note: "For the artists who make the horses everyone else collects.",
        rows: [
            { feature: "Public artist profile & portfolio", free: true, pro: true, studio: true },
            { feature: "Commission queue manager (3 active free)", free: true, pro: true, studio: true },
            { feature: "Unlimited active commissions", free: false, pro: false, studio: true },
            { feature: "WIP photo portal for clients", free: true, pro: true, studio: true },
            { feature: "Hoofprint artist credit on every custom", free: false, pro: false, studio: true },
        ],
    },
];

function MatrixMark({ value }: { value: MatrixCell }) {
    if (value === true) {
        return (
            <span className="text-forest font-bold" title="Included">
                ✓<span className="sr-only">Included</span>
            </span>
        );
    }
    if (value === false) {
        return (
            <span className="text-muted-foreground" title="Not included">
                —<span className="sr-only">Not included</span>
            </span>
        );
    }
    return <span className="text-foreground text-xs font-semibold">{value}</span>;
}

export default async function UpgradePage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string }>;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?redirectTo=/upgrade");

    const tier = await getUserTier();
    const params = await searchParams;
    const status = params.status;

    const tierLabel = tier === "studio" ? "Studio Pro" : tier === "pro" ? "Pro" : "Free";

    // Supporter is orthogonal to tier — cosmetic recognition, gates nothing.
    const supporterPriceLabel = await getSupporterPriceLabel();
    const supporterBadge = supporterPriceLabel
        ? await fetchSupporterBadge(supabase, user.id)
        : { isSupporter: false, since: null, showInLedger: false };
    const supporterSinceLabel = formatSupporterSince(supporterBadge.since);

    return (
        <ExplorerLayout noHeader>
            <PageMasthead
                icon="💎"
                title={isPro(tier) ? (tier === "studio" ? "You're on Studio Pro" : "You're on MHH Pro") : "Upgrade to MHH Pro"}
                subtitle={
                    isPro(tier)
                        ? "Thank you for supporting Model Horse Hub"
                        : "Take your collection management to the next level"
                }
            />
            {/* Success / Cancel banners — ledger leaves with a rubber
                stamp, like every other receipt on the site. */}
            {status === "success" && (
                <div className="animate-fade-in-up ledger-card mb-8 text-center">
                    <PartyPopper className="text-forest mx-auto h-8 w-8" />
                    <h2 className="mt-2 font-serif text-xl font-bold">Welcome to MHH Pro</h2>
                    <p className="text-secondary-foreground mt-1 text-sm">
                        Your account has been upgraded. Log out and back in to activate all Pro features.
                    </p>
                    <span className="stamp mt-3 inline-block">Paid</span>
                </div>
            )}
            {status === "supporter-success" && (
                <div className="animate-fade-in-up ledger-card mb-8 text-center">
                    <Lamp className="mx-auto h-8 w-8 text-(--brass-dark)" />
                    <h2 className="mt-2 font-serif text-xl font-bold">The lights stay on. Thank you.</h2>
                    <p className="text-secondary-foreground mt-1 text-sm">
                        Your brass plaque will appear on your profile within a minute or two. It unlocks
                        nothing — and that&apos;s exactly the point.
                    </p>
                    <span className="stamp mt-3 inline-block">Supporter</span>
                </div>
            )}
            {status === "cancelled" && (
                <div className="animate-fade-in-up ledger-card mb-8 text-center">
                    <span className="stamp stamp-red inline-block">Cancelled</span>
                    <p className="text-secondary-foreground mt-3 text-sm">
                        Checkout was cancelled. No charges were made.
                    </p>
                </div>
            )}

            {/* Current plan — stamped, not badged */}
            <div className="animate-fade-in-up mb-6 flex items-center justify-center gap-2 text-center">
                <span className="text-muted-foreground font-serif text-[0.7rem] tracking-[0.18em] uppercase">
                    Current plan
                </span>
                <span className="stamp">{tierLabel}</span>
            </div>

            {/* The honest pitch — this hobby has watched its volunteer-run
                sites go dark; "keep the lights on" IS the product. */}
            <div className="animate-fade-in-up mx-auto mb-12 max-w-[640px] text-center">
                <p className="text-secondary-foreground text-sm leading-relaxed">
                    Pro is how the lights stay on. Everything that keeps this hobby safe and fair —
                    your stable, showing, provenance, condition records — is free for everyone,
                    forever. Pro adds the power-user toolkit, and every subscription pays the
                    hosting bills that keep Model Horse Hub independent and ad-free.
                </p>
            </div>

            {/* Pricing cards — 3 columns. Free and Studio are ledger
                leaves; Pro is the leather-and-brass panel, because it's
                the one being sold. The old tier-gold→saddle gradients
                were the last unconverted surface from the leather
                rollout. */}
            <div className="animate-fade-in-up mx-auto grid max-w-[1100px] items-start gap-6 md:grid-cols-3">
                {/* Free tier */}
                <div className="ledger-card h-full">
                    <span className="ledger-tab">Free</span>
                    <div className="mb-4 flex items-baseline gap-1">
                        <span className="text-forest font-serif text-3xl font-bold">$0</span>
                        <span className="text-muted-foreground text-sm">/forever</span>
                    </div>
                    <ul className="space-y-3">
                        {FREE_FEATURES.map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-sm">
                                <span className="text-forest mt-0.5 font-bold">✓</span>
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                    {tier === "free" && (
                        <div className="mt-6 text-center">
                            <span className="stamp">Current plan</span>
                        </div>
                    )}
                </div>

                {/* Pro tier — leather panel, brass plaque, engraved ink.
                    Text here rides the --leather-text ramp; default ink
                    is invisible on this material. */}
                <div
                    className="leather-panel stitched relative h-full p-8"
                    style={{ color: "var(--leather-text)" }}
                >
                    <div className="brass-plaque absolute -top-3 left-1/2 z-[1] inline-flex -translate-x-1/2 items-center gap-1 px-4 py-1 font-serif text-[0.7rem] font-bold tracking-[0.14em] uppercase">
                        <Sparkles className="h-3 w-3" /> Most popular
                    </div>
                    <div className="relative z-[1] mb-4 pt-2">
                        <span
                            className="font-serif text-[0.7rem] font-bold tracking-[0.18em] uppercase"
                            style={{ color: "var(--leather-text-muted)" }}
                        >
                            MHH Pro
                        </span>
                        <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-engraved-light font-serif text-3xl font-bold">$5</span>
                            <span className="text-sm" style={{ color: "var(--leather-text-soft)" }}>
                                /month
                            </span>
                        </div>
                    </div>
                    <ul className="relative z-[1] space-y-3">
                        {PRO_FEATURES.map((feature) => (
                            <li key={feature.title} className="flex items-start gap-2 text-sm">
                                <feature.icon className="mt-0.5 h-4 w-4 shrink-0 text-(--brass-hi)" />
                                <div>
                                    <span className="font-semibold">{feature.title}</span>
                                    <span style={{ color: "var(--leather-text-soft)" }}>
                                        {" "}
                                        — {feature.description}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>

                    {isPro(tier) ? (
                        <div className="relative z-[1] mt-6 text-center">
                            <span className="brass-plaque inline-flex items-center gap-1.5 px-4 py-1.5 font-serif text-[0.72rem] font-bold tracking-[0.14em] uppercase">
                                <CheckCircle className="h-3.5 w-3.5" /> Active
                            </span>
                        </div>
                    ) : (
                        <div className="relative z-[1] mt-6">
                            <UpgradeButton />
                        </div>
                    )}
                </div>

                {/* Studio Pro tier — a ledger leaf with the studio
                    thread, so the artist tier reads as a specialism
                    rather than a bigger Pro. */}
                <div
                    className="ledger-card h-full"
                    style={{ borderTopColor: "var(--color-studio)" }}
                >
                    <span
                        className="ledger-tab"
                        style={{ background: "linear-gradient(180deg, #7E5AB4, var(--color-studio))" }}
                    >
                        Studio Pro
                    </span>
                    <div className="mb-4 flex items-baseline gap-1">
                        <span className="text-studio font-serif text-3xl font-bold">$10</span>
                        <span className="text-muted-foreground text-sm">/month</span>
                    </div>
                    <ul className="space-y-3">
                        {STUDIO_FEATURES.map((feature) => (
                            <li key={feature.title} className="flex items-start gap-2 text-sm">
                                <feature.icon className="text-studio mt-0.5 h-4 w-4 shrink-0" />
                                <div>
                                    <span className="text-foreground font-semibold">{feature.title}</span>
                                    <span className="text-secondary-foreground"> — {feature.description}</span>
                                </div>
                            </li>
                        ))}
                    </ul>

                    {tier === "studio" ? (
                        <div className="mt-6 text-center">
                            <span className="stamp">Current plan</span>
                        </div>
                    ) : (
                        <div className="mt-6">
                            <StudioProButton />
                        </div>
                    )}
                </div>
            </div>

            {/* Supporter — "keep the lights on", cosmetic only. Renders ONLY
                when STRIPE_SUPPORTER_PRICE_ID is set and resolvable (dark
                ship). Deliberately quieter than the Pro card. */}
            {supporterPriceLabel && (
                <div className="animate-fade-in-up mx-auto mt-6 max-w-[1100px]">
                    <div className="ledger-card" style={{ borderTopColor: "var(--brass-dark)" }}>
                        <div className="flex flex-col items-center gap-6 md:flex-row">
                            <div
                                className="brass-plaque flex shrink-0 items-center gap-2 px-4 py-2 font-serif text-xs font-bold tracking-[0.14em] uppercase"
                                aria-hidden="true"
                            >
                                <Lamp className="h-4 w-4" /> Supporter
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <span className="font-serif text-[0.7rem] font-bold tracking-[0.18em] text-(--brass-dark) uppercase">
                                    Supporter — {supporterPriceLabel}
                                </span>
                                <p className="text-secondary-foreground mt-1 text-sm">
                                    Keeps the lights on. Unlocks nothing — the Hub stays free. Brass plaque on
                                    your profile, our eternal gratitude, and a line in the ledger if you want
                                    it.
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Annual, cancel anytime. Every feature stays free for everyone — that&apos;s
                                    the point.
                                </p>
                            </div>
                            <div className="w-full shrink-0 md:w-[280px]">
                                {supporterBadge.isSupporter ? (
                                    <div className="space-y-3">
                                        <div className="text-center">
                                            <span className="stamp inline-flex items-center gap-1.5">
                                                <CheckCircle className="h-3.5 w-3.5" /> Supporter
                                                {supporterSinceLabel ? ` since ${supporterSinceLabel}` : ""}
                                            </span>
                                        </div>
                                        <SupporterLedgerToggle initialListed={supporterBadge.showInLedger} />
                                    </div>
                                ) : (
                                    <SupporterButton priceLabel={supporterPriceLabel} />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* The honest feature table. A price page's job is to let
                someone work out whether to pay WITHOUT reading three
                marketing lists and guessing at the overlap — so: one
                matrix, and the trust rows sit at the top reading ✓ ✓ ✓
                because that is the house promise, not a tier. */}
            <div className="animate-fade-in-up mx-auto mt-16 max-w-[900px]">
                <section className="ledger-card">
                    <span className="ledger-tab">What each plan includes</span>

                    {/* The matrix scrolls in its own rail on a phone
                        rather than dragging the ledger leaf sideways. */}
                    <div className="-mx-2 overflow-x-auto px-2">
                        <table className="w-full min-w-[560px] border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th className="py-2 pr-3">Feature</th>
                                    <th className="w-[16%] py-2 text-center">Free</th>
                                    <th className="w-[16%] py-2 text-center">Pro</th>
                                    <th className="w-[16%] py-2 text-center">Studio</th>
                                </tr>
                            </thead>
                            {TIER_MATRIX.map((section) => (
                                <tbody key={section.group}>
                                    <tr>
                                        <td colSpan={4} className="pt-5 pb-1">
                                            <span className="text-forest font-serif text-[0.78rem] font-bold tracking-[0.16em] uppercase">
                                                {section.group}
                                            </span>
                                            {section.note && (
                                                <span className="text-muted-foreground block text-xs">
                                                    {section.note}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                    {section.rows.map((row) => (
                                        <tr key={row.feature}>
                                            <td className="py-2 pr-3">{row.feature}</td>
                                            <td className="py-2 text-center">
                                                <MatrixMark value={row.free} />
                                            </td>
                                            <td className="py-2 text-center">
                                                <MatrixMark value={row.pro} />
                                            </td>
                                            <td className="py-2 text-center">
                                                <MatrixMark value={row.studio} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            ))}
                        </table>
                    </div>
                </section>

                {/* The house principle, said plainly under the table it
                    describes. */}
                <div className="border-input bg-card/50 mt-6 rounded-lg border p-6 text-xs backdrop-blur-sm">
                    <p>
                        🤝 Trust is never a paid feature. A horse&apos;s show record, its condition and
                        flaw notes, its Hoofprint provenance and the Blue Book&apos;s real sale history
                        stay free for every collector — including the ones deciding whether to buy from
                        you. Paying for Pro must never make anyone else&apos;s horse look more
                        trustworthy than it is.
                    </p>
                </div>
            </div>

            {/* FAQ */}
            <div className="animate-fade-in-up mx-auto mt-16 max-w-[600px]">
                <h2 className="mb-6 text-center font-serif text-lg font-bold tracking-[0.08em] uppercase">
                    Frequently Asked Questions
                </h2>
                <div className="space-y-4">
                    <div className="ledger-card">
                        <h3 className="font-serif font-bold">Can I cancel anytime?</h3>
                        <p className="mt-1 text-sm text-secondary-foreground">
                            Yes! Cancel from your Stripe billing portal anytime. Your Pro features stay active until the end of the billing period.
                        </p>
                    </div>
                    <div className="ledger-card">
                        <h3 className="font-serif font-bold">Will I lose my data if I downgrade?</h3>
                        <p className="mt-1 text-sm text-secondary-foreground">
                            Never. All your horses, photos, and provenance data are safe. Extra detail photos become view-only until you re-subscribe.
                        </p>
                    </div>
                    <div className="ledger-card">
                        <h3 className="font-serif font-bold">What&apos;s the difference between Pro and Studio Pro?</h3>
                        <p className="mt-1 text-sm text-secondary-foreground">
                            Pro is for collectors — sales-history charts, extra detail photos, market-valued insurance reports and the monthly Stablemaster ledger. Studio Pro includes all of that and lifts the studio bench cap: every studio is free to open and carries up to three active commissions, Studio Pro carries as many as you can paint.
                        </p>
                    </div>
                    {supporterPriceLabel && (
                        <div className="ledger-card">
                            <h3 className="font-serif font-bold">What does Supporter unlock?</h3>
                            <p className="mt-1 text-sm text-secondary-foreground">
                                Nothing — on purpose. This hobby has watched platforms paywall their way into
                                irrelevance or vanish overnight, and we&apos;re not doing either. Supporter is
                                for people who want Model Horse Hub to still be here next year: the money keeps
                                the servers running, and every feature stays free for everyone. You get a brass
                                plaque on your profile, a line in the Supporters&apos; Ledger if you opt in, and
                                our genuine gratitude.
                            </p>
                        </div>
                    )}
                    <div className="ledger-card">
                        <h3 className="font-serif font-bold">Do you offer beta tester discounts?</h3>
                        <p className="mt-1 text-sm text-secondary-foreground">
                            Yes! Early supporters receive a promo code for 6 months free. Enter it at checkout to apply the discount automatically.
                        </p>
                    </div>
                </div>
            </div>

            {/* Back link */}
            <div className="mt-12 text-center">
                <Link href="/dashboard" className="text-sm text-muted-foreground no-underline hover:text-secondary-foreground">
                    ← Back to Dashboard
                </Link>
            </div>
        </ExplorerLayout>
    );
}
