"use client";

import { Document, Page, Text, View, StyleSheet, Image, Font } from"@react-pdf/renderer";

// ============================================================
// CoA PDF Styles
// ============================================================

Font.register({
 family:"Inter",
 fonts: [
 { src:"/fonts/Inter-Regular.ttf", fontWeight: 400 },
 { src:"/fonts/Inter-SemiBold.ttf", fontWeight: 600 },
 { src:"/fonts/Inter-Bold.ttf", fontWeight: 700 },
 ],
});

const s = StyleSheet.create({
 page: {
 fontFamily:"Inter",
 fontSize: 10,
 color:"#1a1a2e",
 padding: 40,
 backgroundColor:"#ffffff",
 position:"relative",
 },
 // ── Header ──
 headerRow: {
 flexDirection:"row",
 justifyContent:"space-between",
 alignItems:"center",
 marginBottom: 20,
 paddingBottom: 15,
 borderBottomWidth: 2,
 borderBottomColor:"#7c6df0",
 },
 brand: {
 fontSize: 12,
 fontWeight: 700,
 color:"#7c6df0",
 letterSpacing: 2,
 },
 title: {
 fontSize: 20,
 fontWeight: 700,
 color:"#1a1a2e",
 textAlign:"center",
 },
 subtitle: {
 fontSize: 10,
 color:"#6b6b80",
 textAlign:"center",
 marginTop: 2,
 },
 // ── Content ──
 mainSection: {
 flexDirection:"row",
 gap: 20,
 marginTop: 15,
 marginBottom: 20,
 },
 photoSection: {
 width:"40%",
 },
 photo: {
 width:"100%",
 height: 180,
 objectFit:"contain",
 borderRadius: 6,
 backgroundColor:"#f5f5f5",
 },
 photoPlaceholder: {
 width:"100%",
 height: 180,
 backgroundColor:"#f0f0f5",
 borderRadius: 6,
 justifyContent:"center",
 alignItems:"center",
 },
 placeholderEmoji: {
 fontSize: 40,
 color:"#a0a0b8",
 },
 infoSection: {
 width:"60%",
 gap: 8,
 },
 infoRow: {
 flexDirection:"row",
 borderBottomWidth: 0.5,
 borderBottomColor:"#eee",
 paddingBottom: 5,
 },
 infoLabel: {
 width:"35%",
 fontSize: 9,
 color:"#6b6b80",
 fontWeight: 600,
 },
 infoValue: {
 width:"65%",
 fontSize: 9,
 color:"#1a1a2e",
 },
 horseName: {
 fontSize: 16,
 fontWeight: 700,
 marginBottom: 8,
 color:"#1a1a2e",
 },
 // ── Hoofprint ──
 hoofprintBox: {
 backgroundColor:"#f8f7ff",
 borderWidth: 1,
 borderColor:"#e8e4ff",
 borderRadius: 6,
 padding: 12,
 marginBottom: 20,
 flexDirection:"row",
 justifyContent:"space-around",
 },
 hoofprintStat: {
 alignItems:"center",
 },
 hoofprintValue: {
 fontSize: 18,
 fontWeight: 700,
 color:"#7c6df0",
 },
 hoofprintLabel: {
 fontSize: 8,
 color:"#6b6b80",
 marginTop: 2,
 },
 // ── QR + PIN ──
 claimSection: {
 alignItems:"center",
 marginTop: 10,
 marginBottom: 15,
 padding: 20,
 borderWidth: 2,
 borderColor:"#7c6df0",
 borderRadius: 8,
 borderStyle:"dashed",
 },
 qrImage: {
 width: 160,
 height: 160,
 marginBottom: 12,
 },
 pinLabel: {
 fontSize: 10,
 color:"#6b6b80",
 marginBottom: 4,
 },
 pinCode: {
 fontSize: 28,
 fontWeight: 700,
 color:"#7c6df0",
 letterSpacing: 6,
 marginBottom: 12,
 },
 instructions: {
 fontSize: 9,
 color:"#6b6b80",
 textAlign:"center",
 lineHeight: 1.5,
 maxWidth: 400,
 },
 // ── Footer ──
 footer: {
 position:"absolute",
 bottom: 25,
 left: 40,
 right: 40,
 flexDirection:"row",
 justifyContent:"space-between",
 fontSize: 7,
 color:"#a0a0b8",
 borderTopWidth: 1,
 borderTopColor:"#eee",
 paddingTop: 8,
 },
});

// ============================================================
// Component
// ============================================================

interface CoaData {
 horseName: string;
 reference: string;
 finish: string;
 condition: string;
 pin: string;
 timelineCount: number;
 ownerCount: number;
 ownerAlias: string;
 generatedAt: string;
 photoUrl: string | null;
 qrDataUri: string;
}

export default function CertificateOfAuthenticity({ data }: { data: CoaData }) {
 return (
 <Document title={`CoA — ${data.horseName}`} author="Model Horse Hub" subject="Certificate of Authenticity">
 <Page size="LETTER" style={s.page}>
 {/* Header */}
 <View style={s.headerRow}>
 <Text style={s.brand}>MODEL HORSE HUB</Text>
 <View>
 <Text style={s.title}>Certificate of Authenticity</Text>
 <Text style={s.subtitle}>Hoofprint™ Verified Provenance</Text>
 </View>
 <Text style={{ fontSize: 8, color:"#a0a0b8" }}>{data.generatedAt}</Text>
 </View>

 {/* Main: Photo + Info */}
 <View style={s.mainSection}>
 <View style={s.photoSection}>
 {data.photoUrl ? (
 <Image src={data.photoUrl} style={s.photo} />
 ) : (
 <View style={s.photoPlaceholder}>
 <Text style={s.placeholderEmoji}>🐴</Text>
 </View>
 )}
 </View>

 <View style={s.infoSection}>
 <Text style={s.horseName}>{data.horseName}</Text>

 <View style={s.infoRow}>
 <Text style={s.infoLabel}>Reference</Text>
 <Text style={s.infoValue}>{data.reference}</Text>
 </View>
 <View style={s.infoRow}>
 <Text style={s.infoLabel}>Finish</Text>
 <Text style={s.infoValue}>{data.finish}</Text>
 </View>
 <View style={s.infoRow}>
 <Text style={s.infoLabel}>Condition</Text>
 <Text style={s.infoValue}>{data.condition}</Text>
 </View>
 <View style={s.infoRow}>
 <Text style={s.infoLabel}>Current Owner</Text>
 <Text style={s.infoValue}>@{data.ownerAlias}</Text>
 </View>
 </View>
 </View>

 {/* Hoofprint Summary */}
 <View style={s.hoofprintBox}>
 <View style={s.hoofprintStat}>
 <Text style={s.hoofprintValue}>{data.timelineCount}</Text>
 <Text style={s.hoofprintLabel}>Timeline Events</Text>
 </View>
 <View style={s.hoofprintStat}>
 <Text style={s.hoofprintValue}>{data.ownerCount}</Text>
 <Text style={s.hoofprintLabel}>Owner{data.ownerCount !== 1 ?"s" :""}</Text>
 </View>
 </View>

 {/* QR + PIN */}
 <View style={s.claimSection}>
 <Image src={data.qrDataUri} style={s.qrImage} />
 <Text style={s.pinLabel}>Claim PIN</Text>
 <Text style={s.pinCode}>{data.pin}</Text>
 <Text style={s.instructions}>
 Scan this QR code or visit modelhorsehub.com/claim and enter PIN {data.pin} to claim this model
 and inherit its full Hoofprint™ history.
 </Text>
 </View>

 {/* Footer */}
 <View style={s.footer}>
 <Text>Model Horse Hub — modelhorsehub.com</Text>
 <Text>This certificate verifies provenance through the Hoofprint™ system</Text>
 <Text>{data.generatedAt}</Text>
 </View>
 </Page>
 </Document>
 );
}
