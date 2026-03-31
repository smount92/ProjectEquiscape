import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

// Standard model horse show tag: 1¾" × 1³⁄₃₂" folded
// Unfolded (printed): 3½" × 1³⁄₃₂"
// In PDF points: 1 inch = 72 pts
const TAG_WIDTH = 252;  // 3.5 inches unfolded
const TAG_HEIGHT = 79;  // 1 3/32 inches (~1.09375")
const HALF_WIDTH = 126;  // 1.75 inches (each side when folded)

const styles = StyleSheet.create({
    page: {
        padding: 28,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 10,
        fontFamily: "Helvetica",
    },
    // Each tag is a fixed-size row with front (left) and back (right) side-by-side
    tagRow: {
        width: TAG_WIDTH,
        height: TAG_HEIGHT,
        flexDirection: "row",
    },
    // Front side (left half — visible when folded)
    front: {
        width: HALF_WIDTH,
        height: TAG_HEIGHT,
        border: "0.5pt dashed #B8A88A",
        borderRight: "0.5pt dotted #D4C9B0", // fold line
        borderTopLeftRadius: 3,
        borderBottomLeftRadius: 3,
        padding: 5,
        justifyContent: "space-between",
        backgroundColor: "#FDFCFA",
    },
    // Back side (right half — hidden when folded, contains name/QR)
    back: {
        width: HALF_WIDTH,
        height: TAG_HEIGHT,
        border: "0.5pt dashed #B8A88A",
        borderLeft: "none",
        borderTopRightRadius: 3,
        borderBottomRightRadius: 3,
        padding: 5,
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
    showFooter: {
        fontSize: 4,
        color: "#9A8A78",
        textAlign: "center",
    },
    // Back side elements
    backHorseName: {
        fontSize: 8,
        fontFamily: "Helvetica-Bold",
        color: "#2C2017",
        textAlign: "center",
        marginBottom: 1,
    },
    backMoldName: {
        fontSize: 5,
        color: "#594A3C",
        textAlign: "center",
        marginBottom: 2,
    },
    backOwner: {
        fontSize: 6,
        color: "#2C5545",
        fontFamily: "Helvetica-Bold",
        textAlign: "center",
    },
    backFooter: {
        fontSize: 4,
        color: "#B8A88A",
        textAlign: "center",
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
                    <Text style={{ fontSize: 6, color: "#B8A88A", textAlign: "center" }}>
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

                            {/* Breed / Sex / Make */}
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
                        </View>

                        {/* BACK SIDE (fold) */}
                        <View style={styles.back}>
                            <Text style={styles.backHorseName}>{entry.horseName}</Text>
                            <Text style={styles.backMoldName}>{entry.moldName}</Text>
                            <Text style={styles.backOwner}>@{entry.ownerAlias}</Text>
                            <Text style={styles.backFooter}>modelhorsehub.com</Text>
                        </View>
                    </View>
                ))}
            </Page>
        </Document>
    );
}
