import type { Metadata } from "next";

import ClosingCta from "@/components/landing/ClosingCta";
import FiveRooms from "@/components/landing/FiveRooms";
import LandingHero from "@/components/landing/LandingHero";
import PlainTerms from "@/components/landing/PlainTerms";
import StatsStrap from "@/components/landing/StatsStrap";
import TheRecord from "@/components/landing/TheRecord";
import { getPublicStats } from "@/lib/stats/publicStats";

/**
 * The front door.
 *
 * Sells the five-room site (Stable · Shows · Market · Registry · The
 * Paddock) and the one thing no other model-horse platform has: a show
 * record a stranger can verify, tied to the horse rather than the owner.
 *
 * STAYS STATIC. Every read on this page goes through getPublicStats, which
 * uses the cookie-less anon client — no session lookup, so Next can render
 * and cache this page rather than rebuilding it per visitor. Do not add a
 * `createClient()` (SSR/cookies) call here: it would flip the whole route
 * to dynamic and put a database round trip in front of every first
 * impression and every Googlebot fetch.
 *
 * NUMBERS ARE READ, NEVER TYPED. The stats strap prints only what the
 * database confirmed; a failed or zero read is simply absent. There is no
 * member count because `users` is authenticated-only — no anon path exists
 * that would not need an RLS change.
 */

export const revalidate = 3600;

export const metadata: Metadata = {
    title: "Model Horse Hub — Catalog, Show and Sell Model Horses",
    description:
        "Inventory your model horse collection, enter and host photo and live shows in the MHH Championship Series, and buy or sell with a verified show record attached to the horse. Community-maintained reference catalog and a free Blue Book price guide.",
    alternates: { canonical: "/" },
    openGraph: {
        type: "website",
        siteName: "Model Horse Hub",
        title: "Model Horse Hub — Catalog, Show and Sell Model Horses",
        description:
            "One place to inventory a collection, campaign it, and sell out of it — with a show record a buyer can actually check, tied to the horse rather than the owner.",
        url: "/",
    },
    twitter: {
        card: "summary_large_image",
        title: "Model Horse Hub — Catalog, Show and Sell Model Horses",
        description:
            "A show record a buyer can actually check, tied to the horse rather than the owner. Plus the Registry and the free Blue Book price guide.",
    },
};

export default async function LandingPage() {
    const stats = await getPublicStats();

    return (
        <div className="overflow-x-hidden">
            <LandingHero />
            <FiveRooms />
            <TheRecord />
            <StatsStrap stats={stats} />
            <PlainTerms />
            <ClosingCta />
        </div>
    );
}
