import React from"react";
import { Document, Page, View, Text, Image, StyleSheet } from"@react-pdf/renderer";

/* ═══════════════════════════════════════════════════════════════
 Types
 ═══════════════════════════════════════════════════════════════ */
interface InsuranceHorse {
 id: string;
 custom_name: string;
 finish_type: string | null;
 condition_grade: string | null;
 trade_status: string | null;
 created_at: string;
 catalog_items: {
 title: string;
 maker: string;
 scale: string | null;
 } | null;
 financial_vault: {
 purchase_price: number | null;
 purchase_date: string | null;
 estimated_current_value: number | null;
 insurance_notes: string | null;
 } | null;
}

interface InsuranceReportProps {
 owner: { alias_name: string; full_name: string | null; email: string };
 horses: InsuranceHorse[];
 thumbnailMap: Map<string, string>;
 generatedAt: string;
}

/* ═══════════════════════════════════════════════════════════════
 Styles
 ═══════════════════════════════════════════════════════════════ */
const colors = {
 primary:"#2C5545",
 primaryLight:"#3A7A5C",
 accent:"#F0A06C",
 bg:"#FFFFFF",
 bgAlt:"#F8F9FA",
 text:"#1A1A2E",
 textMuted:"#6C757D",
 border:"#DEE2E6",
 success:"#28A745",
};

const s = StyleSheet.create({
 // ── Page layout ──
 page: {
 fontFamily:"Helvetica",
 fontSize: 10,
 color: colors.text,
 backgroundColor: colors.bg,
 paddingTop: 40,
 paddingBottom: 60,
 paddingHorizontal: 40,
 },
 footer: {
 position:"absolute",
 bottom: 20,
 left: 40,
 right: 40,
 flexDirection:"row",
 justifyContent:"space-between",
 fontSize: 7,
 color: colors.textMuted,
 borderTop: `1px solid ${colors.border}`,
 paddingTop: 8,
 },

 // ── Cover page ──
 coverPage: {
 alignItems:"center",
 justifyContent:"center",
 flex: 1,
 },
 coverBrand: {
 fontSize: 28,
 fontFamily:"Helvetica-Bold",
 color: colors.primary,
 marginBottom: 6,
 },
 coverSubtitle: {
 fontSize: 14,
 color: colors.textMuted,
 marginBottom: 40,
 },
 coverTitle: {
 fontSize: 22,
 fontFamily:"Helvetica-Bold",
 color: colors.text,
 marginBottom: 8,
 },
 coverOwner: {
 fontSize: 14,
 color: colors.primaryLight,
 marginBottom: 4,
 },
 coverDate: {
 fontSize: 11,
 color: colors.textMuted,
 marginBottom: 32,
 },
 coverStat: {
 flexDirection:"row",
 gap: 24,
 marginTop: 16,
 },
 coverStatItem: {
 alignItems:"center",
 padding: 12,
 backgroundColor: colors.bgAlt,
 borderRadius: 6,
 width: 120,
 },
 coverStatLabel: {
 fontSize: 8,
 color: colors.textMuted,
 textTransform:"uppercase",
 letterSpacing: 1,
 marginBottom: 4,
 },
 coverStatValue: {
 fontSize: 18,
 fontFamily:"Helvetica-Bold",
 color: colors.primary,
 },

 // ── Summary table ──
 summaryTitle: {
 fontSize: 16,
 fontFamily:"Helvetica-Bold",
 color: colors.primary,
 marginBottom: 16,
 borderBottom: `2px solid ${colors.primary}`,
 paddingBottom: 6,
 },
 tableHeader: {
 flexDirection:"row",
 backgroundColor: colors.primary,
 color: colors.bg,
 padding: 8,
 borderRadius: 4,
 marginBottom: 1,
 },
 tableHeaderText: {
 fontSize: 8,
 fontFamily:"Helvetica-Bold",
 color: colors.bg,
 textTransform:"uppercase",
 letterSpacing: 0.5,
 },
 tableRow: {
 flexDirection:"row",
 padding: 6,
 paddingHorizontal: 8,
 borderBottom: `1px solid ${colors.border}`,
 },
 tableRowAlt: {
 backgroundColor: colors.bgAlt,
 },
 tableCell: {
 fontSize: 9,
 },
 tableCellMoney: {
 fontSize: 9,
 textAlign:"right" as const,
 },
 totalRow: {
 flexDirection:"row",
 padding: 8,
 backgroundColor: colors.primary,
 borderRadius: 4,
 marginTop: 4,
 },
 totalText: {
 fontSize: 10,
 fontFamily:"Helvetica-Bold",
 color: colors.bg,
 },

 // ── Detail page ──
 detailHeader: {
 flexDirection:"row",
 marginBottom: 16,
 gap: 16,
 },
 detailThumb: {
 width: 120,
 height: 120,
 borderRadius: 6,
 objectFit:"cover" as const,
 backgroundColor: colors.bgAlt,
 border: `1px solid ${colors.border}`,
 },
 detailInfo: {
 flex: 1,
 },
 detailName: {
 fontSize: 18,
 fontFamily:"Helvetica-Bold",
 color: colors.text,
 marginBottom: 4,
 },
 detailReference: {
 fontSize: 11,
 color: colors.primaryLight,
 marginBottom: 8,
 },
 detailGrid: {
 flexDirection:"row",
 flexWrap:"wrap",
 gap: 12,
 marginTop: 12,
 },
 detailField: {
 width:"47%",
 padding: 10,
 backgroundColor: colors.bgAlt,
 borderRadius: 4,
 border: `1px solid ${colors.border}`,
 },
 detailFieldLabel: {
 fontSize: 7,
 fontFamily:"Helvetica-Bold",
 color: colors.textMuted,
 textTransform:"uppercase",
 letterSpacing: 0.8,
 marginBottom: 3,
 },
 detailFieldValue: {
 fontSize: 11,
 color: colors.text,
 },
 detailNotes: {
 marginTop: 12,
 padding: 10,
 backgroundColor:"#FFF3E0",
 borderRadius: 4,
 border: `1px solid ${colors.accent}`,
 },
 detailNotesLabel: {
 fontSize: 7,
 fontFamily:"Helvetica-Bold",
 color: colors.accent,
 textTransform:"uppercase",
 letterSpacing: 0.8,
 marginBottom: 3,
 },
 detailNotesText: {
 fontSize: 9,
 color: colors.text,
 lineHeight: 1.5,
 },
 detailDivider: {
 borderBottom: `1px solid ${colors.border}`,
 marginVertical: 12,
 },
});

/* ═══════════════════════════════════════════════════════════════
 Helpers
 ═══════════════════════════════════════════════════════════════ */
function fmt$(amount: number | null | undefined): string {
 if (!amount) return"—";
 return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null | undefined): string {
 if (!iso) return"—";
 return new Date(iso).toLocaleDateString("en-US", {
 year:"numeric",
 month:"short",
 day:"numeric",
 });
}

/* ═══════════════════════════════════════════════════════════════
 Footer — appears on every page
 ═══════════════════════════════════════════════════════════════ */
function PageFooter({ generatedAt }: { generatedAt: string }) {
 return (
 <View style={s.footer} fixed>
 <Text>Generated by Model Horse Hub — {fmtDate(generatedAt)}</Text>
 <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
 </View>
 );
}

/* ═══════════════════════════════════════════════════════════════
 Cover Page
 ═══════════════════════════════════════════════════════════════ */
function CoverPage({
 owner,
 totalModels,
 totalValue,
 generatedAt,
}: {
 owner: InsuranceReportProps["owner"];
 totalModels: number;
 totalValue: number;
 generatedAt: string;
}) {
 return (
 <Page size="LETTER" style={s.page}>
 <View style={s.coverPage}>
 <Text style={s.coverBrand}>🐴 Model Horse Hub</Text>
 <Text style={s.coverSubtitle}>Digital Stable Management</Text>

 <Text style={s.coverTitle}>Collection Insurance Report</Text>
 <Text style={s.coverOwner}>{owner.full_name || owner.alias_name}</Text>
 <Text style={s.coverDate}>{fmtDate(generatedAt)}</Text>

 <View style={s.coverStat}>
 <View style={s.coverStatItem}>
 <Text style={s.coverStatLabel}>Total Models</Text>
 <Text style={s.coverStatValue}>{totalModels}</Text>
 </View>
 <View style={s.coverStatItem}>
 <Text style={s.coverStatLabel}>Estimated Value</Text>
 <Text style={s.coverStatValue}>{fmt$(totalValue)}</Text>
 </View>
 </View>
 </View>
 <PageFooter generatedAt={generatedAt} />
 </Page>
 );
}

/* ═══════════════════════════════════════════════════════════════
 Summary Table Page
 ═══════════════════════════════════════════════════════════════ */
function SummaryPage({ horses, generatedAt }: { horses: InsuranceHorse[]; generatedAt: string }) {
 const totalPurchase = horses.reduce((sum, h) => sum + (h.financial_vault?.purchase_price || 0), 0);
 const totalValue = horses.reduce((sum, h) => sum + (h.financial_vault?.estimated_current_value || 0), 0);

 return (
 <Page size="LETTER" style={s.page}>
 <Text style={s.summaryTitle}>Collection Summary</Text>

 {/* Table Header */}
 <View style={s.tableHeader}>
 <Text style={[s.tableHeaderText, { width:"30%" }]}>Name</Text>
 <Text style={[s.tableHeaderText, { width:"22%" }]}>Reference</Text>
 <Text style={[s.tableHeaderText, { width:"14%" }]}>Condition</Text>
 <Text style={[s.tableHeaderText, { width:"17%", textAlign:"right" }]}>Purchase</Text>
 <Text style={[s.tableHeaderText, { width:"17%", textAlign:"right" }]}>Value</Text>
 </View>

 {/* Table Rows */}
 {horses.map((horse, i) => {
 const vault = horse.financial_vault;
 return (
 <View key={horse.id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]} wrap={false}>
 <Text style={[s.tableCell, { width:"30%" }]}>{horse.custom_name}</Text>
 <Text style={[s.tableCell, { width:"22%" }]}>{horse.catalog_items?.title ||"—"}</Text>
 <Text style={[s.tableCell, { width:"14%" }]}>{horse.condition_grade ||"—"}</Text>
 <Text style={[s.tableCellMoney, { width:"17%" }]}>{fmt$(vault?.purchase_price)}</Text>
 <Text style={[s.tableCellMoney, { width:"17%" }]}>{fmt$(vault?.estimated_current_value)}</Text>
 </View>
 );
 })}

 {/* Totals */}
 <View style={s.totalRow}>
 <Text style={[s.totalText, { width:"66%" }]}>TOTAL ({horses.length} models)</Text>
 <Text style={[s.totalText, { width:"17%", textAlign:"right" }]}>{fmt$(totalPurchase)}</Text>
 <Text style={[s.totalText, { width:"17%", textAlign:"right" }]}>{fmt$(totalValue)}</Text>
 </View>

 <PageFooter generatedAt={generatedAt} />
 </Page>
 );
}

/* ═══════════════════════════════════════════════════════════════
 Detail Page — one per horse
 ═══════════════════════════════════════════════════════════════ */
function DetailPage({
 horse,
 thumbnailUrl,
 generatedAt,
}: {
 horse: InsuranceHorse;
 thumbnailUrl?: string;
 generatedAt: string;
}) {
 const vault = horse.financial_vault;
 const ref = horse.catalog_items;

 return (
 <Page size="LETTER" style={s.page}>
 <View style={s.detailHeader}>
 {thumbnailUrl ? (
 <Image src={thumbnailUrl} style={s.detailThumb} />
 ) : (
 <View style={[s.detailThumb, { alignItems:"center", justifyContent:"center" }]}>
 <Text style={{ fontSize: 36, color: colors.textMuted }}>🐴</Text>
 </View>
 )}
 <View style={s.detailInfo}>
 <Text style={s.detailName}>{horse.custom_name}</Text>
 {ref && (
 <Text style={s.detailReference}>
 {ref.maker} — {ref.title}
 {ref.scale ? ` (${ref.scale})` :""}
 </Text>
 )}
 </View>
 </View>

 <View style={s.detailDivider} />

 <View style={s.detailGrid}>
 <View style={s.detailField}>
 <Text style={s.detailFieldLabel}>Condition</Text>
 <Text style={s.detailFieldValue}>{horse.condition_grade ||"—"}</Text>
 </View>
 <View style={s.detailField}>
 <Text style={s.detailFieldLabel}>Finish</Text>
 <Text style={s.detailFieldValue}>{horse.finish_type ||"—"}</Text>
 </View>
 <View style={s.detailField}>
 <Text style={s.detailFieldLabel}>Purchase Price</Text>
 <Text style={s.detailFieldValue}>{fmt$(vault?.purchase_price)}</Text>
 </View>
 <View style={s.detailField}>
 <Text style={s.detailFieldLabel}>Purchase Date</Text>
 <Text style={s.detailFieldValue}>{fmtDate(vault?.purchase_date)}</Text>
 </View>
 <View style={s.detailField}>
 <Text style={s.detailFieldLabel}>Estimated Value</Text>
 <Text style={[s.detailFieldValue, { color: colors.success }]}>
 {fmt$(vault?.estimated_current_value)}
 </Text>
 </View>
 <View style={s.detailField}>
 <Text style={s.detailFieldLabel}>Date Added</Text>
 <Text style={s.detailFieldValue}>{fmtDate(horse.created_at)}</Text>
 </View>
 </View>

 {vault?.insurance_notes && (
 <View style={s.detailNotes}>
 <Text style={s.detailNotesLabel}>Insurance Notes</Text>
 <Text style={s.detailNotesText}>{vault.insurance_notes}</Text>
 </View>
 )}

 <PageFooter generatedAt={generatedAt} />
 </Page>
 );
}

/* ═══════════════════════════════════════════════════════════════
 Main Document Export
 ═══════════════════════════════════════════════════════════════ */
export function InsuranceReportDocument(props: InsuranceReportProps) {
 const { owner, horses, thumbnailMap, generatedAt } = props;
 const totalValue = horses.reduce((sum, h) => sum + (h.financial_vault?.estimated_current_value || 0), 0);

 return (
 <Document
 title="Collection Insurance Report"
 author={owner.alias_name}
 subject="Model Horse Collection Insurance Documentation"
 creator="Model Horse Hub"
 >
 <CoverPage owner={owner} totalModels={horses.length} totalValue={totalValue} generatedAt={generatedAt} />
 <SummaryPage horses={horses} generatedAt={generatedAt} />
 {horses.map((horse) => (
 <DetailPage
 key={horse.id}
 horse={horse}
 thumbnailUrl={thumbnailMap.get(horse.id)}
 generatedAt={generatedAt}
 />
 ))}
 </Document>
 );
}
