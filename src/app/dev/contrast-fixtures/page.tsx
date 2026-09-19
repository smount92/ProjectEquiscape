import { notFound } from "next/navigation";

import AccomplishmentsSection from "@/components/passport/AccomplishmentsSection";
import PapersSection from "@/components/passport/PapersSection";
import PedigreeCard from "@/components/PedigreeCard";
import ShowRecordTimeline from "@/components/ShowRecordTimeline";
import type { PaperView } from "@/app/actions/papers";
import type { AccomplishmentView } from "@/app/actions/accomplishments";
import { PARCHMENT_INK } from "@/lib/theme/parchment";

/**
 * Contrast fixtures — the passport's small areas, every variant on one
 * page, with made-up data. The contrast audit (scripts/contrast,
 * e2e/contrast.spec.ts) reads this page in every theme, so a chip that
 * only appears on a NAN-qualified, host-verified, scored record still
 * gets measured on every run.
 *
 * Not a real route: 404 in production unless E2E fixtures are switched
 * on. Nothing here touches the database.
 */

export const dynamic = "force-dynamic";

const HORSE = "22222222-2222-4222-8222-222222222222";
const SVG =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='420'><rect width='600' height='420' fill='#f3e9d2'/><rect x='30' y='30' width='540' height='360' fill='none' stroke='#8a6a3a' stroke-width='6'/><text x='300' y='200' font-size='40' text-anchor='middle' fill='#5a3d1a' font-family='serif'>NAN CARD 2025</text></svg>`,
    );

const papers: PaperView[] = [
    {
        id: "p1",
        horseId: HORSE,
        kind: "qualification_card",
        title: "Qualification card — Sunshine Live 2025",
        issuedBy: "Sunshine Live",
        issuedOn: "2025-06-14",
        notes: null,
        mime: "image/svg+xml",
        url: SVG,
        byteSize: 1200,
        isPublic: true,
        createdAt: "2026-09-19T00:00:00Z",
        showRecordId: "r1",
        accomplishmentId: null,
    },
    {
        id: "p2",
        horseId: HORSE,
        kind: "breeding_certificate",
        title: "Breeding certificate — Winter Wonderland",
        issuedBy: "Starrfyre",
        issuedOn: "2014-03-01",
        notes: "Sire's page: https://www.starrfyre.com/rds/sdlist/hanoverians/winter_wonderland.htm",
        mime: "application/pdf",
        url: "about:blank",
        byteSize: 240_000,
        isPublic: false,
        createdAt: "2026-09-19T00:00:00Z",
        showRecordId: null,
        accomplishmentId: "a1",
    },
];

const base = {
    showId: null,
    division: "Open",
    className: "Performance — Western Pleasure",
    judgeName: "J. Example",
    notes: null,
    showLocation: "Orlando, FL",
    sectionName: null,
    awardCategory: null,
    competitionLevel: null,
    showDateText: null,
};

const records = [
    {
        ...base,
        id: "r1",
        showName: "Sunshine Live 2025",
        showDate: "2025-06-14",
        placing: "1st",
        ribbonColor: "blue",
        isNan: true,
        verificationTier: "host_verified",
        qualifierProgram: "nan",
        qualifierCard: "blue",
        qualifierYear: 2025,
        qualifierCardId: "NAN-2025-00412",
        notes: "Card scanned; see https://example.org/sunshine-live for the full results.",
    },
    {
        ...base,
        id: "r2",
        showName: "Summerween Online",
        showDate: "2025-08-30",
        placing: "Grand Champion",
        ribbonColor: "grand champion",
        isNan: false,
        verificationTier: "platform_generated",
        scoreTotal: 87,
        entryPhotoUrl: SVG,
        sectionName: "Customs",
        awardCategory: "Overall",
        competitionLevel: "regional",
    },
    {
        ...base,
        id: "r3",
        showName: "Brookside Spring Fling",
        showDate: null,
        showDateText: "Spring 2024",
        placing: "3rd",
        ribbonColor: "yellow",
        isNan: false,
        verificationTier: "self_reported",
    },
];

const items: AccomplishmentView[] = [
    {
        id: "a1",
        horseId: HORSE,
        kind: "racing",
        organization: "Express",
        title: "Autumn Classic (6 furlongs)",
        result: "2nd of 9",
        happenedOn: "2024-05-18",
        dateText: null,
        detail: "Ran from post 4, closed late. Chart at https://example.org/charts/autumn-classic",
        linkUrl: "https://example.org/results",
        isPublic: true,
        createdAt: "2026-09-19T00:00:00Z",
    },
    {
        id: "a2",
        horseId: HORSE,
        kind: "award",
        organization: "FTRA",
        title: "Year-end high point — 3yo fillies",
        result: null,
        happenedOn: null,
        dateText: "2023 season",
        detail: null,
        linkUrl: null,
        isPublic: false,
        createdAt: "2026-09-19T00:00:00Z",
    },
];

const pedigree = {
    id: "pg1",
    sireName: "Winter Wonderland",
    damName: "Starlight Edition",
    sireId: null,
    damId: null,
    sculptor: "Brigitte Eberl",
    castNumber: "12",
    editionSize: "25",
    lineageNotes: "Bred by Starrfyre. Sire's record: https://www.starrfyre.com/rds/sdlist/hanoverians/winter_wonderland.htm",
    sireUrl: "https://www.starrfyre.com/rds/sdlist/hanoverians/winter_wonderland.htm",
    damUrl: "https://www.starrfyre.com/rds/sdlist/quarter_horses/starlight_edition.htm",
    bredBy: "Starrfyre",
};

const labels: Record<string, string> = { r1: "Sunshine Live 2025", a1: "Autumn Classic (6 furlongs)" };

export default async function ContrastFixtures({ searchParams }: { searchParams: Promise<{ owner?: string }> }) {
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_E2E_FIXTURES !== "1") notFound();
    const sp = await searchParams;
    const isOwner = sp.owner === "1";
    const placingHrefs = isOwner ? { r2: "/shows/placing/example" } : undefined;
    return (
        <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6" data-testid="contrast-fixtures">
            <h1 className="m-0 text-xl">Contrast fixtures — {isOwner ? "owner view" : "visitor view"}</h1>
            <ShowRecordTimeline horseId={HORSE} records={records} isOwner={isOwner} placingHrefs={placingHrefs} papers={papers} horseName="Brooksong" />
            <AccomplishmentsSection horseId={HORSE} horseName="Brooksong" items={items} papers={papers} isOwner={isOwner} />
            <PedigreeCard horseId={HORSE} pedigree={pedigree} isOwner={isOwner} />
            <PapersSection horseId={HORSE} horseName="Brooksong" papers={papers} isOwner={isOwner} attachedLabels={labels} />

            {/* The same sections on LIT PAPER — the passport column stays cream at
                night, and text that inherits body's colour must be re-inked there. */}
            <div className="lit-paper flex flex-col gap-6 rounded-lg p-4" style={{ background: "var(--paper-lit)" }} data-testid="fixtures-lit-paper">
                <h2 className="m-0 text-lg">On lit paper</h2>
                <ShowRecordTimeline horseId={HORSE} records={records} isOwner={isOwner} placingHrefs={placingHrefs} papers={papers} horseName="Brooksong" />
                <AccomplishmentsSection horseId={HORSE} horseName="Brooksong" items={items} papers={papers} isOwner={isOwner} />
            </div>

            {/* …and on the tan parchment card (PARCHMENT_INK pins the inks inline). */}
            <div className="flex flex-col gap-3 rounded-3xl border border-input bg-[#C8B596] px-6 py-8" style={PARCHMENT_INK} data-testid="fixtures-parchment">
                <h2 className="m-0 text-lg">On parchment</h2>
                <p className="text-secondary-foreground m-0 text-sm">Secondary ink on the tan card.</p>
                <p className="text-muted-foreground m-0 text-xs">Muted ink on the tan card · 3 more cards</p>
                <a href="#top" className="text-forest text-sm font-semibold">A forest link on the tan card ↗</a>
                <span className="text-warning text-xs font-bold">⭐ NAN</span>
                <span className="text-success text-xs font-bold">🛡️ MHH Verified</span>
                <span className="text-destructive text-xs font-bold">Overdue</span>
            </div>
        </div>
    );
}
