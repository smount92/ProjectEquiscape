/**
 * Bulk show results from a spreadsheet (suggestion box, 2026-09-20: a
 * member with horses carrying 20, 50 and 100+ placings).
 *
 * The hobby's own results format is "class name, class size, then the
 * placings in order" (NAMHSA's results spec); entrants keep the rest —
 * show, date, judge, division, section, card — in their own sheets, in
 * their own words. So: one template with every field a record can hold,
 * only show name and placing required, everything else imported blank
 * when blank. Parsing is forgiving on purpose: European dates, "1st" or
 * "1" or "Blue", "photo" or "P".
 *
 * Pure: no I/O. The action re-runs this on the server before writing.
 */
import { isQualifierProgram, programInfo, type QualifierProgram } from "@/lib/records/qualifiers";

export interface TemplateColumn {
    /** Header text in the CSV, matched case- and punctuation-insensitively. */
    header: string;
    key: keyof ImportedRecord;
    required?: boolean;
    example: string;
    help: string;
}

/** The template, in order. The example row is what the download shows. */
export const TEMPLATE_COLUMNS: readonly TemplateColumn[] = [
    { header: "Show name", key: "showName", required: true, example: "Spring Fling Live 2024", help: "As printed on the results." },
    { header: "Show date", key: "showDate", example: "23/03/2024", help: "23/03/2024, 23.03.2024, 2024-03-23, March 2024 or just 2024 all work." },
    { header: "Photo or live", key: "showType", example: "live", help: "photo or live (P / L). Blank = photo." },
    { header: "Show series", key: "sanctioningBody", example: "NAMHSA", help: "NAMHSA, OMHPS, MEPSA, a club — or blank." },
    { header: "Division", key: "division", example: "Halter", help: "Halter, Performance, Workmanship, Collectibility, Fun…" },
    { header: "Section", key: "sectionName", example: "OF Breyer Traditional", help: "OF Breyer, OF Stone, CM, AR, Mini, Trad — whatever the show called it." },
    { header: "Class", key: "className", example: "Stock Horse Mare", help: "The class name, or its number if that is all you have." },
    { header: "Placing", key: "placing", required: true, example: "1st", help: "1, 1st, First, Blue, Champion, Reserve, HM, Top 5, Participant…" },
    { header: "Class size", key: "classSize", example: "12", help: "Models in the class. Leave blank if unknown." },
    { header: "Award", key: "awardCategory", example: "", help: "Champion, Reserve Champion, Grand, Supreme, Section Champion — beyond the placing itself." },
    { header: "Level", key: "competitionLevel", example: "", help: "Novice, Open, Youth, Pro — if the show ran levels." },
    { header: "Judge", key: "judgeName", example: "", help: "The judge's name if known." },
    { header: "Location", key: "showLocation", example: "Warsaw, PL", help: "City, venue or online host." },
    { header: "Card program", key: "qualifierProgram", example: "", help: "NAN or OMEQ if the placing earned a qualification card; blank otherwise." },
    { header: "Card color", key: "qualifierCard", example: "", help: "NAN: green (breed / halter), yellow (collectibility / workmanship), pink (performance). OMEQ: blue / orange / purple." },
    { header: "Card year", key: "qualifierYear", example: "", help: "The year on the card. Blank = the show's year." },
    { header: "Card id", key: "qualifierCardId", example: "", help: "The number printed on the card, if any." },
    { header: "Notes", key: "notes", example: "", help: "Anything else worth keeping with the placing." },
];

export const IMPORT_MAX_ROWS = 500;
export const TEMPLATE_PATH = "/templates/mhh_show_results_template.csv";

export interface ImportedRecord {
    showName: string;
    showDate: string | null;
    /** Kept when the date could not be read exactly, so it still shows. */
    showDateText: string | null;
    showType: "photo" | "live";
    sanctioningBody: string | null;
    division: string | null;
    sectionName: string | null;
    className: string | null;
    placing: string;
    ribbonColor: string | null;
    classSize: number | null;
    awardCategory: string | null;
    competitionLevel: string | null;
    judgeName: string | null;
    showLocation: string | null;
    qualifierProgram: QualifierProgram | null;
    qualifierCard: string | null;
    qualifierYear: number | null;
    qualifierCardId: string | null;
    notes: string | null;
}

export interface ImportRowProblem {
    rowNumber: number;
    message: string;
}

export interface ImportParseResult {
    records: { rowNumber: number; record: ImportedRecord }[];
    problems: ImportRowProblem[];
    /** Headers in the file that matched no template column (reported, not fatal). */
    unknownHeaders: string[];
    /** Template columns missing from the file (only fatal when required). */
    missingHeaders: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Header aliases people actually type, on top of the template's own. */
const HEADER_ALIASES: Record<string, keyof ImportedRecord> = {
    show: "showName", "show name": "showName", event: "showName",
    date: "showDate", "show date": "showDate", when: "showDate",
    "photo or live": "showType", type: "showType", "show type": "showType", "photo live": "showType", format: "showType",
    "show series": "sanctioningBody", series: "sanctioningBody", sanctioning: "sanctioningBody", "sanctioning body": "sanctioningBody", organisation: "sanctioningBody", organization: "sanctioningBody",
    division: "division", "division section": "division",
    section: "sectionName", "section name": "sectionName",
    class: "className", "class name": "className", "class number": "className",
    placing: "placing", placement: "placing", place: "placing", result: "placing", ribbon: "placing",
    "class size": "classSize", entries: "classSize", "number of entries": "classSize", "of entries": "classSize", "no of entries": "classSize", "entries in class": "classSize", "in class": "classSize", "size of class": "classSize", of: "classSize", "out of": "classSize",
    award: "awardCategory", championship: "awardCategory", champion: "awardCategory",
    level: "competitionLevel", "competition level": "competitionLevel",
    judge: "judgeName", "judge name": "judgeName",
    location: "showLocation", venue: "showLocation", "place of show": "showLocation", "show location": "showLocation", where: "showLocation",
    "card program": "qualifierProgram", program: "qualifierProgram", card: "qualifierProgram", "nan omhps": "qualifierProgram", "nan card": "qualifierProgram",
    "card color": "qualifierCard", "card colour": "qualifierCard", colour: "qualifierCard", color: "qualifierCard",
    "card year": "qualifierYear",
    "card id": "qualifierCardId", "card number": "qualifierCardId", "ticket number": "qualifierCardId",
    notes: "notes", note: "notes", comments: "notes",
};

export function matchHeader(header: string): keyof ImportedRecord | null {
    const n = norm(header);
    if (!n) return null;
    const exact = TEMPLATE_COLUMNS.find((c) => norm(c.header) === n);
    if (exact) return exact.key;
    return HEADER_ALIASES[n] ?? null;
}

const MONTHS: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
    jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function iso(y: number, m: number, d: number): string | null {
    if (y < 1950 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * A date the way people write it: ISO, European day-first (the member
 * who asked is in Poland), a month name, or a bare year. Returns the
 * exact date when it can, otherwise a fuzzy text plus a sort year.
 */
export function parseShowDate(raw: string): { showDate: string | null; showDateText: string | null; ok: boolean } {
    const t = raw.trim();
    if (!t) return { showDate: null, showDateText: null, ok: true };
    let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) {
        const d = iso(+m[1], +m[2], +m[3]);
        return d ? { showDate: d, showDateText: null, ok: true } : { showDate: null, showDateText: t, ok: false };
    }
    m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) {
        // Day-first unless that is impossible (13/05 is a day; 05/13 must be US).
        const a = +m[1], b = +m[2], y = +m[3];
        const d = a > 12 ? iso(y, b, a) : b > 12 ? iso(y, a, b) : iso(y, b, a);
        return d ? { showDate: d, showDateText: null, ok: true } : { showDate: null, showDateText: t, ok: false };
    }
    m = t.match(/^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$/i) ?? t.match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i);
    if (m) {
        const dayFirst = /^\d/.test(m[1]);
        const day = +(dayFirst ? m[1] : m[2]);
        const mon = MONTHS[(dayFirst ? m[2] : m[1]).toLowerCase()];
        const d = mon ? iso(+m[3], mon, day) : null;
        return d ? { showDate: d, showDateText: null, ok: true } : { showDate: null, showDateText: t, ok: false };
    }
    m = t.match(/^([a-z]+)\.?\s+(\d{4})$/i);
    if (m && MONTHS[m[1].toLowerCase()]) {
        return { showDate: `${m[2]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, "0")}-01`, showDateText: t, ok: true };
    }
    m = t.match(/^(19|20)\d{2}$/);
    if (m) return { showDate: `${t}-01-01`, showDateText: t, ok: true };
    return { showDate: null, showDateText: t, ok: false };
}

const ORDINALS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
const RIBBON_BY_PLACE: Record<number, string> = { 1: "Blue", 2: "Red", 3: "Yellow", 4: "White", 5: "Pink", 6: "Green", 7: "Purple", 8: "Brown", 9: "Gray", 10: "Light Blue" };
const PLACE_BY_RIBBON: Record<string, number> = { blue: 1, red: 2, yellow: 3, white: 4, pink: 5, green: 6, purple: 7, brown: 8, gray: 9, grey: 9, "light blue": 10 };
const NAMED_PLACINGS: Record<string, string> = {
    "grand champion": "Grand Champion", grand: "Grand Champion", gc: "Grand Champion",
    "reserve grand champion": "Reserve Grand Champion", "reserve grand": "Reserve Grand Champion", rgc: "Reserve Grand Champion",
    champion: "Champion", ch: "Champion", "section champion": "Champion",
    "reserve champion": "Reserve Champion", reserve: "Reserve Champion", res: "Reserve Champion", rc: "Reserve Champion",
    "honorable mention": "Honorable Mention", "honourable mention": "Honorable Mention", hm: "Honorable Mention",
    "top 3": "Top 3", "top 5": "Top 5", "top 10": "Top 10", "top ten": "Top 10", "top five": "Top 5", "top three": "Top 3",
    participant: "Participant", participation: "Participant", entered: "Participant", nq: "Participant",
    supreme: "Supreme Champion", "supreme champion": "Supreme Champion", "overall champion": "Supreme Champion",
    "reserve supreme": "Reserve Supreme Champion", "reserve supreme champion": "Reserve Supreme Champion",
};

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

/** "1" / "1st" / "First" / "Blue" / "Champion" → the site's placing text plus the ribbon colour it implies. */
export function parsePlacing(raw: string): { placing: string; ribbonColor: string | null } | null {
    const t = raw.trim();
    if (!t) return null;
    const n = norm(t);
    let place: number | null = null;
    const num = n.match(/^(\d{1,2})(?:st|nd|rd|th)?(?:\s+(?:place|of\s+\d+))?$/);
    if (num) place = +num[1];
    else if (ORDINALS[n]) place = ORDINALS[n];
    else if (PLACE_BY_RIBBON[n]) place = PLACE_BY_RIBBON[n];
    if (place != null) {
        if (place < 1 || place > 30) return null;
        return { placing: ordinal(place), ribbonColor: RIBBON_BY_PLACE[place] ?? null };
    }
    if (NAMED_PLACINGS[n]) return { placing: NAMED_PLACINGS[n], ribbonColor: null };
    // "1st + Champion" style: keep the first token we understand
    const first = t.split(/\s*[+,/&]\s*|\s+and\s+/i)[0]?.trim();
    if (first && first !== t) return parsePlacing(first);
    return { placing: t.slice(0, 40), ribbonColor: null };
}

export function parseShowType(raw: string): "photo" | "live" | null {
    const n = norm(raw);
    if (!n) return "photo";
    if (/^(live|l|in person|inperson|table)$/.test(n)) return "live";
    if (/^(photo|p|online|photoshow|photo show|virtual)$/.test(n)) return "photo";
    return null;
}

function text(raw: string | undefined, max: number): string | null {
    const t = (raw ?? "").trim();
    return t ? t.slice(0, max) : null;
}

/**
 * Parse the rows a CSV parser handed back (header → cell). Row numbers
 * are 1-based data rows, the way a spreadsheet shows them plus the header.
 */
export function parseImportRows(rows: Record<string, string>[]): ImportParseResult {
    const problems: ImportRowProblem[] = [];
    const records: ImportParseResult["records"] = [];
    // Every key across every row: a parser hands back uniform keys, a hand-built row set may not.
    const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const map = new Map<string, keyof ImportedRecord>();
    const unknownHeaders: string[] = [];
    for (const h of headers) {
        const key = matchHeader(h);
        if (key) map.set(h, key);
        else if (h.trim()) unknownHeaders.push(h);
    }
    const present = new Set(map.values());
    const missingHeaders = TEMPLATE_COLUMNS.filter((c) => !present.has(c.key)).map((c) => c.header);
    for (const c of TEMPLATE_COLUMNS) {
        if (c.required && !present.has(c.key)) {
            problems.push({ rowNumber: 0, message: `The file has no "${c.header}" column.` });
        }
    }
    if (problems.length) return { records, problems, unknownHeaders, missingHeaders };

    rows.slice(0, IMPORT_MAX_ROWS).forEach((row, i) => {
        const rowNumber = i + 2;
        const cell = (key: keyof ImportedRecord): string => {
            for (const [h, k] of map) if (k === key) return String(row[h] ?? "");
            return "";
        };
        const fail = (message: string) => problems.push({ rowNumber, message });

        const showName = text(cell("showName"), 120);
        const placingRaw = cell("placing");
        const allBlank = TEMPLATE_COLUMNS.every((c) => !cell(c.key).trim());
        if (allBlank) return;
        if (!showName) fail("Show name is missing.");
        const placing = parsePlacing(placingRaw);
        if (!placingRaw.trim()) fail("Placing is missing.");
        else if (!placing) fail(`Placing "${placingRaw.trim()}" was not understood.`);

        const date = parseShowDate(cell("showDate"));
        if (!date.ok) fail(`Date "${cell("showDate").trim()}" was not understood — try 23/03/2024 or 2024-03-23.`);
        const showType = parseShowType(cell("showType"));
        if (!showType) fail(`Photo or live "${cell("showType").trim()}" was not understood — use photo or live.`);

        const sizeRaw = cell("classSize").trim();
        let classSize: number | null = null;
        if (sizeRaw) {
            const n = Number(sizeRaw.replace(/[^\d]/g, ""));
            if (!Number.isInteger(n) || n < 1 || n > 999) fail(`Class size "${sizeRaw}" is not a count.`);
            else classSize = n;
        }

        const progRaw = norm(cell("qualifierProgram"));
        let qualifierProgram: QualifierProgram | null = null;
        let qualifierCard: string | null = null;
        let qualifierYear: number | null = null;
        if (progRaw && !/^(no|none|n|-|blank)$/.test(progRaw)) {
            const candidate = progRaw.replace(/\s*card$/, "").replace(/\s+/g, "");
            const p = candidate === "nan" || candidate === "namhsa" ? "nan" : candidate === "omeq" || candidate === "usomhs" || candidate === "omhps" ? "omeq" : candidate;
            if (isQualifierProgram(p)) {
                qualifierProgram = p;
                const cardRaw = norm(cell("qualifierCard"));
                const card = programInfo(p).cards.find((c) => c.value === cardRaw || norm(c.label).startsWith(cardRaw));
                if (!cardRaw) fail(`Card program ${programInfo(p).short} needs a card color.`);
                else if (!card) fail(`Card color "${cell("qualifierCard").trim()}" is not a ${programInfo(p).short} color.`);
                else qualifierCard = card.value;
                const yearRaw = cell("qualifierYear").trim();
                if (yearRaw) {
                    const y = Number(yearRaw);
                    if (!Number.isInteger(y) || y < 1990 || y > 2100) fail(`Card year "${yearRaw}" is not a year.`);
                    else qualifierYear = y;
                } else if (date.showDate) qualifierYear = Number(date.showDate.slice(0, 4));
            } else {
                fail(`Card program "${cell("qualifierProgram").trim()}" was not understood — use NAN or OMEQ.`);
            }
        }

        if (problems.some((p) => p.rowNumber === rowNumber)) return;
        records.push({
            rowNumber,
            record: {
                showName: showName!,
                showDate: date.showDate,
                showDateText: date.showDateText,
                showType: showType!,
                sanctioningBody: text(cell("sanctioningBody"), 80),
                division: text(cell("division"), 80),
                sectionName: text(cell("sectionName"), 100),
                className: text(cell("className"), 120),
                placing: placing!.placing,
                ribbonColor: placing!.ribbonColor,
                classSize,
                awardCategory: text(cell("awardCategory"), 80),
                competitionLevel: text(cell("competitionLevel"), 60),
                judgeName: text(cell("judgeName"), 80),
                showLocation: text(cell("showLocation"), 120),
                qualifierProgram,
                qualifierCard,
                qualifierYear,
                qualifierCardId: qualifierProgram ? text(cell("qualifierCardId"), 40) : null,
                notes: text(cell("notes"), 500),
            },
        });
    });
    if (rows.length > IMPORT_MAX_ROWS) {
        problems.push({ rowNumber: 0, message: `Only the first ${IMPORT_MAX_ROWS} rows were read; split the rest into a second file.` });
    }
    return { records, problems, unknownHeaders, missingHeaders };
}

/** The downloadable template: header row plus one example row. */
export function templateCsv(): string {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    return TEMPLATE_COLUMNS.map((c) => esc(c.header)).join(",") + "\n" + TEMPLATE_COLUMNS.map((c) => esc(c.example)).join(",") + "\n";
}
