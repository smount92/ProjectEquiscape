import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

// Use Helvetica (built-in to @react-pdf/renderer) — no network fetch needed
const styles = StyleSheet.create({
    page: {
        padding: 36,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        fontFamily: "Helvetica",
    },
    tag: {
        width: "48%",
        height: 120,
        border: "1pt dashed #D4C9B0",
        borderRadius: 6,
        padding: 8,
        justifyContent: "space-between",
    },
    horseName: {
        fontSize: 11,
        fontFamily: "Helvetica-Bold",
    },
    moldName: {
        fontSize: 9,
        color: "#594A3C",
    },
    showInfo: {
        fontSize: 8,
        color: "#7A6A58",
    },
    classLabel: {
        fontSize: 10,
        fontFamily: "Helvetica-Bold",
        color: "#2C5545",
    },
    entryNumber: {
        fontSize: 14,
        fontFamily: "Helvetica-Bold",
        textAlign: "right",
    },
});

interface ShowTagEntry {
    horseName: string;
    moldName: string;
    className: string;
    entryNumber: number;
    ownerAlias: string;
}

interface ShowTagsProps {
    showName: string;
    showDate: string;
    entries: ShowTagEntry[];
}

export default function ShowTags({ showName, showDate, entries }: ShowTagsProps) {
    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                {entries.map((entry, i) => (
                    <View key={i} style={styles.tag}>
                        <View>
                            <Text style={styles.horseName}>{entry.horseName}</Text>
                            <Text style={styles.moldName}>{entry.moldName}</Text>
                            <Text style={styles.classLabel}>{entry.className}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                            <View>
                                <Text style={styles.showInfo}>{showName}</Text>
                                <Text style={styles.showInfo}>{showDate} · @{entry.ownerAlias}</Text>
                            </View>
                            <Text style={styles.entryNumber}>#{entry.entryNumber}</Text>
                        </View>
                    </View>
                ))}
            </Page>
        </Document>
    );
}
