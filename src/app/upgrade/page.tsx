import { getUserTier } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import UpgradeButton from "@/components/UpgradeButton";
import StudioProButton from "@/components/StudioProButton";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import {
    BarChart3,
    Bot,
    Camera,
    CheckCircle,
    ClipboardList,
    FileText,
    Link2,
    Palette,
    PartyPopper,
    Sparkles,
    Tag,
    type LucideIcon,
} from "lucide-react";

export const metadata = {
    title: "Upgrade to MHH Pro — Model Horse Hub",
    description: "Unlock advanced analytics, expanded photo storage, and AI-powered collection reports.",
};

const PRO_FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
    {
        icon: BarChart3,
        title: "Blue Book PRO",
        description: "5-year historical price trends with interactive scatter plots",
    },
    {
        icon: Camera,
        title: "Photo Suite+",
        description: "Up to 30 extra detail photos per horse — close-ups, markings, and more",
    },
    {
        icon: FileText,
        title: "Smart Insurance Reports",
        description: "PDFs stamped with live Market Replacement Values from verified sales",
    },
    {
        icon: Bot,
        title: "Stablemaster AI",
        description: "Monthly AI-powered collection analysis delivered to your inbox",
    },
    {
        icon: Tag,
        title: "Printable Show Tags",
        description: "Generate cut-out PDF tags for your live show entries",
    },
    {
        icon: Sparkles,
        title: "Early Access & Priority Support",
        description: "Be first to try new features and get direct access to the MHH team",
    },
];

const STUDIO_FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
    {
        icon: Palette,
        title: "Artist Profile & Portfolio",
        description: "Public portfolio page showcasing your work and commission availability",
    },
    {
        icon: ClipboardList,
        title: "Commission Queue Manager",
        description: "Track commissions from inquiry to delivery with status workflows",
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
        description: "Blue Book PRO, Photo Suite+, Smart Insurance Reports, Stablemaster AI — all included",
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

    const tierLabel = tier === "pro" ? "Pro" : "Free";

    return (
        <ExplorerLayout noHeader>
            <PageMasthead
                icon="💎"
                title={tier === "pro" ? "You're on MHH Pro" : "Upgrade to MHH Pro"}
                subtitle={
                    tier === "pro"
                        ? "Thank you for supporting Model Horse Hub"
                        : "Take your collection management to the next level"
                }
            />
            {/* Success / Cancel banners */}
            {status === "success" && (
                <div className="animate-fade-in-up mb-8 rounded-xl border border-success/30 bg-success/10 p-6 text-center shadow-lg">
                    <PartyPopper className="mx-auto h-8 w-8 text-success" />
                    <h2 className="mt-2 text-xl font-bold text-success">Welcome to MHH Pro!</h2>
                    <p className="mt-1 text-sm text-secondary-foreground">
                        Your account has been upgraded. Log out and back in to activate all Pro features.
                    </p>
                </div>
            )}
            {status === "cancelled" && (
                <div className="animate-fade-in-up mb-8 rounded-xl border border-warning/30 bg-warning/10 p-6 text-center">
                    <p className="text-sm text-warning">Checkout was cancelled. No charges were made.</p>
                </div>
            )}

            {/* Current plan badge */}
            <div className="animate-fade-in-up mb-12 text-center">
                <p className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium text-secondary-foreground">
                    Current plan: <span className={tier === 'pro' ? 'font-bold text-warning' : 'font-bold'}>{tierLabel}</span>
                </p>
            </div>

            {/* Pricing cards — 3 columns */}
            <div className="animate-fade-in-up mx-auto grid max-w-[1100px] gap-6 md:grid-cols-3">
                {/* Free tier */}
                <div className="rounded-xl border border-input bg-card p-8 shadow-md">
                    <div className="mb-4">
                        <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Free</span>
                        <div className="mt-2 flex items-baseline gap-1">
                            <span className="text-3xl font-bold">$0</span>
                            <span className="text-sm text-muted-foreground">/forever</span>
                        </div>
                    </div>
                    <ul className="space-y-3">
                        {FREE_FEATURES.map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-sm">
                                <span className="mt-0.5 text-muted-foreground">✓</span>
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                    {tier === "free" && (
                        <div className="mt-6 rounded-lg bg-muted py-2 text-center text-sm font-semibold text-secondary-foreground">
                            Current Plan
                        </div>
                    )}
                </div>

                {/* Pro tier */}
                <div className="relative rounded-xl border-2 border-tier-gold/60 bg-card bg-gradient-to-br from-tier-gold/10 to-saddle/5 p-8 shadow-xl">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-tier-gold px-4 py-1 text-xs font-bold text-forest-dark shadow-md">
                        <Sparkles className="h-3 w-3" /> MOST POPULAR
                    </div>
                    <div className="mb-4">
                        <span className="text-sm font-semibold uppercase tracking-wider text-warning">Pro</span>
                        <div className="mt-2 flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-foreground">$5</span>
                            <span className="text-sm text-secondary-foreground">/month</span>
                        </div>
                    </div>
                    <ul className="space-y-3">
                        {PRO_FEATURES.map((feature) => (
                            <li key={feature.title} className="flex items-start gap-2 text-sm">
                                <feature.icon className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                                <div>
                                    <span className="font-semibold text-foreground">{feature.title}</span>
                                    <span className="text-secondary-foreground"> — {feature.description}</span>
                                </div>
                            </li>
                        ))}
                    </ul>

                    {tier === "pro" ? (
                        <div className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-success/10 py-2 text-center text-sm font-bold text-success">
                            <CheckCircle className="h-4 w-4" /> Active
                        </div>
                    ) : (
                        <div className="mt-6">
                            <UpgradeButton />
                        </div>
                    )}
                </div>

                {/* Studio Pro tier */}
                <div className="relative rounded-xl border-2 border-studio/60 bg-card bg-gradient-to-br from-studio/15 to-studio/5 p-8 shadow-xl">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-studio px-4 py-1 text-xs font-bold text-background shadow-md">
                        <Palette className="h-3 w-3" /> FOR ARTISTS
                    </div>
                    <div className="mb-4">
                        <span className="text-sm font-semibold uppercase tracking-wider text-studio">Studio Pro</span>
                        <div className="mt-2 flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-foreground">$10</span>
                            <span className="text-sm text-secondary-foreground">/month</span>
                        </div>
                    </div>
                    <ul className="space-y-3">
                        {STUDIO_FEATURES.map((feature) => (
                            <li key={feature.title} className="flex items-start gap-2 text-sm">
                                <feature.icon className="mt-0.5 h-4 w-4 shrink-0 text-studio" />
                                <div>
                                    <span className="font-semibold text-foreground">{feature.title}</span>
                                    <span className="text-secondary-foreground"> — {feature.description}</span>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-6">
                        <StudioProButton />
                    </div>
                </div>
            </div>

            {/* FAQ */}
            <div className="animate-fade-in-up mx-auto mt-16 max-w-[600px]">
                <h2 className="mb-6 text-center text-lg font-bold">Frequently Asked Questions</h2>
                <div className="space-y-4">
                    <div className="rounded-lg border border-input bg-card p-4">
                        <h3 className="font-semibold">Can I cancel anytime?</h3>
                        <p className="mt-1 text-sm text-secondary-foreground">
                            Yes! Cancel from your Stripe billing portal anytime. Your Pro features stay active until the end of the billing period.
                        </p>
                    </div>
                    <div className="rounded-lg border border-input bg-card p-4">
                        <h3 className="font-semibold">Will I lose my data if I downgrade?</h3>
                        <p className="mt-1 text-sm text-secondary-foreground">
                            Never. All your horses, photos, and provenance data are safe. Extra detail photos become view-only until you re-subscribe.
                        </p>
                    </div>
                    <div className="rounded-lg border border-input bg-card p-4">
                        <h3 className="font-semibold">What&apos;s the difference between Pro and Studio Pro?</h3>
                        <p className="mt-1 text-sm text-secondary-foreground">
                            Pro is for collectors — analytics, extra photos, insurance reports, and AI insights. Studio Pro adds artist tools: commission management, WIP portals, and permanent Hoofprint credit on every custom you create.
                        </p>
                    </div>
                    <div className="rounded-lg border border-input bg-card p-4">
                        <h3 className="font-semibold">Do you offer beta tester discounts?</h3>
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
