"use client";

import { useState } from"react";
import Link from"next/link";

interface ShowHistoryRecord {
 horseName: string;
 horseId: string;
 showName: string;
 placing: string;
 ribbonColor: string | null;
 showDate: string;
}

interface ShowHistoryYear {
 year: number;
 records: ShowHistoryRecord[];
}

interface ShowHistoryWidgetProps {
 years: ShowHistoryYear[];
 totalShows: number;
 totalRibbons: number;
}

const RIBBON_EMOJI: Record<string, string> = {
"1st":"🥇",
"2nd":"🥈",
"3rd":"🥉",
 HM:"🎗️",
 Champion:"🏆",
"Reserve Champion":"🥈",
"Grand Champion":"🏆",
"Reserve Grand Champion":"🥈",
};

export default function ShowHistoryWidget({ years, totalShows, totalRibbons }: ShowHistoryWidgetProps) {
 const currentYear = new Date().getFullYear();
 const [expandedYear, setExpandedYear] = useState<number | null>(years.length > 0 ? years[0].year : null);

 if (years.length === 0) return null;

 // Summarize ribbon counts for a year
 const summarizeYear = (records: ShowHistoryRecord[]) => {
 const counts: Record<string, number> = {};
 for (const r of records) {
 const emoji = RIBBON_EMOJI[r.placing] ||"🏅";
 counts[emoji] = (counts[emoji] || 0) + 1;
 }
 return Object.entries(counts)
 .map(([emoji, count]) => `${emoji}×${count}`)
 .join("");
 };

 return (
 <details
 className="mt-6 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
 open
 >
 <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-2 text-base font-bold text-stone-900 select-none [&::-webkit-details-marker]:hidden">
 🎪 <span>Show Placings</span>
 <span className="text-stone-600 ml-auto text-xs font-normal">
 {totalRibbons} ribbons · {totalShows} shows
 </span>
 </summary>

 <div className="px-4 py-1 pb-2">
 {years.map(({ year, records }) => (
 <div key={year} className="mb-1">
 <button
 type="button"
 className={`text-stone-900 flex w-full cursor-pointer items-center gap-2 rounded-sm border-none bg-transparent px-2 py-2 text-sm font-semibold transition-colors hover:bg-stone-50 ${expandedYear === year ?"bg-stone-50" :""}`}
 onClick={() => setExpandedYear(expandedYear === year ? null : year)}
 >
 <span className="flex items-center gap-1">
 {year}
 {year === currentYear && (
 <span className="rounded-full bg-emerald-100 px-1.5 py-[1px] text-[0.6rem] font-bold tracking-wide text-[#22c55e] uppercase">
 Current
 </span>
 )}
 </span>
 <span className="text-stone-600 flex-1 text-right text-xs font-normal">
 {summarizeYear(records)}
 </span>
 <span className="text-stone-600 text-[0.8em]">{expandedYear === year ?"▾" :"▸"}</span>
 </button>

 {expandedYear === year && (
 <div className="py-1 pl-4">
 {records.map((record, i) => (
 <div key={i} className="flex items-center gap-2 py-1 text-sm">
 <span className="shrink-0 text-base">
 {RIBBON_EMOJI[record.placing] ||"🏅"}
 </span>
 <div className="flex min-w-0 flex-col">
 <Link
 href={`/community/${record.horseId}`}
 className="text-stone-900 overflow-hidden font-semibold text-ellipsis whitespace-nowrap no-underline hover:underline"
 >
 {record.horseName}
 </Link>
 <span className="text-stone-600 overflow-hidden text-xs text-ellipsis whitespace-nowrap">
 {record.showName} · {record.placing}
 </span>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 ))}
 </div>
 </details>
 );
}
