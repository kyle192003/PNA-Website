import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Inter } from "next/font/google";
import { BootstrapClient } from "@/components/BootstrapClient";
import { QueryProvider } from "@/providers/QueryProvider";
import { conference } from "@/lib/conference";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
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
    icon: [{ url: conference.logo.src, type: "image/jpeg" }],
    apple: [{ url: conference.logo.src, type: "image/jpeg" }],
    shortcut: conference.logo.src,
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
