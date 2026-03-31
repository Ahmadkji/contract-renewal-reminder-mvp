import type { Metadata } from "next";
import { Manrope, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SITE_URL } from "@/lib/site-url";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const sourceSerif4 = Source_Serif_4({
  variable: "--font-source-serif-4",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Contract Renewal Tracker for Small Teams | Renewly",
    template: "%s | Renewly",
  },
  description:
    "Renewly is a contract renewal tracker for small teams. Track contracts, get renewal reminders, and manage deadlines from one dashboard.",
  keywords: [
    "contract renewal tracker",
    "contract reminder software",
    "renewal deadline tracking",
    "contract renewal alerts",
    "contract management for small business",
  ],
  authors: [{ name: "Renewly Team" }],
  icons: {
    icon: "/favicon.ico",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "Contract Renewal Tracker for Small Teams | Renewly",
    description:
      "Track contracts, send renewal reminders, and avoid missed deadlines with Renewly.",
    url: "/",
    siteName: "Renewly",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Renewly contract renewal tracker dashboard preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contract Renewal Tracker for Small Teams | Renewly",
    description:
      "Track contracts and get renewal reminders before deadlines with Renewly.",
    images: ["/og-image.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
         className={`${manrope.variable} ${sourceSerif4.variable} ${jetBrainsMono.variable} antialiased bg-slate-950 text-slate-100 font-sans`}
         >
            {children}
            <Toaster />
         </body>
    </html>
  );
}
