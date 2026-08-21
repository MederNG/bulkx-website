import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SiteNav } from "@/components/layout/SiteNav";
import { LiveFinancialProvider } from "@/components/live/LiveFinancialProvider";
import { LIVE_FINANCIAL_SEED } from "@/lib/live-financial-seed";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { HashScrollOnLoad } from "@/components/layout/HashScrollOnLoad";

/** Nav, labels, tier names, big KPI figures. */
const familjenGrotesk = localFont({
  src: "../fonts/FamiljenGrotesk-VariableFont_wght.ttf",
  variable: "--font-familjen",
  weight: "100 900",
  display: "swap",
});

/** Table cells, axis ticks, week markers, TVL deltas. */
const overpassMono = localFont({
  src: "../fonts/OverpassMono-VariableFont_wght.ttf",
  variable: "--font-overpass-mono",
  weight: "100 900",
  display: "swap",
});

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
  // Seed is computed once per process, not on every RSC navigation. Walking
  // the leaderboard here used to stall every tab switch. Live numbers still
  // arrive from /api/live-financials after paint.
  const live = LIVE_FINANCIAL_SEED;

  return (
    <html lang="en" className={`${familjenGrotesk.variable} ${overpassMono.variable}`}>
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
