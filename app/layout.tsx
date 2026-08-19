import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SiteNav } from "@/components/layout/SiteNav";
import { LiveFinancialProvider } from "@/components/live/LiveFinancialProvider";
import { buildLiveFinancialPayloadFromDisk } from "@/lib/live-financial-payload";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { HashScrollOnLoad } from "@/components/layout/HashScrollOnLoad";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
});

// Alte DIN 1451 was trialled as the UI face here and reverted: it ships no
// `gasp` table (so small sizes get no grid-fitting hints) and leaves
// OS/2 sxHeight/sCapHeight unset at -1, which is why body copy at 10-12px
// rendered visibly rougher than IBM Plex Sans. It's a signage typeface —
// built for large display, not small interface text.

const siteUrl = "https://www.aurabulk.xyz";
const siteTitle = "AURA Intelligence | BULK Analytics Terminal";
const siteDescription =
  "Real-time analytics for the BULK AURA pre-deposit campaign. Institutional-grade insights beyond the official interface.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-icon.png",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "AURA Analytics Terminal",
    title: siteTitle,
    description: siteDescription,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Disk snapshot only. Awaiting live indexer here made the root layout
  // dynamic, so every tab switch waited on the server before the new page
  // could render. The provider refreshes from /api/live-financials after paint.
  const live = buildLiveFinancialPayloadFromDisk();

  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body className="antialiased">
        <LiveFinancialProvider initial={live}>
          <HashScrollOnLoad />
          <SiteNav />
          <main>{children}</main>
          <ScrollToTop />
        </LiveFinancialProvider>
        <Analytics />
      </body>
    </html>
  );
}
