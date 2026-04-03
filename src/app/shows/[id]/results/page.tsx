import { getPublicShowResults } from "@/app/actions/shows";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

const MEDAL_MAP: Record<string, string> = {
    "1st": "🥇", "2nd": "🥈", "3rd": "🥉",
    HM: "🎗️",
    Champion: "🏆", "Reserve Champion": "🥈",
    "Grand Champion": "🏆", "Reserve Grand Champion": "🥈",
};

const RIBBON_COLOR_MAP: Record<string, string> = {
    "1st": "border-l-blue-500 bg-blue-50/50",
    "2nd": "border-l-red-500 bg-red-50/50",
    "3rd": "border-l-yellow-500 bg-yellow-50/50",
    "4th": "border-l-stone-300",
    "5th": "border-l-pink-500 bg-pink-50/50",
    "6th": "border-l-green-500",
    HM: "border-l-green-400",
    Champion: "border-l-blue-600 bg-blue-50",
    "Reserve Champion": "border-l-red-600 bg-red-50",
    "Grand Champion": "border-l-amber-500 bg-amber-50",
    "Reserve Grand Champion": "border-l-amber-400 bg-amber-50/50",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const data = await getPublicShowResults(id);

    if (!data) {
        return { title: "Show Results — Model Horse Hub" };
    }

    const placedCount = data.divisions.reduce((acc, d) => acc + d.classes.reduce((a, c) => a + c.results.length, 0), 0);

    return {
        title: `${data.event.name} Results — Model Horse Hub`,
        description: `View results from ${data.event.name}. ${data.totalEntries} entries across ${data.totalClasses} classes. ${placedCount} horses placed.`,
        openGraph: {
            title: `${data.event.name} Results — Model Horse Hub`,
            description: `View results from ${data.event.name}. ${data.totalEntries} entries across ${data.totalClasses} classes.`,
            type: "website",
        },
    };
}

export default async function PublicShowResultsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getPublicShowResults(id);

    if (!data) notFound();

    const { event, divisions, totalEntries, totalClasses } = data;

    const placedCount = divisions.reduce((acc, d) => acc + d.classes.reduce((a, c) => a + c.results.length, 0), 0);

    return (
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-8 text-center animate-fade-in-up">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-1.5 text-sm font-medium text-stone-600 shadow-sm">
                    📸 Show Results
                    {event.isSanctioned && (
                        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                            🏛️ NAMHSA Sanctioned
                        </span>
                    )}
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
                    {event.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-stone-500">
                    {event.date && <span>📅 {event.date}</span>}
                    <span>🎤 Hosted by @{event.host}</span>
                </div>

                {/* Stats */}
                <div className="mt-6 flex justify-center gap-8">
                    <div className="flex flex-col items-center">
                        <span className="text-2xl font-bold text-stone-900">{totalEntries}</span>
                        <span className="text-xs text-stone-500">Entries</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-2xl font-bold text-stone-900">{totalClasses}</span>
                        <span className="text-xs text-stone-500">Classes</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-2xl font-bold text-stone-900">{placedCount}</span>
                        <span className="text-xs text-stone-500">Placed</span>
                    </div>
                </div>
            </div>

            {/* Download CSV */}
            <div className="mb-8 flex justify-center animate-fade-in-up">
                <a
                    href={`/api/export/show-results/${event.id}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition-all hover:bg-stone-50 hover:shadow-md no-underline"
                >
                    📥 Download Results CSV
                </a>
            </div>

            {/* Results by Division → Class */}
            <div className="space-y-8 animate-fade-in-up">
                {divisions.map((division) => (
                    <div key={division.name} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                        {/* Division Header */}
                        <div className="border-b border-stone-100 bg-stone-50 px-6 py-3">
                            <h2 className="text-lg font-semibold text-stone-800">
                                📂 {division.name}
                            </h2>
                        </div>

                        {/* Classes */}
                        <div className="divide-y divide-stone-100">
                            {division.classes.map((cls) => (
                                <div key={`${division.name}-${cls.name}`} className="px-6 py-4">
                                    <h3 className="mb-3 text-sm font-bold text-stone-600">
                                        {cls.classNumber && (
                                            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-500">
                                                {cls.classNumber}
                                            </span>
                                        )}
                                        {cls.name}
                                    </h3>

                                    {cls.results.length === 0 ? (
                                        <p className="text-sm italic text-stone-400">No placements in this class</p>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {cls.results.map((result, idx) => (
                                                <div
                                                    key={`${cls.name}-${idx}`}
                                                    className={`flex items-center gap-3 rounded-lg border-l-[3px] px-4 py-2.5 transition-colors ${RIBBON_COLOR_MAP[result.placement] || "border-l-stone-200"}`}
                                                >
                                                    {/* Medal */}
                                                    <span className="text-lg">
                                                        {MEDAL_MAP[result.placement] || "🏅"}
                                                    </span>

                                                    {/* Thumbnail */}
                                                    {result.thumbnailUrl && (
                                                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-stone-100">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img
                                                                src={result.thumbnailUrl}
                                                                alt={result.horseName}
                                                                className="h-full w-full object-contain"
                                                                loading="lazy"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Name + Owner */}
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-semibold text-stone-800">
                                                            {result.horseName}
                                                        </span>
                                                        <span className="ml-2 text-sm text-stone-500">
                                                            by @{result.ownerAlias}
                                                        </span>
                                                    </div>

                                                    {/* Placing Badge */}
                                                    <span className="shrink-0 rounded-md bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-600">
                                                        {result.placement}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {divisions.length === 0 && (
                <div className="rounded-xl border border-stone-200 bg-white px-8 py-16 text-center shadow-sm">
                    <div className="mb-4 text-5xl">📋</div>
                    <h2 className="text-xl font-semibold text-stone-800">No Results Available</h2>
                    <p className="mt-2 text-stone-500">This show hasn&apos;t announced results yet, or no entries were placed.</p>
                </div>
            )}

            {/* Footer */}
            <footer className="mt-12 border-t border-stone-200 pt-6 text-center">
                <p className="text-sm text-stone-400">
                    Show results managed by{" "}
                    <Link href="/" className="font-medium text-stone-600 hover:text-stone-800">
                        Model Horse Hub
                    </Link>
                    {event.isSanctioned && " in partnership with NAMHSA"}
                </p>
                <p className="mt-2 text-xs text-stone-300">
                    <Link href={`/shows/${event.id}`} className="text-stone-400 hover:text-stone-600">
                        View full show details →
                    </Link>
                </p>
            </footer>
        </main>
    );
}
