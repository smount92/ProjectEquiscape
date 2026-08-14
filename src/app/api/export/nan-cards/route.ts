import { exportNanCards } from "@/app/actions/competition";
import { escapeCSV } from "@/lib/utils/csv";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const { records } = await exportNanCards();

        const headers = ["Horse Name", "NAN Year", "Card Type", "Show Name", "Placement", "Class", "Status"];

        const rows = records.map(r => [
            escapeCSV(r.horseName),
            escapeCSV(String(r.nanYear)),
            escapeCSV(r.cardType),
            escapeCSV(r.showName),
            escapeCSV(r.placement),
            escapeCSV(r.className),
            escapeCSV(r.isExpired ? "Expired" : "Active"),
        ].join(","));

        const bom = "\uFEFF";
        const csv = bom + headers.join(",") + "\n" + rows.join("\n");

        return new NextResponse(csv, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="nan_cards_${new Date().getFullYear()}.csv"`,
                "Cache-Control": "no-cache, no-store",
            },
        });
    } catch {
        return NextResponse.json({ error: "Unauthorized or failed to export" }, { status: 401 });
    }
}
