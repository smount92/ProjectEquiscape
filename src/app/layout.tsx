import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import "./studio.css";
import "./competition.css";

/* ── Extracted CSS (globals.css modularization sprint) ── */
// Layout components
import "@/components/Footer.css";
import "@/components/BackToTop.css";
import "@/components/CookieConsent.css";
// Core UI components
import "@/components/VaultReveal.css";
import "@/components/CommentSection.css";
import "@/components/Provenance.css";
import "@/components/Ratings.css";
import "@/components/TrophyCase.css";
import "@/components/RichEmbed.css";
import "@/components/GroupRegistry.css";
import "@/components/CsvImport.css";
// Social components
import "@/components/Notifications.css";
import "@/components/FollowFeed.css";
import "@/components/ChatGuardrails.css";
import "@/components/SocialFoundation.css";
// Page-specific styles
import "./WelcomeOnboarding.css";
import "./faq/faq.css";
import "./about/static.css";
import "./admin/admin.css";
import "./market/market.css";
import "./community/HelpId.css";
import "./shows/shows.css";
import "./shows/ShowBuilder.css";
import "./shows/RingConflict.css";
import "./stable/passport.css";
import "./stable/PhotoUpload.css";
import "./stable/PhotoReorder.css";
import "./stable/VisibilitySelector.css";
import "./stable/BatchResults.css";
import "./add-horse/gallery.css";
import "./reference/reference.css";
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

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif-theme" });

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
    </html >
  );
}

