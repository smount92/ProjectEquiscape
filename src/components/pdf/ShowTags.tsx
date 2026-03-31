import { Document, Page, View, Text, StyleSheet, Svg, Rect } from "@react-pdf/renderer";

// Standard model horse show tag: 1¾" × 1³⁄₃₂" folded
// Unfolded (printed): 3½" × 1³⁄₃₂"
// In PDF points: 1 inch = 72 pts
const TAG_WIDTH = 252;  // 3.5 inches unfolded
const TAG_HEIGHT = 79;  // 1 3/32 inches (~1.09375")
const HALF_WIDTH = 126;  // 1.75 inches (each side when folded)
const QR_SIZE = 55;     // ~0.76 inches — fits in height with padding

const styles = StyleSheet.create({
    page: {
        padding: 28,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "flex-start",  // left-aligned for less cutting
        gap: 10,
        fontFamily: "Helvetica",
    },
    tagRow: {
        width: TAG_WIDTH,
        height: TAG_HEIGHT,
        flexDirection: "row",
    },
    front: {
        width: HALF_WIDTH,
        height: TAG_HEIGHT,
        border: "0.5pt dashed #B8A88A",
        borderRight: "0.5pt dotted #D4C9B0",
        borderTopLeftRadius: 3,
        borderBottomLeftRadius: 3,
        padding: 5,
        justifyContent: "space-between",
        backgroundColor: "#FDFCFA",
    },
    back: {
        width: HALF_WIDTH,
        height: TAG_HEIGHT,
        border: "0.5pt dashed #B8A88A",
        borderLeft: "none",
        borderTopRightRadius: 3,
        borderBottomRightRadius: 3,
        padding: 5,
        flexDirection: "row",            // text left, QR right
        justifyContent: "space-between",
        backgroundColor: "#F8F5F0",
    },
    // Front side elements
    horseNumber: {
        fontSize: 11,
        fontFamily: "Helvetica-Bold",
        color: "#2C5545",
        textAlign: "center",
    },
    horseNumberLabel: {
        fontSize: 5,
        color: "#7A6A58",
        textAlign: "center",
        marginBottom: 2,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 1,
    },
    infoLabel: {
        fontSize: 5,
        color: "#7A6A58",
        fontFamily: "Helvetica-Bold",
    },
    infoValue: {
        fontSize: 6,
        color: "#2C2017",
    },
    classLabel: {
        fontSize: 6,
        fontFamily: "Helvetica-Bold",
        color: "#2C5545",
        marginTop: 2,
        padding: 2,
        backgroundColor: "#E8F5E9",
        borderRadius: 1,
        textAlign: "center",
    },
    // Back side elements — text column (left)
    backTextCol: {
        flex: 1,
        justifyContent: "center",
        paddingRight: 3,
    },
    backHorseName: {
        fontSize: 7,
        fontFamily: "Helvetica-Bold",
        color: "#2C2017",
        marginBottom: 1,
    },
    backMoldName: {
        fontSize: 5,
        color: "#594A3C",
        marginBottom: 2,
    },
    backOwner: {
        fontSize: 5,
        color: "#2C5545",
        fontFamily: "Helvetica-Bold",
    },
    backFooter: {
        fontSize: 4,
        color: "#B8A88A",
        marginTop: 2,
    },
    // QR column (right)
    qrCol: {
        width: QR_SIZE,
        justifyContent: "center",
        alignItems: "center",
    },
});

interface ShowTagEntry {
    horseName: string;
    moldName: string;
    className: string;
    entryNumber: number;
    ownerAlias: string;
    breed: string;
    gender: string;
    finishType: string;
    horseNumber: string;
    passportUrl: string;
}

interface ShowTagsProps {
    showName: string;
    showDate: string;
    entries: ShowTagEntry[];
}

// Decorative QR-like pattern (not scannable — visual indicator for passport link)
function QRBlock() {
    const s = QR_SIZE - 8; // inner size with margin
    return (
        <Svg viewBox={`0 0 ${s} ${s}`} width={s} height={s}>
            <Rect x={0} y={0} width={s} height={s} rx={2} fill="#FFFFFF" stroke="#D4C9B0" strokeWidth={0.5} />
            {/* Corner squares */}
            <Rect x={2} y={2} width={10} height={10} fill="#2C5545" rx={1} />
            <Rect x={4} y={4} width={6} height={6} fill="#FFFFFF" />
            <Rect x={5} y={5} width={4} height={4} fill="#2C5545" />

            <Rect x={s-12} y={2} width={10} height={10} fill="#2C5545" rx={1} />
            <Rect x={s-10} y={4} width={6} height={6} fill="#FFFFFF" />
            <Rect x={s-9} y={5} width={4} height={4} fill="#2C5545" />

            <Rect x={2} y={s-12} width={10} height={10} fill="#2C5545" rx={1} />
            <Rect x={4} y={s-10} width={6} height={6} fill="#FFFFFF" />
            <Rect x={5} y={s-9} width={4} height={4} fill="#2C5545" />

            {/* Center dot */}
            <Rect x={s/2-3} y={s/2-3} width={6} height={6} fill="#2C5545" rx={1} />
            <Rect x={s/2-1} y={s/2-1} width={2} height={2} fill="#FFFFFF" />

            {/* Data dots */}
            <Rect x={15} y={4} width={3} height={3} fill="#594A3C" />
            <Rect x={20} y={4} width={3} height={3} fill="#594A3C" />
            <Rect x={4} y={16} width={3} height={3} fill="#594A3C" />
            <Rect x={9} y={16} width={3} height={3} fill="#594A3C" />
            <Rect x={s-8} y={16} width={3} height={3} fill="#594A3C" />
            <Rect x={16} y={s-8} width={3} height={3} fill="#594A3C" />
            <Rect x={22} y={s-8} width={3} height={3} fill="#594A3C" />
            <Rect x={s-8} y={s-8} width={3} height={3} fill="#594A3C" />
        </Svg>
    );
}

function makeLabel(finishType: string): string {
    const map: Record<string, string> = {
        of: "OF", original_finish: "OF",
        custom: "C", cm: "CM",
        artist_resin: "AR", ar: "AR",
        repaint: "R", remodel: "RM",
    };
    return map[finishType?.toLowerCase()] || finishType?.toUpperCase() || "—";
}

export default function ShowTags({ showName, showDate, entries }: ShowTagsProps) {
    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                {/* Instructions */}
                <View style={{ width: "100%", marginBottom: 4 }}>
                    <Text style={{ fontSize: 6, color: "#B8A88A", textAlign: "left" }}>
                        ✂ Cut along dashed lines · Fold along center dotted line · {showName} — {showDate}
                    </Text>
                </View>

                {entries.map((entry, i) => (
                    <View key={i} style={styles.tagRow} wrap={false}>
                        {/* FRONT SIDE */}
                        <View style={styles.front}>
                            <View>
                                <Text style={styles.horseNumber}>{entry.horseNumber}</Text>
                                <Text style={styles.horseNumberLabel}>ENTRY #{entry.entryNumber}</Text>
                            </View>

                            <View>
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>BREED</Text>
                                    <Text style={styles.infoValue}>{entry.breed || "—"}</Text>
                                </View>
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>SEX</Text>
                                    <Text style={styles.infoValue}>{entry.gender || "—"}</Text>
                                </View>
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>MAKE</Text>
                                    <Text style={styles.infoValue}>{makeLabel(entry.finishType)}</Text>
                                </View>
                            </View>

                            <Text style={styles.classLabel}>{entry.className}</Text>
                        </View>

                        {/* BACK SIDE — text left, QR right */}
                        <View style={styles.back}>
                            <View style={styles.backTextCol}>
                                <Text style={styles.backHorseName}>{entry.horseName}</Text>
                                <Text style={styles.backMoldName}>{entry.moldName}</Text>
                                <Text style={styles.backOwner}>@{entry.ownerAlias}</Text>
                                <Text style={styles.backFooter}>modelhorsehub.com</Text>
                            </View>
                            <View style={styles.qrCol}>
                                <QRBlock />
                            </View>
                        </View>
                    </View>
                ))}
            </Page>
        </Document>
    );
}
