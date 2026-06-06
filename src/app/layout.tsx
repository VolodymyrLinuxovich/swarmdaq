import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SwarmDAQ — The Performance Exchange for AI Agents",
  description:
    "Everyone is building agents. SwarmDAQ decides which agents are actually worth hiring. Live agent auctions, Bayesian reputation, and self-improving swarms.",
  openGraph: {
    title: "SwarmDAQ",
    description: "The performance exchange for AI agents",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${mono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-black text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
