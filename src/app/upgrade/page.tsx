import { getUserTier } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import UpgradeButton from "@/components/UpgradeButton";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";

export const metadata = {
    title: "Upgrade to MHH Pro — Model Horse Hub",
    description: "Unlock advanced analytics, expanded photo storage, and AI-powered collection reports.",
};

const PRO_FEATURES = [
    {
        icon: "📊",
        title: "Blue Book PRO",
        description: "5-year historical price trends with interactive scatter plots",
    },
    {
        icon: "📸",
        title: "Photo Suite+",
        description: "Up to 30 extra detail photos per horse — close-ups, markings, and more",
    },
    {
        icon: "📄",
        title: "Smart Insurance Reports",
        description: "PDFs stamped with live Market Replacement Values from verified sales",
    },
    {
        icon: "🤖",
        title: "Stablemaster AI",
        description: "Monthly AI-powered collection analysis delivered to your inbox",
    },
    {
        icon: "🛡️",
        title: "Priority Support",
        description: "Direct access to the MHH team for account and feature requests",
    },
    {
        icon: "✨",
        title: "Early Access",
        description: "Be first to try new features before they hit the public release",
    },
];

const FREE_FEATURES = [
    "Unlimited horses in your stable",
    "Hoofprint™ provenance tracking",
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

    return (
        <ExplorerLayout title={tier === "pro" ? <>💎 You're on <span className="text-forest">MHH Pro</span></> : <>Upgrade to <span className="text-forest">MHH Pro</span></>} description={tier === "pro" ? "Thank you for supporting Model Horse Hub!" : "Take your collection management to the next level."}>
            {/* Success / Cancel banners */}
            {status === "success" && (
                <div className="animate-fade-in-up mb-8 rounded-xl border border-emerald-300 bg-stone-50radient-to-r from-emerald-50 to-teal-50 p-6 text-center shadow-lg">
                    <span className="text-3xl">🎉</span>
                    <h2 className="mt-2 text-xl font-bold text-emerald-800">Welcome to MHH Pro!</h2>
                    <p className="mt-1 text-sm text-emerald-600">
                        Your account has been upgraded. Log out and back in to activate all Pro features.
                    </p>
                </div>
            )}
            {status === "cancelled" && (
                <div className="animate-fade-in-up mb-8 rounded-xl border border-amber-300 bg-stone-50mber-50 p-6 text-center">
                    <p className="text-sm text-amber-700">Checkout was cancelled. No charges were made.</p>
                </div>
            )}

            {/* Header */}
            <div className="animate-fade-in-up mb-12 text-center">
                <h1 className="text-3xl font-bold tracking-tight">
                    {tier === "pro" ? (
                        <>💎 You&apos;re on <span className="text-forest">MHH Pro</span></>
                    ) : (
                        <>Upgrade to <span className="text-forest">MHH Pro</span></>
                    )}
                </h1>
                <p className="mt-3 text-base text-stone-600">
                    {tier === "pro"
                        ? "Thank you for supporting Model Horse Hub! Here's what's included in your plan."
                        : "Take your collection management to the next level with premium tools and AI insights."}
                </p>
                <p className="mt-2 inline-block rounded-full bg-stone-50tone-100 px-3 py-1 text-xs font-medium text-stone-600">
                    Current plan: <span className={tier === 'pro' ? 'font-bold text-amber-600' : 'font-bold'}>{tier === 'pro' ? '💎 Pro' : 'Free'}</span>
                </p>
            </div>

            {/* Pricing cards */}
            <div className="animate-fade-in-up mx-auto grid max-w-[800px] gap-6 md:grid-cols-2">
                {/* Free tier */}
                <div className="rounded-xl border border-stone-200 bg-white p-8 shadow-md">
                    <div className="mb-4">
                        <span className="text-sm font-semibold uppercase tracking-wider text-stone-500">Free</span>
                        <div className="mt-2 flex items-baseline gap-1">
                            <span className="text-3xl font-bold">$0</span>
                            <span className="text-sm text-stone-500">/forever</span>
                        </div>
                    </div>
                    <ul className="space-y-3">
                        {FREE_FEATURES.map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-sm">
                                <span className="mt-0.5 text-stone-500">✓</span>
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                    {tier === "free" && (
                        <div className="mt-6 rounded-lg bg-stone-50tone-100 py-2 text-center text-sm font-semibold text-stone-600">
                            Current Plan
                        </div>
                    )}
                </div>

                {/* Pro tier */}
                <div className="relative rounded-xl border-2 border-amber-400 bg-stone-50radient-to-br from-amber-50 to-orange-50 p-8 shadow-xl">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-stone-50radient-to-r from-amber-500 to-orange-500 px-4 py-1 text-xs font-bold text-white shadow-md">
                        ✨ RECOMMENDED
                    </div>
                    <div className="mb-4">
                        <span className="text-sm font-semibold uppercase tracking-wider text-amber-600">Pro</span>
                        <div className="mt-2 flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-stone-800">$5</span>
                            <span className="text-sm text-stone-600">/month</span>
                        </div>
                    </div>
                    <ul className="space-y-3">
                        {PRO_FEATURES.map((feature) => (
                            <li key={feature.title} className="flex items-start gap-2 text-sm">
                                <span className="mt-0.5">{feature.icon}</span>
                                <div>
                                    <span className="font-semibold text-stone-800">{feature.title}</span>
                                    <span className="text-stone-600"> — {feature.description}</span>
                                </div>
                            </li>
                        ))}
                    </ul>

                    {tier === "pro" ? (
                        <div className="mt-6 rounded-lg bg-stone-50merald-100 py-2 text-center text-sm font-bold text-emerald-700">
                            ✅ Active
                        </div>
                    ) : (
                        <div className="mt-6">
                            <UpgradeButton />
                        </div>
                    )}
                </div>
            </div>

            {/* FAQ */}
            <div className="animate-fade-in-up mx-auto mt-16 max-w-[600px]">
                <h2 className="mb-6 text-center text-lg font-bold">Frequently Asked Questions</h2>
                <div className="space-y-4">
                    <div className="rounded-lg border border-stone-200 bg-white p-4">
                        <h3 className="font-semibold">Can I cancel anytime?</h3>
                        <p className="mt-1 text-sm text-stone-600">
                            Yes! Cancel from your Stripe billing portal anytime. Your Pro features stay active until the end of the billing period.
                        </p>
                    </div>
                    <div className="rounded-lg border border-stone-200 bg-white p-4">
                        <h3 className="font-semibold">Will I lose my data if I downgrade?</h3>
                        <p className="mt-1 text-sm text-stone-600">
                            Never. All your horses, photos, and provenance data are safe. Extra detail photos become view-only until you re-subscribe.
                        </p>
                    </div>
                    <div className="rounded-lg border border-stone-200 bg-white p-4">
                        <h3 className="font-semibold">How does the Stablemaster AI work?</h3>
                        <p className="mt-1 text-sm text-stone-600">
                            On the 1st of each month, our AI analyzes your collection against market data and sends you a personalized report via email.
                        </p>
                    </div>
                </div>
            </div>

            {/* Back link */}
            <div className="mt-12 text-center">
                <Link href="/dashboard" className="text-sm text-stone-500 no-underline hover:text-stone-600">
                    ← Back to Dashboard
                </Link>
            </div>        </ExplorerLayout>
    );
}
