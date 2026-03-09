"use client";

import { Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";
import type { InsuranceReportPayload } from "@/app/actions/insurance-report";

// ============================================================
// PDF Styles
// ============================================================

Font.register({
    family: "Inter",
    fonts: [
        {
            src: "https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2JL7W0Q5n-wU.woff2",
            fontWeight: 400,
        },
        {
            src: "https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5n-wU.woff2",
            fontWeight: 600,
        },
        {
            src: "https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa05L7W0Q5n-wU.woff2",
            fontWeight: 700,
        },
    ],
});

const styles = StyleSheet.create({
    page: {
        fontFamily: "Inter",
        fontSize: 10,
        color: "#1a1a2e",
        paddingTop: 40,
        paddingBottom: 40,
        paddingHorizontal: 40,
        backgroundColor: "#ffffff",
    },
    // ── Cover Page ──
    coverPage: {
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
    },
    coverBrand: {
        fontSize: 14,
        fontWeight: 600,
        color: "#7c6df0",
        marginBottom: 8,
        letterSpacing: 2,
    },
    coverTitle: {
        fontSize: 28,
        fontWeight: 700,
        color: "#1a1a2e",
        marginBottom: 6,
        textAlign: "center",
    },
    coverSubtitle: {
        fontSize: 14,
        color: "#6b6b80",
        marginBottom: 40,
    },
    coverStats: {
        flexDirection: "row",
        gap: 40,
        marginBottom: 30,
    },
    coverStat: {
        alignItems: "center",
    },
    coverStatValue: {
        fontSize: 24,
        fontWeight: 700,
        color: "#7c6df0",
    },
    coverStatLabel: {
        fontSize: 10,
        color: "#6b6b80",
        marginTop: 4,
    },
    coverDate: {
        fontSize: 10,
        color: "#a0a0b8",
        marginTop: 20,
    },
    coverWatermark: {
        fontSize: 8,
        color: "#a0a0b8",
        position: "absolute",
        bottom: 30,
        textAlign: "center",
    },
    // ── Summary Table ──
    summaryTitle: {
        fontSize: 16,
        fontWeight: 700,
        marginBottom: 12,
        color: "#1a1a2e",
    },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#f0f0f5",
        borderBottomWidth: 1,
        borderBottomColor: "#ddd",
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    tableRow: {
        flexDirection: "row",
        borderBottomWidth: 0.5,
        borderBottomColor: "#eee",
        paddingVertical: 5,
        paddingHorizontal: 4,
    },
    colNum: { width: "6%", fontSize: 8 },
    colName: { width: "25%", fontSize: 8 },
    colRef: { width: "30%", fontSize: 8, color: "#6b6b80" },
    colCondition: { width: "12%", fontSize: 8 },
    colFinish: { width: "10%", fontSize: 8 },
    colValue: { width: "17%", fontSize: 8, textAlign: "right" },
    headerText: { fontWeight: 700, fontSize: 8 },
    totalRow: {
        flexDirection: "row",
        borderTopWidth: 2,
        borderTopColor: "#1a1a2e",
        paddingVertical: 6,
        paddingHorizontal: 4,
        marginTop: 2,
    },
    totalLabel: {
        width: "83%",
        fontSize: 10,
        fontWeight: 700,
        textAlign: "right",
        paddingRight: 8,
    },
    totalValue: {
        width: "17%",
        fontSize: 10,
        fontWeight: 700,
        textAlign: "right",
        color: "#7c6df0",
    },
    // ── Detail Pages ──
    detailGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },
    detailCard: {
        width: "48%",
        borderWidth: 1,
        borderColor: "#e0e0e0",
        borderRadius: 6,
        padding: 10,
        marginBottom: 8,
    },
    detailPhoto: {
        width: "100%",
        height: 100,
        objectFit: "contain",
        borderRadius: 4,
        marginBottom: 6,
        backgroundColor: "#f5f5f5",
    },
    detailPlaceholder: {
        width: "100%",
        height: 100,
        backgroundColor: "#f0f0f5",
        borderRadius: 4,
        marginBottom: 6,
        justifyContent: "center",
        alignItems: "center",
    },
    detailPlaceholderText: {
        fontSize: 20,
        color: "#a0a0b8",
    },
    detailName: {
        fontSize: 10,
        fontWeight: 700,
        marginBottom: 2,
    },
    detailRef: {
        fontSize: 8,
        color: "#6b6b80",
        marginBottom: 4,
    },
    detailRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 2,
    },
    detailLabel: {
        fontSize: 8,
        color: "#6b6b80",
    },
    detailValue: {
        fontSize: 8,
        fontWeight: 600,
    },
    // ── Footer ──
    footer: {
        position: "absolute",
        bottom: 20,
        left: 40,
        right: 40,
        flexDirection: "row",
        justifyContent: "space-between",
        fontSize: 7,
        color: "#a0a0b8",
    },
});

// ============================================================
// Helper
// ============================================================

function formatCurrency(value: number | null): string {
    if (value === null || value === 0) return "—";
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ============================================================
// PDF Document
// ============================================================

export default function InsuranceReport({ data }: { data: InsuranceReportPayload }) {
    // Split horses into groups of 4 for detail pages
    const detailPages: typeof data.horses[] = [];
    for (let i = 0; i < data.horses.length; i += 4) {
        detailPages.push(data.horses.slice(i, i + 4));
    }

    return (
        <Document
            title={`Insurance Report — ${data.userName}`}
            author="Model Horse Hub"
            subject="Collection Insurance Report"
        >
            {/* ═══ Cover Page ═══ */}
            <Page size="LETTER" style={styles.page}>
                <View style={styles.coverPage}>
                    <Text style={styles.coverBrand}>MODEL HORSE HUB</Text>
                    <Text style={styles.coverTitle}>Collection Insurance Report</Text>
                    <Text style={styles.coverSubtitle}>{data.userName}</Text>

                    <View style={styles.coverStats}>
                        <View style={styles.coverStat}>
                            <Text style={styles.coverStatValue}>{data.totalModels}</Text>
                            <Text style={styles.coverStatLabel}>Total Models</Text>
                        </View>
                        <View style={styles.coverStat}>
                            <Text style={styles.coverStatValue}>
                                {formatCurrency(data.totalValue)}
                            </Text>
                            <Text style={styles.coverStatLabel}>Total Estimated Value</Text>
                        </View>
                    </View>

                    <Text style={styles.coverDate}>Generated: {data.generatedAt}</Text>
                    <Text style={styles.coverWatermark}>
                        This report was auto-generated by modelhorsehub.com — The Ultimate Digital Stable
                    </Text>
                </View>
            </Page>

            {/* ═══ Summary Table ═══ */}
            <Page size="LETTER" style={styles.page}>
                <Text style={styles.summaryTitle}>Collection Summary</Text>

                {/* Table Header */}
                <View style={styles.tableHeader}>
                    <Text style={[styles.colNum, styles.headerText]}>#</Text>
                    <Text style={[styles.colName, styles.headerText]}>Name</Text>
                    <Text style={[styles.colRef, styles.headerText]}>Reference</Text>
                    <Text style={[styles.colCondition, styles.headerText]}>Condition</Text>
                    <Text style={[styles.colFinish, styles.headerText]}>Finish</Text>
                    <Text style={[styles.colValue, styles.headerText]}>Est. Value</Text>
                </View>

                {/* Table Rows */}
                {data.horses.map((horse, i) => (
                    <View key={horse.id} style={styles.tableRow}>
                        <Text style={styles.colNum}>{i + 1}</Text>
                        <Text style={styles.colName}>{horse.name}</Text>
                        <Text style={styles.colRef}>{horse.reference}</Text>
                        <Text style={styles.colCondition}>{horse.condition}</Text>
                        <Text style={styles.colFinish}>{horse.finish}</Text>
                        <Text style={styles.colValue}>
                            {formatCurrency(horse.estimatedValue ?? horse.purchasePrice)}
                        </Text>
                    </View>
                ))}

                {/* Total Row */}
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>TOTAL ESTIMATED VALUE</Text>
                    <Text style={styles.totalValue}>{formatCurrency(data.totalValue)}</Text>
                </View>

                <View style={styles.footer}>
                    <Text>Model Horse Hub — modelhorsehub.com</Text>
                    <Text>{data.generatedAt}</Text>
                </View>
            </Page>

            {/* ═══ Detail Pages ═══ */}
            {detailPages.map((pageHorses, pageIndex) => (
                <Page key={pageIndex} size="LETTER" style={styles.page}>
                    <Text style={styles.summaryTitle}>
                        Model Details — Page {pageIndex + 1} of {detailPages.length}
                    </Text>

                    <View style={styles.detailGrid}>
                        {pageHorses.map((horse) => (
                            <View key={horse.id} style={styles.detailCard}>
                                {horse.photoBase64 ? (
                                    <Image src={horse.photoBase64} style={styles.detailPhoto} />
                                ) : (
                                    <View style={styles.detailPlaceholder}>
                                        <Text style={styles.detailPlaceholderText}>🐴</Text>
                                    </View>
                                )}

                                <Text style={styles.detailName}>{horse.name}</Text>
                                <Text style={styles.detailRef}>{horse.reference}</Text>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Finish:</Text>
                                    <Text style={styles.detailValue}>{horse.finish}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Condition:</Text>
                                    <Text style={styles.detailValue}>{horse.condition}</Text>
                                </View>
                                {horse.purchasePrice && (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Paid:</Text>
                                        <Text style={styles.detailValue}>
                                            {formatCurrency(horse.purchasePrice)}
                                        </Text>
                                    </View>
                                )}
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Est. Value:</Text>
                                    <Text style={[styles.detailValue, { color: "#7c6df0" }]}>
                                        {formatCurrency(horse.estimatedValue ?? horse.purchasePrice)}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    <View style={styles.footer}>
                        <Text>Model Horse Hub — modelhorsehub.com</Text>
                        <Text>{data.generatedAt}</Text>
                    </View>
                </Page>
            ))}
        </Document>
    );
}
