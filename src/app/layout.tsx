import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { BootstrapClient } from "@/components/BootstrapClient";
import { QueryProvider } from "@/providers/QueryProvider";
import { conference } from "@/lib/conference";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

const sourceSerif = localFont({
  src: "../fonts/SourceSerif4-Variable.woff2",
  variable: "--font-source-serif",
  weight: "400 700",
  display: "swap",
  fallback: ["Times New Roman", "Georgia", "serif"],
});

const inter = localFont({
  src: "../fonts/Inter-Variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: conference.organization,
    template: `%s | ${conference.organization}`,
  },
  description: `${conference.siteName}: ${conference.conferenceName}. ${conference.theme}. Official online registration for the ${conference.dates.display} conference at ${conference.venue.name}.`,
  keywords: [
    "Philippine Nurses Association, Inc.",
    "PNA",
    "National Conference",
    "Philippines",
    "Government",
    "Registration",
  ],
  icons: {
    icon: [
      { url: "/images/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/pna-logo.png", sizes: "256x256", type: "image/png" },
    ],
    apple: [{ url: "/images/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/images/favicon-32.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sourceSerif.variable} ${inter.variable}`}>
      <body className="min-vh-100 d-flex flex-column antialiased overflow-x-hidden">
        <QueryProvider>
          <BootstrapClient />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
