import type { Metadata } from "next";
import { Barlow_Condensed, DM_Sans, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Activity } from "lucide-react";
import { MobileNav } from "@/components/mobile-nav";
import { PlayerSearch } from "@/components/player-search";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gridline | Weekly NFL Fantasy Analytics",
  description: "Season-aware NFL fantasy projections, rankings, trades, and start/sit decisions.",
};

const nav = [["Weekly", "/rankings"], ["Rest of Season", "/rest-of-season"], ["Boom / Bust", "/boom-bust"], ["My Roster", "/roster"], ["Trade Lab", "/trade"], ["Start / Sit", "/start-sit"]];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${barlow.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b1612]/95 text-white backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-8">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-sm bg-[#d7ff52] text-[#0b1612]"><Activity className="size-5" /></span>
              <span className="font-heading text-2xl font-bold uppercase tracking-[.09em]">Gridline</span>
              <span className="hidden border-l border-white/20 pl-3 text-[10px] font-semibold uppercase tracking-[.22em] text-white/50 sm:block">Fantasy Intelligence</span>
            </Link>
            <div className="flex items-center gap-3 lg:gap-5">
              <nav className="hidden items-center gap-4 lg:gap-6 md:flex">
                {nav.map(([label, href]) => <Link key={href} href={href} className="text-[11px] font-bold uppercase tracking-[.12em] text-white/65 transition hover:text-[#d7ff52]">{label}</Link>)}
              </nav>
              <PlayerSearch />
              <MobileNav />
            </div>
          </div>
        </header>
        {children}
        <footer className="border-t bg-[#0b1612] px-6 py-8 text-center text-xs uppercase tracking-[.16em] text-white/40">
          Gridline model • Free Sleeper data • Projections are estimates, not guarantees
        </footer>
      </body>
    </html>
  );
}
