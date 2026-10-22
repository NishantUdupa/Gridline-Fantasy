import Link from "next/link";
import { ArrowRight, BarChart3, CalendarRange, GitCompareArrows, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { HomeAccuracy } from "@/components/home-accuracy";
import { calculateRankings } from "@/lib/engine";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Home() {
  const data = await calculateRankings("ppr");
  const leaders = data.rankings.slice(0, 5);
  const tools = [
    [BarChart3, "Weekly rankings", "Position and overall boards with floor, ceiling and form.", "/rankings"],
    [CalendarRange, "Rest of season", "Schedule, availability and value-over-replacement rankings.", "/rest-of-season"],
    [Users, "My roster", "Save up to 15 players and optimize your weekly lineup.", "/roster"],
    [GitCompareArrows, "Trade lab", "Evaluate every side of a two- or three-team deal.", "/trade"],
    [ShieldCheck, "Start / Sit", "Compare up to four players with an evidence-backed lean.", "/start-sit"],
    [TrendingUp, "Boom / Bust", "Fifteen likely overperformers and fifteen likely letdowns.", "/boom-bust"],
  ] as const;
  return (
    <main>
      <section className="relative overflow-hidden bg-[#102c21] text-white">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(90deg,transparent_49.5%,#d7ff52_50%,transparent_50.5%),repeating-linear-gradient(0deg,transparent,transparent_68px,rgba(255,255,255,.15)_69px)]" />
        <div className="relative mx-auto grid max-w-[1440px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:py-28">
          <div>
            <Badge className="mb-5 border-[#d7ff52]/30 bg-[#d7ff52]/10 text-[#d7ff52]">WEEK {data.week} · LIVE MODEL</Badge>
            <h1 className="max-w-4xl font-heading text-6xl font-extrabold uppercase leading-[.87] tracking-tight sm:text-8xl">
              See the game<br/><span className="text-[#d7ff52]">before it scores.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-white/65">Full-season performance, adaptive statistical weights, matchup context and injury signals—compressed into one decisive weekly rank.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/rankings" className={buttonVariants({ size: "lg", className: "bg-[#d7ff52] font-bold text-[#102c21] hover:bg-[#c5eb48]" })}>Open Week {data.week} Rankings <ArrowRight /></Link>
              <Link href="/roster" className={buttonVariants({ size: "lg", variant: "outline", className: "border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white" })}>Build My Roster</Link>
            </div>
          </div>
          <div className="self-end border border-white/15 bg-black/15 p-5 backdrop-blur-sm">
            <div className="mb-4 flex items-end justify-between border-b border-white/10 pb-3">
              <div><p className="metric-label !text-white/40">Model board</p><h2 className="font-heading text-2xl font-bold uppercase">Top overall · PPR</h2></div>
              <BarChart3 className="text-[#d7ff52]" />
            </div>
            {leaders.map((r) => (
              <Link href={`/player/${r.player.id}`} key={r.player.id} className="grid grid-cols-[2rem_1fr_auto] items-center border-b border-white/10 py-3 last:border-0">
                <span className="font-heading text-xl text-white/35">{r.overallRank}</span>
                <span><b className="block text-sm">{r.player.name}</b><small className="text-white/45">{r.player.team} · {r.player.position}{r.positionRank} · vs {r.opponent}</small></span>
                <span className="font-heading text-2xl font-bold text-[#d7ff52]">{r.projection}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <HomeAccuracy />
      <section className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8">
        <div className="mb-8"><p className="metric-label">Decision center</p><h2 className="font-heading text-4xl font-bold uppercase">One model. Every decision.</h2></div>
        <div className="grid gap-px overflow-hidden border bg-border md:grid-cols-2 lg:grid-cols-3">
          {tools.map(([Icon, title, copy, href]) => (
            <Link href={href} key={title} className="group bg-white p-7 transition hover:bg-[#f9ffe7]">
              <Icon className="mb-8 size-7 text-[#1d6a49]" />
              <h3 className="font-heading text-2xl font-bold uppercase">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
              <ArrowRight className="mt-6 size-4 transition group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
