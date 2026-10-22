"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BrainCircuit, CalendarRange, ShieldCheck } from "lucide-react";
import type { Position, Scoring } from "@/lib/types";
import { MatchupCalendar } from "@/components/matchup-calendar";
import { useRestOfSeasonRankings } from "@/hooks/use-rankings";
import { ScoringControl } from "@/components/scoring-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TeamMark } from "@/components/team-mark";
import { FormArrow, injuryTag, positionAccent } from "@/components/form-arrow";

export default function RestOfSeasonPage() {
  const [scoring, setScoring] = useState<Scoring>("ppr");
  const [position, setPosition] = useState<"ALL" | "FLEX" | Position>("ALL");
  const { data, loading, error } = useRestOfSeasonRankings(scoring);
  const rankings = useMemo(() => (data?.rankings || [])
    .filter((r) => position === "ALL" || (position === "FLEX" ? ["RB", "WR", "TE"].includes(r.player.position) : r.player.position === position))
    .slice(0, position === "ALL" ? 150 : 60), [data, position]);
  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-4 py-10 sm:px-8">
      <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div><p className="metric-label">Long-horizon model board</p><h1 className="font-heading text-5xl font-extrabold uppercase sm:text-6xl">Rest of Season</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Projected remaining production adjusted for schedule strength, games available, positional scarcity, current trajectory, and injury recovery risk.</p></div>
        <ScoringControl value={scoring} onChange={setScoring} />
      </div>
      <section className="mb-5 grid gap-px border bg-border md:grid-cols-3">
        {[
          [BrainCircuit, "Performance baseline", "Season body, recent EWMA, pre-injury output and current projection."],
          [CalendarRange, "Remaining schedule", "Every game left, opponent-adjusted by defense versus position."],
          [ShieldCheck, "Availability model", "Expected missed games and post-return workload factor by injury type."],
        ].map(([Icon, title, copy]) => <div key={title as string} className="flex gap-3 bg-white p-4"><Icon className="mt-1 size-5 shrink-0 text-[#1d6a49]" /><div><b className="text-sm">{title as string}</b><p className="mt-1 text-xs leading-5 text-muted-foreground">{copy as string}</p></div></div>)}
      </section>
      {error && <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <div className="panel overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b bg-[#eef2e9] p-4 sm:flex-row sm:items-center">
          <div className="max-w-full overflow-x-auto pb-1">
            <Tabs value={position} onValueChange={(v) => setPosition(v as typeof position)}>
              <TabsList className="w-max min-w-max">{["ALL", "QB", "RB", "WR", "TE", "FLEX", "K", "DEF"].map((p) => <TabsTrigger className="min-w-12 flex-none data-active:ring-1 data-active:ring-[#1d6a49]/20" value={p} key={p}>{p === "ALL" ? "Overall" : p}</TabsTrigger>)}</TabsList>
            </Tabs>
          </div>
          <span className="text-xs text-muted-foreground">Updated from Week {data?.week || "—"} · Smart value-over-replacement rank</span>
        </div>
        {loading ? <div className="space-y-3 p-5">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div> :
        <div className="overflow-x-auto"><Table>
          <TableHeader><TableRow className="bg-[#102c21] hover:bg-[#102c21]">
            {["ROS RK", "PLAYER", "ROS PTS", "ROS PPG", "ACTIVE GAMES", "SCHEDULE", "MATCHUPS", "VALUE"].map((h) => <TableHead key={h} className="text-[10px] font-bold tracking-widest text-white/60">{h}</TableHead>)}
          </TableRow></TableHeader>
          <TableBody>{rankings.map((r, index) => {
            const rank = position === "ALL" ? r.rosRank : position === "FLEX" ? index + 1 : r.rosPositionRank;
            const tag = injuryTag(r.player.injuryStatus);
            const accent = positionAccent[r.player.position];
            return <TableRow key={r.player.id} className="group h-16">
            <TableCell className="font-heading text-xl font-bold tabular-nums text-muted-foreground">{String(rank).padStart(2, "0")}</TableCell>
            <TableCell><Link href={`/player/${r.player.id}`} className="flex items-center gap-3"><TeamMark team={r.player.team} /><span><span className="flex items-center gap-1.5"><b className="group-hover:text-[#1d6a49]">{r.player.name}</b>{tag && <span title={r.player.injuryStatus || undefined} className="text-[11px] font-bold text-red-600/80">{tag}</span>}</span><span className="mt-0.5 flex items-center gap-2"><small className="font-semibold" style={{ color: accent }}>{`${r.player.position}${r.rosPositionRank}`}</small><FormArrow trend={r.trend} /></span></span><ArrowUpRight className="size-3 opacity-0 group-hover:opacity-100" /></Link></TableCell>
            <TableCell className="font-heading text-2xl font-extrabold">{r.rosProjection}</TableCell>
            <TableCell className="font-mono text-xs">{r.rosPpg}</TableCell>
            <TableCell className="font-mono text-xs">{r.expectedGamesActive} / {r.gamesRemaining}</TableCell>
            <TableCell><b className="font-heading text-lg">{r.scheduleGrade}</b></TableCell>
            <TableCell className="py-1">{r.matchups && <MatchupCalendar matchups={r.matchups} currentWeek={data?.week || 0} grow />}</TableCell>
            <TableCell className="font-mono text-xs">{r.valueScore}</TableCell>
          </TableRow>;
          })}</TableBody>
        </Table></div>}
      </div>
    </main>
  );
}
