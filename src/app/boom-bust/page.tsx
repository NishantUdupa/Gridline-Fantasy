"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { Scoring } from "@/lib/types";
import { boomBustBoard } from "@/lib/boom-bust";
import { useRankings } from "@/hooks/use-rankings";
import { ScoringControl } from "@/components/scoring-control";
import { HealthBadge } from "@/components/health-badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function BoomBustPage() {
  const [scoring, setScoring] = useState<Scoring>("ppr");
  const { data, loading, error } = useRankings(scoring);
  const board = useMemo(() => boomBustBoard(data?.rankings || []), [data]);
  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-4 py-10 sm:px-8">
      <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="metric-label">Weekly range versus recent form</p>
          <h1 className="font-heading text-5xl font-extrabold uppercase sm:text-6xl">Boom / Bust</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">The fifteen widest paths above recent production, and the fifteen most likely to fall short of it, using this week’s projection, ceiling, floor, matchup, and health.</p>
        </div>
        <ScoringControl value={scoring} onChange={setScoring} />
      </div>
      {error && <div className="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading ? <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-[640px]" />)}</div> : !board.booms.length ? <div className="grid min-h-72 place-items-center border border-dashed bg-white p-8 text-center"><div><h2 className="font-heading text-3xl font-bold uppercase">Not enough recent games</h2><p className="mt-2 text-sm text-muted-foreground">Boom and bust calls need at least two scored weeks.</p></div></div> :
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Board title="Most likely to boom" tone="boom" icon={<TrendingUp />} rows={board.booms} />
        <Board title="Most likely to bust" tone="bust" icon={<TrendingDown />} rows={board.busts} />
      </div>}
    </main>
  );
}

function Board({ title, tone, icon, rows }: { title: string; tone: "boom" | "bust"; icon: ReactNode; rows: ReturnType<typeof boomBustBoard>["booms"] }) {
  return (
    <section className="panel overflow-hidden">
      <div className={`flex items-center justify-between p-5 text-white ${tone === "boom" ? "bg-[#102c21]" : "bg-[#3d2a22]"}`}>
        <div><p className="metric-label !text-white/45">Week ahead</p><h2 className="font-heading text-3xl font-bold uppercase">{title}</h2></div>
        <span className={tone === "boom" ? "text-[#d7ff52]" : "text-[#ffb08a]"}>{icon}</span>
      </div>
      <div>
        {rows.map((row, index) => (
          <article key={row.ranking.player.id} className="border-b p-4 last:border-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <span className="font-heading text-2xl font-bold text-muted-foreground">{index + 1}</span>
                <div>
                  <div className="flex flex-wrap items-center gap-2"><Link href={`/player/${row.ranking.player.id}`} className="font-bold hover:underline">{row.ranking.player.name}</Link><HealthBadge status={row.ranking.player.injuryStatus} /></div>
                  <p className="text-xs text-muted-foreground">{row.ranking.player.team} · {row.ranking.player.position}{row.ranking.positionRank} · vs {row.ranking.opponent}</p>
                </div>
              </div>
              <div className="text-right"><p className="metric-label">Projection</p><b className="font-heading text-3xl">{row.ranking.projection}</b><p className="font-mono text-[11px] text-muted-foreground">{row.ranking.floor}–{row.ranking.ceiling} · recent {row.recent}</p></div>
            </div>
            <ul className="mt-3 space-y-1.5 pl-9 text-sm leading-5 text-muted-foreground">{row.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </article>
        ))}
      </div>
    </section>
  );
}
