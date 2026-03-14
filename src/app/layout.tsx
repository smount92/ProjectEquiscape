import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "./studio.css";
import "./competition.css";
import { SimpleModeProvider } from "@/lib/context/SimpleModeContext";
import { ToastProvider } from "@/lib/context/ToastContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";
import CookieConsent from "@/components/CookieConsent";

const GA_MEASUREMENT_ID = "G-7DWKBT1JV9";

export const metadata: Metadata = {
  title: {
    default: "Model Horse Hub — Your Digital Stable",
    template: "%s — Model Horse Hub",
  },
  description:
    "A secure, privacy-first platform for model horse collectors to catalog their inventory with multi-angle photo galleries.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com"),
  openGraph: {
    type: "website",
    siteName: "Model Horse Hub",
    title: "Model Horse Hub — Your Digital Stable",
    description:
      "The all-in-one platform for model horse collectors and artists. 10,500+ reference releases, Hoofprint™ provenance, LSQ photography, private financial vault, and community marketplace.",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Model Horse Hub — Your Digital Stable",
    description:
      "The all-in-one platform for model horse collectors and artists. 10,500+ reference releases, Hoofprint™ provenance, and community marketplace.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-simple-mode="false">
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
      </head>
      <body>
        <SimpleModeProvider>
          <ToastProvider>
            <Header />
            <main>{children}</main>
            <Footer />
            <BackToTop />
            <CookieConsent />
          </ToastProvider>
        </SimpleModeProvider>
      </body>
    </html>
  );
}

