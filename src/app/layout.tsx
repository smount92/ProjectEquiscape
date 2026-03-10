import type { Metadata } from "next";
import "./globals.css";
import "./studio.css";
import { SimpleModeProvider } from "@/lib/context/SimpleModeContext";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Model Horse Hub — Your Digital Stable",
  description:
    "A secure, privacy-first platform for model horse collectors to catalog their inventory with multi-angle photo galleries.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-simple-mode="false">
      <body>
        <SimpleModeProvider>
          <Header />
          <main>{children}</main>
        </SimpleModeProvider>
      </body>
    </html>
  );
}
