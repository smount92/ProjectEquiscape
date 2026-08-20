/**
 * /shows/rules — the MHH Championship Series rulebook, public.
 *
 * THE NUMBERS ARE IMPORTED, NEVER TYPED: every threshold on this
 * page comes from the same constants the engines run on
 * (points.ts, cardIssuance.ts, titles.ts), so the published rules
 * cannot drift from the code that enforces them.
 *
 * Static public content — no auth, no flag gate (the program is
 * live; shows v4 ships results through it today).
 */

import Link from "next/link";

import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import {
    CARD_GATE,
    SEASON1_CARD_GATE,
    SEASON1_FINAL_SHOW_YEAR,
    STAKES_GATE,
} from "@/lib/shows/cardIssuance";
import {
    BEST_RESULTS_CAP,
    CHAMPIONSHIP_POINTS,
    MAX_ENTRIES_PER_OWNER_FOR_SIZE,
    MIN_EXHIBITORS_FOR_POINTS,
    POINTS_CAP,
} from "@/lib/shows/points";
import {
    CH_CARDS_REQUIRED,
    CH_JUDGES_REQUIRED,
    CH_SHOWS_REQUIRED,
    ROM_POINTS,
    STAR_THRESHOLDS,
    SUPERIOR_POINTS,
} from "@/lib/shows/titles";
import { showYearLabel } from "@/lib/shows/showYear";

export const metadata = {
    title: "Showing Rules — MHH Championship Series",
    description:
        "How MHH showing works: scoring, qualification cards, titles, standings, and fair-play rules for the Championship Series.",
};

function Rule({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
    return (
        <section className="ledger-card" aria-labelledby={`rule-${id}`}>
            <span className="ledger-tab" id={`rule-${id}`}>
                {title}
            </span>
            <div className="flex flex-col gap-3 text-[0.95rem] leading-relaxed text-foreground">
                {children}
            </div>
        </section>
    );
}

export default function ShowingRulesPage() {
    const season1Label = showYearLabel(SEASON1_FINAL_SHOW_YEAR);

    return (
        <ExplorerLayout noHeader>
            <PageMasthead
                icon="📜"
                title="Showing Rules"
                subtitle="The MHH Championship Series — how points, cards, and titles work"
                backHref="/shows"
                backLabel="Shows"
            />

            <div className="flex flex-col gap-6">
                <Rule id="short" title="The short version">
                    <p>
                        Enter MHH-qualifying photo shows. Placings earn <b>points</b> toward
                        season standings. A 1st or 2nd in a big-enough class mints a{" "}
                        <b>qualification card</b> that travels with the horse. Cards and career
                        points earn permanent <b>titles</b>. Cards are redeemed to enter the
                        annual <b>MHH Championship</b>.
                    </p>
                </Rule>

                <Rule id="show-year" title="The show year">
                    <p>
                        A show year runs <b>May 1 → April 30</b> and is named for the year it
                        starts in. Season standings, the best-results cap, and Championship
                        qualification all reset with it. Only shows with{" "}
                        <b>published results</b> count for anything — while a show is still in
                        review, nothing is final.
                    </p>
                </Rule>

                <Rule id="points" title="Points — first place is worth the class">
                    <p>
                        Winning a deep class should mean more than winning a walkover. So:{" "}
                        <b>1st place earns the number of entries in the class</b> (capped at{" "}
                        {POINTS_CAP}), and each place below earns one point less, never below 1.
                    </p>
                    <ul className="m-0 list-disc pl-6">
                        <li>Class of 3 → 1st pays 3 · 2nd pays 2 · 3rd pays 1</li>
                        <li>Class of 8 → 1st pays 8 · 2nd pays 7 · … · 6th pays 3</li>
                        <li>
                            Class of 25 → 1st pays {POINTS_CAP} (the cap) · 2nd pays{" "}
                            {POINTS_CAP - 1} · …
                        </li>
                    </ul>
                    <p>
                        A class needs at least <b>{MIN_EXHIBITORS_FOR_POINTS} different
                        exhibitors</b> to pay points — you can place, but you can&apos;t earn
                        points beating only yourself. And one exhibitor&apos;s entries grow a
                        class&apos;s payable size by at most{" "}
                        <b>{MAX_ENTRIES_PER_OWNER_FOR_SIZE}</b> — entering your whole herd in
                        one class doesn&apos;t raise what winning it is worth. Championship
                        callbacks add bonuses on top:{" "}
                        <b>section +{CHAMPIONSHIP_POINTS.section} · division +
                        {CHAMPIONSHIP_POINTS.division} · show +{CHAMPIONSHIP_POINTS.show}</b>.
                    </p>
                    <p>
                        Points belong to the <b>horse-and-owner pair</b> on the entry. If a
                        horse changes hands mid-season, the seller keeps the points they
                        campaigned and the buyer starts fresh — the horse&apos;s own record
                        carries both chapters.
                    </p>
                </Rule>

                <Rule id="cap" title={`The best-${BEST_RESULTS_CAP} cap`}>
                    <p>
                        Only a pair&apos;s <b>best {BEST_RESULTS_CAP} placement results</b>{" "}
                        count toward season standings. Entering everything, everywhere, is a
                        fine way to enjoy the hobby — but season awards measure quality, not
                        attendance. Championship bonuses always count on top of the cap.
                    </p>
                </Rule>

                <Rule id="cards" title="Qualification cards">
                    <p>
                        A <b>1st or 2nd place</b> in a qualifying class mints an MHH
                        Qualification Card — but only when the class was real competition:
                    </p>
                    <ul className="m-0 list-disc pl-6">
                        <li>
                            <b>Season 1 ({season1Label}):</b> at least{" "}
                            {SEASON1_CARD_GATE.entries} entries from{" "}
                            {SEASON1_CARD_GATE.exhibitors} exhibitors. This provision expires
                            April 30, {SEASON1_FINAL_SHOW_YEAR + 1}.
                        </li>
                        <li>
                            <b>From Season 2:</b> at least {CARD_GATE.entries} entries from{" "}
                            {CARD_GATE.exhibitors} exhibitors — permanent.
                        </li>
                        <li>
                            A class of <b>{STAKES_GATE.entries}+ entries from{" "}
                            {STAKES_GATE.exhibitors}+ exhibitors</b> mints a <b>STAKES</b> card
                            — the big win, rare by design.
                        </li>
                    </ul>
                    <p>
                        Every card is stamped with the field it beat (&quot;1st of 12 — 8
                        exhibitors&quot;), carries a public verification code anyone can check
                        at <span className="font-mono text-sm">/cards/[code]</span>, and{" "}
                        <b>travels with the horse</b> when it changes hands through Safe-Trade.
                        Scratched entries never pad a field. Cards are redeemed to enter the
                        annual Championship.
                    </p>
                </Rule>

                <Rule id="titles" title="Titles — permanent, for the horse's whole life">
                    <ul className="m-0 list-disc pl-6">
                        <li>
                            <b>CH — Champion:</b> {CH_CARDS_REQUIRED} cards from{" "}
                            {CH_SHOWS_REQUIRED} different shows under at least{" "}
                            {CH_JUDGES_REQUIRED} different judges.
                        </li>
                        <li>
                            <b>ROM — Register of Merit:</b> {ROM_POINTS} career points.
                        </li>
                        <li>
                            <b>SUP — Superior:</b> {SUPERIOR_POINTS} career points.
                        </li>
                    </ul>
                    <p>
                        Career points accumulate across every season with no cap — steady
                        quality gets there without ever being #1. Titles are granted
                        automatically when results publish, appear on the horse&apos;s
                        passport and Hoofprint, and are <b>never revoked</b> — a title, once
                        earned, is part of the horse&apos;s story, whoever owns it next.
                    </p>
                    <p>
                        Exhibitors earn <b>star grades</b> on career stable points (
                        {STAR_THRESHOLDS.map((t, i) => (
                            <span key={t.code}>
                                {i > 0 && " · "}
                                {"★".repeat(i + 1)} at {t.points}
                            </span>
                        ))}
                        ). <i>Star thresholds are provisional through Season 1 and may be
                        recalibrated before the first Championship.</i>
                    </p>
                </Rule>

                <Rule id="fair-play" title="Fair play">
                    <ul className="m-0 list-disc pl-6">
                        <li>
                            <b>Judges don&apos;t compete in their own ring.</b> A judge&apos;s
                            horses can&apos;t enter a show they judge — as owner or as
                            someone&apos;s handler. The entry form enforces this automatically.
                        </li>
                        <li>
                            <b>One breed-halter class per horse per show</b> — entering breed
                            halter declares what breed the model represents.
                        </li>
                        <li>
                            <b>Proxy showing is first-class.</b> Someone else may handle your
                            horse; points follow the owner on the entry.
                        </li>
                        <li>
                            Hosts can void cards and strike results for rule violations. A
                            voided card never counts toward anything.
                        </li>
                    </ul>
                </Rule>

                <Rule id="championship" title="The MHH Championship (June 2027)">
                    <p>
                        The season pyramid tops out at the annual <b>MHH Championship</b>:
                        entry by <b>card redemption</b>, a multi-judge panel, standards-based
                        certificates, and Top Tens. Full Championship rules publish before
                        Season 1 ends — everything you earn this season counts toward it.
                    </p>
                </Rule>

                <p className="text-center text-xs text-muted-foreground">
                    Rules current as of show year {season1Label}. The numbers on this page are
                    read from the same code that scores the shows.{" "}
                    <Link href="/shows" className="font-semibold text-forest hover:underline">
                        Back to Shows
                    </Link>
                </p>
            </div>
        </ExplorerLayout>
    );
}
