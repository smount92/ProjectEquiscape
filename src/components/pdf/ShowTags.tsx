import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";

Font.register({
    family: "Inter",
    src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2",
});

const styles = StyleSheet.create({
    page: {
        padding: 36,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
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
        fontFamily: "Inter",
        fontSize: 11,
        fontWeight: 700,
    },
    moldName: {
        fontFamily: "Inter",
        fontSize: 9,
        color: "#594A3C",
    },
    showInfo: {
        fontFamily: "Inter",
        fontSize: 8,
        color: "#7A6A58",
    },
    classLabel: {
        fontFamily: "Inter",
        fontSize: 10,
        fontWeight: 600,
        color: "#2C5545",
    },
    entryNumber: {
        fontFamily: "Inter",
        fontSize: 14,
        fontWeight: 700,
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
