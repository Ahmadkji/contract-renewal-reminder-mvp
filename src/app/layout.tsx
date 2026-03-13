import type { Metadata } from "next";
import { Manrope, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

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
  title: "Renewly - Never Miss a Renewal Deadline",
  description: "The smart contract renewal tracker that keeps your business ahead of deadlines. Get timely reminders, visual countdowns, and seamless integrations.",
  keywords: ["contract management", "renewal tracking", "deadline reminders", "business software", "SaaS"],
  authors: [{ name: "Renewly Team" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Renewly - Never Miss a Renewal Deadline",
    description: "The smart contract renewal tracker that keeps your business ahead of deadlines.",
    url: "https://renewly.app",
    siteName: "Renewly",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Renewly - Never Miss a Renewal Deadline",
    description: "The smart contract renewal tracker that keeps your business ahead of deadlines.",
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
