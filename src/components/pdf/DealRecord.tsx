"use client";

import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { EvidencePack } from "@/lib/deals/evidence";

/**
 * THE EVIDENCE PACK, as a document you can attach.
 *
 * The audience for this page is not a collector — it is whoever reads a
 * PayPal or card dispute. That reader has minutes, not hours, and
 * decides for whichever side files the more legible narrative. So the
 * design rules here are the opposite of the rest of the site: no
 * decoration, no brand colour on anything load-bearing, generous
 * whitespace, and every fact in a labelled row with a timestamp beside
 * it.
 *
 * The content is assembled by src/lib/deals/evidence.ts — pure, tested,
 * and shared with the on-screen record and the plain-text version, so
 * all three say exactly the same thing.
 */

Font.register({
    family: "Inter",
    fonts: [
        { src: "/fonts/Inter-Regular.ttf", fontWeight: 400 },
        { src: "/fonts/Inter-SemiBold.ttf", fontWeight: 600 },
        { src: "/fonts/Inter-Bold.ttf", fontWeight: 700 },
    ],
});

const styles = StyleSheet.create({
    page: {
        fontFamily: "Inter",
        fontSize: 9.5,
        color: "#1a1a2e",
        paddingTop: 44,
        paddingBottom: 52,
        paddingHorizontal: 44,
        backgroundColor: "#ffffff",
        lineHeight: 1.45,
    },
    brand: {
        fontSize: 8,
        fontWeight: 600,
        letterSpacing: 1.6,
        color: "#6b6b80",
        marginBottom: 10,
    },
    title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
    subtitle: { fontSize: 9, color: "#4a4a5e", marginBottom: 14 },
    disclaimer: {
        fontSize: 8.5,
        color: "#4a4a5e",
        borderWidth: 1,
        borderColor: "#d8d8e0",
        borderStyle: "solid",
        padding: 10,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 700,
        marginTop: 16,
        marginBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: "#1a1a2e",
        borderBottomStyle: "solid",
        paddingBottom: 3,
    },
    note: { fontSize: 8.5, color: "#6b6b80", marginBottom: 6 },
    row: { flexDirection: "row", marginBottom: 2 },
    rowLabel: { width: 165, color: "#4a4a5e" },
    rowValue: { flex: 1 },
    line: { marginBottom: 2 },
    tableHeader: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#1a1a2e",
        borderBottomStyle: "solid",
        paddingBottom: 3,
        marginBottom: 3,
        fontWeight: 600,
        fontSize: 8.5,
    },
    tableRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#e6e6ec",
        borderBottomStyle: "solid",
        paddingVertical: 3,
        fontSize: 8.5,
    },
    cell: { flex: 1, paddingRight: 4 },
    cellNarrow: { width: 22, paddingRight: 4 },
    footer: {
        position: "absolute",
        bottom: 26,
        left: 44,
        right: 44,
        fontSize: 7.5,
        color: "#8a8a99",
        borderTopWidth: 1,
        borderTopColor: "#e6e6ec",
        borderTopStyle: "solid",
        paddingTop: 6,
        flexDirection: "row",
        justifyContent: "space-between",
    },
});

export default function DealRecord({ pack }: { pack: EvidencePack }) {
    return (
        <Document
            title={pack.title}
            author="Model Horse Hub"
            subject="Deal record"
            creator="Model Horse Hub"
        >
            <Page size="LETTER" style={styles.page} wrap>
                <Text style={styles.brand}>MODEL HORSE HUB</Text>
                <Text style={styles.title}>{pack.title}</Text>
                <Text style={styles.subtitle}>{pack.subtitle}</Text>
                <Text style={styles.disclaimer}>{pack.disclaimer}</Text>

                {pack.sections.map((section) => (
                    <View key={section.id} wrap>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        {section.note && <Text style={styles.note}>{section.note}</Text>}

                        {section.rows?.map((row, i) => (
                            <View key={i} style={styles.row} wrap={false}>
                                <Text style={styles.rowLabel}>{row.label}</Text>
                                <Text style={styles.rowValue}>{row.value}</Text>
                            </View>
                        ))}

                        {section.table && (
                            <View>
                                <View style={styles.tableHeader}>
                                    {section.table.headers.map((h, i) => (
                                        <Text
                                            key={i}
                                            style={i === 0 ? styles.cellNarrow : styles.cell}
                                        >
                                            {h}
                                        </Text>
                                    ))}
                                </View>
                                {section.table.rows.map((row, i) => (
                                    <View key={i} style={styles.tableRow} wrap={false}>
                                        {row.map((cell, j) => (
                                            <Text
                                                key={j}
                                                style={j === 0 ? styles.cellNarrow : styles.cell}
                                            >
                                                {cell}
                                            </Text>
                                        ))}
                                    </View>
                                ))}
                            </View>
                        )}

                        {section.lines?.map((line, i) => (
                            <Text key={i} style={styles.line}>
                                {line}
                            </Text>
                        ))}
                    </View>
                ))}

                <View style={styles.footer} fixed>
                    <Text>
                        Model Horse Hub holds no funds and takes no position on this deal.
                    </Text>
                    <Text
                        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
                    />
                </View>
            </Page>
        </Document>
    );
}
