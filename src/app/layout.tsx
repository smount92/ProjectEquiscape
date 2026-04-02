import type { Metadata } from"next";
import { Inter, Playfair_Display } from"next/font/google";
import Script from"next/script";
import"./globals.css";

import { SimpleModeProvider } from"@/lib/context/SimpleModeContext";
import { ToastProvider } from"@/lib/context/ToastContext";
import { NotificationProvider } from"@/lib/context/NotificationProvider";
import Header from"@/components/Header";
import Footer from"@/components/Footer";
import BackToTop from"@/components/BackToTop";
import CookieConsent from"@/components/CookieConsent";
import OfflineIndicator from"@/components/OfflineIndicator";
import { SerwistProvider } from"@/app/serwist-provider";
import { cn } from "@/lib/utils";



const GA_MEASUREMENT_ID ="G-7DWKBT1JV9";

export const metadata: Metadata = {
 title: {
 default:"Model Horse Hub — Your Digital Stable",
 template:"%s — Model Horse Hub",
 },
 description:
"A secure, privacy-first platform for model horse collectors to catalog their inventory with multi-angle photo galleries.",
 metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ||"https://modelhorsehub.com"),
 openGraph: {
 type:"website",
 siteName:"Model Horse Hub",
 title:"Model Horse Hub — Your Digital Stable",
 description:
"The all-in-one platform for model horse collectors and artists. 10,500+ reference releases, Hoofprint™ provenance, LSQ photography, private financial vault, and community marketplace.",
 locale:"en_US",
 },
 twitter: {
 card:"summary",
 title:"Model Horse Hub — Your Digital Stable",
 description:
"The all-in-one platform for model horse collectors and artists. 10,500+ reference releases, Hoofprint™ provenance, and community marketplace.",
 },
 robots: {
 index: true,
 follow: true,
 },
 manifest: "/manifest.json",
 appleWebApp: {
 capable: true,
 statusBarStyle: "default",
 title: "Model Horse Hub",
 },
 icons: {
 apple: "/icons/icon-192.png",
 },
 other: {
 "mobile-web-app-capable": "yes",
 },
};

const inter = Inter({ subsets: ["latin"], variable:"--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable:"--font-serif-theme" });

export default function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode;
}>) {
 return (
 <html lang="en" data-simple-mode="false" className={`${inter.variable} ${playfair.variable}`}>
 <head>
 <Script
 src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
 strategy="afterInteractive"
 />
 <Script id="google-analytics" strategy="afterInteractive">
 {`
 window.dataLayer = window.dataLayer || [];
 function gtag(){dataLayer.push(arguments);}
 gtag('js', new Date());
 gtag('config', '${GA_MEASUREMENT_ID}');
 `}
 </Script>
 <meta name="theme-color" content="#2C5545" />
 <meta name="apple-mobile-web-app-capable" content="yes" />
 <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
 </head>
 <body className="w-full overflow-x-hidden antialiased">
 <SerwistProvider swUrl="/serwist/sw.js">
 <SimpleModeProvider>
 <ToastProvider>
 <NotificationProvider>
 <Header />
 <main className="min-h-[calc(100dvh-var(--header-height))]">{children}</main>
 <Footer />
 <BackToTop />
 <CookieConsent />
 <OfflineIndicator />
 </NotificationProvider>
 </ToastProvider>
 </SimpleModeProvider>
 </SerwistProvider>
 </body>
 </html>
 );
}
