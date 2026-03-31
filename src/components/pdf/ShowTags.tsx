import { Document, Page, View, Text, StyleSheet, Svg, Rect, Path } from "@react-pdf/renderer";

const styles = StyleSheet.create({
    page: {
        padding: 24,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        fontFamily: "Helvetica",
    },
    // Each tag is a full-width row with front (left) and back (right) side-by-side
    tagRow: {
        width: "100%",
        flexDirection: "row",
        marginBottom: 4,
    },
    // Front side (left half — visible when folded)
    front: {
        width: "50%",
        height: 130,
        border: "1pt dashed #B8A88A",
        borderRight: "1pt dotted #D4C9B0", // fold line
        borderRadius: 4,
        padding: 8,
        justifyContent: "space-between",
        backgroundColor: "#FDFCFA",
    },
    // Back side (right half — hidden when folded, contains name/QR)
    back: {
        width: "50%",
        height: 130,
        border: "1pt dashed #B8A88A",
        borderLeft: "none",
        borderRadius: 4,
        padding: 8,
        justifyContent: "space-between",
        backgroundColor: "#F8F5F0",
    },
    // Front side elements
    horseNumber: {
        fontSize: 18,
        fontFamily: "Helvetica-Bold",
        color: "#2C5545",
        textAlign: "center",
        marginBottom: 4,
    },
    horseNumberLabel: {
        fontSize: 7,
        color: "#7A6A58",
        textAlign: "center",
        marginBottom: 6,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 2,
    },
    infoLabel: {
        fontSize: 7,
        color: "#7A6A58",
        fontFamily: "Helvetica-Bold",
    },
    infoValue: {
        fontSize: 8,
        color: "#2C2017",
    },
    classLabel: {
        fontSize: 9,
        fontFamily: "Helvetica-Bold",
        color: "#2C5545",
        marginTop: 4,
        padding: 3,
        backgroundColor: "#E8F5E9",
        borderRadius: 2,
        textAlign: "center",
    },
    showFooter: {
        fontSize: 6,
        color: "#9A8A78",
        textAlign: "center",
    },
    // Back side elements
    backHorseName: {
        fontSize: 13,
        fontFamily: "Helvetica-Bold",
        color: "#2C2017",
        textAlign: "center",
        marginBottom: 2,
    },
    backMoldName: {
        fontSize: 8,
        color: "#594A3C",
        textAlign: "center",
        marginBottom: 8,
    },
    backOwner: {
        fontSize: 9,
        color: "#2C5545",
        fontFamily: "Helvetica-Bold",
        textAlign: "center",
        marginBottom: 6,
    },
    qrPlaceholder: {
        width: 60,
        height: 60,
        alignSelf: "center",
        borderRadius: 4,
    },
    backFooter: {
        fontSize: 6,
        color: "#B8A88A",
        textAlign: "center",
        marginTop: 4,
    },
    // Fold indicator
    foldLine: {
        position: "absolute",
        top: 0,
        left: "50%",
        width: 1,
        height: "100%",
    },
    foldLabel: {
        fontSize: 5,
        color: "#D4C9B0",
        textAlign: "center",
        marginTop: 1,
    },
    // Cut line
    cutLabel: {
        fontSize: 5,
        color: "#D4C9B0",
        textAlign: "right",
        marginBottom: 1,
        width: "100%",
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
    horseNumber: string; // XXX-YYY format
    passportUrl: string;
}

interface ShowTagsProps {
    showName: string;
    showDate: string;
    entries: ShowTagEntry[];
}

// Simple QR-like pattern (decorative, not scannable — just visual indicator)
function QRCodeBlock({ url }: { url: string }) {
    // We'll use a simple grid pattern as a visual QR placeholder
    // For a real QR code, you'd need a QR library — but @react-pdf can't use canvas
    return (
        <View style={styles.qrPlaceholder}>
            <Svg viewBox="0 0 60 60" width={60} height={60}>
                <Rect x={0} y={0} width={60} height={60} rx={4} fill="#FFFFFF" stroke="#D4C9B0" strokeWidth={1} />
                {/* Corner squares */}
                <Rect x={4} y={4} width={16} height={16} fill="#2C5545" rx={2} />
                <Rect x={6} y={6} width={12} height={12} fill="#FFFFFF" rx={1} />
                <Rect x={8} y={8} width={8} height={8} fill="#2C5545" rx={1} />

                <Rect x={40} y={4} width={16} height={16} fill="#2C5545" rx={2} />
                <Rect x={42} y={6} width={12} height={12} fill="#FFFFFF" rx={1} />
                <Rect x={44} y={8} width={8} height={8} fill="#2C5545" rx={1} />

                <Rect x={4} y={40} width={16} height={16} fill="#2C5545" rx={2} />
                <Rect x={6} y={42} width={12} height={12} fill="#FFFFFF" rx={1} />
                <Rect x={8} y={44} width={8} height={8} fill="#2C5545" rx={1} />

                {/* Center pattern */}
                <Rect x={24} y={24} width={12} height={12} fill="#2C5545" rx={1} />
                <Rect x={26} y={26} width={8} height={8} fill="#FFFFFF" rx={1} />

                {/* Data dots (decorative) */}
                <Rect x={24} y={6} width={4} height={4} fill="#594A3C" />
                <Rect x={30} y={6} width={4} height={4} fill="#594A3C" />
                <Rect x={24} y={12} width={4} height={4} fill="#594A3C" />
                <Rect x={6} y={24} width={4} height={4} fill="#594A3C" />
                <Rect x={12} y={24} width={4} height={4} fill="#594A3C" />
                <Rect x={6} y={30} width={4} height={4} fill="#594A3C" />
                <Rect x={40} y={24} width={4} height={4} fill="#594A3C" />
                <Rect x={46} y={30} width={4} height={4} fill="#594A3C" />
                <Rect x={24} y={40} width={4} height={4} fill="#594A3C" />
                <Rect x={30} y={46} width={4} height={4} fill="#594A3C" />
                <Rect x={36} y={40} width={4} height={4} fill="#594A3C" />
                <Rect x={40} y={46} width={4} height={4} fill="#594A3C" />
            </Svg>
            <Text style={{ fontSize: 5, color: "#B8A88A", textAlign: "center", marginTop: 2 }}>
                Scan for passport
            </Text>
        </View>
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
                    <Text style={{ fontSize: 7, color: "#B8A88A", textAlign: "center" }}>
                        ✂ Cut along dashed lines · Fold along center dotted line · {showName} — {showDate}
                    </Text>
                </View>

                {entries.map((entry, i) => (
                    <View key={i} style={styles.tagRow} wrap={false}>
                        {/* FRONT SIDE */}
                        <View style={styles.front}>
                            {/* Horse number - big and prominent */}
                            <View>
                                <Text style={styles.horseNumber}>{entry.horseNumber}</Text>
                                <Text style={styles.horseNumberLabel}>ENTRY #{entry.entryNumber}</Text>
                            </View>

                            {/* Breed / Sex / Make row */}
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

                            {/* Class */}
                            <Text style={styles.classLabel}>{entry.className}</Text>

                            {/* Show footer */}
                            <Text style={styles.showFooter}>{showName}</Text>
                        </View>

                        {/* BACK SIDE (fold) */}
                        <View style={styles.back}>
                            <View>
                                <Text style={styles.backHorseName}>{entry.horseName}</Text>
                                <Text style={styles.backMoldName}>{entry.moldName}</Text>
                            </View>

                            <QRCodeBlock url={entry.passportUrl} />

                            <Text style={styles.backOwner}>@{entry.ownerAlias}</Text>
                            <Text style={styles.backFooter}>modelhorsehub.com</Text>
                        </View>
                    </View>
                ))}
            </Page>
        </Document>
    );
}
