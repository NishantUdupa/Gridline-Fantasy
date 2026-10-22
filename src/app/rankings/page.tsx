"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronsUpDown, Database } from "lucide-react";
import type { Position, Ranking, Scoring } from "@/lib/types";
import { useRankings } from "@/hooks/use-rankings";
import { ScoringControl } from "@/components/scoring-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TeamMark } from "@/components/team-mark";
import { FormArrow, injuryTag, positionAccent } from "@/components/form-arrow";
import { cn } from "@/lib/utils";

const trendOrder = { Rising: 3, New: 2, Steady: 1, Fading: 0 };
const gradeOrder: Record<string, number> = { A: 3, B: 2, C: 1, D: 0 };

type SortKey = "rank" | "player" | "projection" | "range" | "season" | "form" | "matchup";
type Row = { ranking: Ranking; rank: number };

const columns: { key: SortKey; label: string; className?: string }[] = [
  { key: "rank", label: "RK", className: "w-16" },
  { key: "player", label: "PLAYER" },
  { key: "projection", label: "PROJ" },
  { key: "range", label: "RANGE", className: "min-w-56" },
  { key: "season", label: "SEASON" },
  { key: "form", label: "FORM" },
  { key: "matchup", label: "MATCHUP" },
];

const sortValue: Record<SortKey, (row: Row) => number | string> = {
  rank: (row) => row.rank,
  player: (row) => row.ranking.player.name,
  projection: (row) => row.ranking.projection,
  range: (row) => row.ranking.ceiling - row.ranking.floor,
  season: (row) => row.ranking.seasonPpg,
  form: (row) => trendOrder[row.ranking.trend],
  matchup: (row) => gradeOrder[row.ranking.matchupGrade] ?? -1,
};

/** Rank and player read naturally ascending; numeric signals read best highest-first. */
const ascendingFirst = new Set<SortKey>(["rank", "player"]);

function formatUpdated(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function RankingsPage() {
  const [scoring, setScoring] = useState<Scoring>("ppr");
  const [position, setPosition] = useState<"ALL" | "FLEX" | Position>("ALL");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "rank", dir: "asc" });
  const { data, loading, error } = useRankings(scoring);

  const rows = useMemo<Row[]>(() => (data?.rankings || [])
    .filter((r) => position === "ALL" || (position === "FLEX" ? ["RB", "WR", "TE"].includes(r.player.position) : r.player.position === position))
    .slice(0, position === "ALL" ? 100 : 60)
    .map((ranking, index) => ({ ranking, rank: position === "ALL" ? ranking.overallRank : position === "FLEX" ? index + 1 : ranking.positionRank })), [data, position]);

  const sorted = useMemo(() => {
    const read = sortValue[sort.key];
    const direction = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = read(a), bv = read(b);
      const diff = typeof av === "string" ? av.localeCompare(bv as string) : av - (bv as number);
      return diff * direction || a.rank - b.rank;
    });
  }, [rows, sort]);

  const scaleMax = useMemo(() => Math.max(1, ...rows.map((row) => row.ranking.ceiling)), [rows]);
  const updated = formatUpdated(data?.updatedAt);

  function toggleSort(key: SortKey) {
    setSort((current) => current.key === key
      ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
      : { key, dir: ascendingFirst.has(key) ? "asc" : "desc" });
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-4 py-10 sm:px-8">
      <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="metric-label">
            Week {data?.week || "—"} · Active slate · Byes excluded{updated && ` · Updated ${updated}`}
          </p>
          <h1 className="mt-1 font-heading text-[36px] font-extrabold uppercase leading-none sm:text-[40px] lg:text-[44px]">Week {data?.week || "—"} Rankings</h1>
          <p className="mt-2 text-sm text-muted-foreground">Next-week projections weighted by the signals that have actually predicted production this season.</p>
        </div>
        <ScoringControl value={scoring} onChange={setScoring} />
      </div>
      {error && <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <div className="panel overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b bg-[#eef2e9] p-4 sm:flex-row sm:items-center">
          <div className="max-w-full overflow-x-auto pb-1">
            <Tabs value={position} onValueChange={(v) => setPosition(v as typeof position)}>
              <TabsList className="w-max min-w-max">{["ALL", "QB", "RB", "WR", "TE", "FLEX", "K", "DEF"].map((p) => <TabsTrigger className="min-w-12 flex-none data-active:ring-1 data-active:ring-[#1d6a49]/20" value={p} key={p}>{p === "ALL" ? "Overall" : p}</TabsTrigger>)}</TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="size-3.5" /> Live Sleeper season data
          </div>
        </div>
        {loading ? <div className="space-y-3 p-5">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div> :
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-[#102c21] hover:bg-[#102c21]">
              {columns.map((column) => {
                const active = sort.key === column.key;
                const SortIcon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <TableHead key={column.key} className={column.className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button type="button" onClick={() => toggleSort(column.key)}
                      className={cn("inline-flex items-center gap-1 text-[10px] font-bold tracking-widest transition hover:text-white", active ? "text-[#d7ff52]" : "text-white/60")}>
                      {column.label}<SortIcon className={cn("size-3", !active && "opacity-50")} />
                    </button>
                  </TableHead>
                );
              })}
            </TableRow></TableHeader>
            <TableBody>
              {sorted.map(({ ranking: r, rank }) => {
                const tag = injuryTag(r.player.injuryStatus);
                const accent = positionAccent[r.player.position];
                return (
                  <TableRow key={r.player.id} className="group h-16">
                    <TableCell className="font-heading text-xl font-bold tabular-nums text-muted-foreground">{String(rank).padStart(2, "0")}</TableCell>
                    <TableCell>
                      <Link href={`/player/${r.player.id}`} className="flex items-center gap-3">
                        <TeamMark team={r.player.team} />
                        <span>
                          <span className="flex items-center gap-1.5">
                            <b className="group-hover:text-[#1d6a49]">{r.player.name}</b>
                            {tag && <span title={r.player.injuryStatus || undefined} className="text-[11px] font-bold text-red-600/80">{tag}</span>}
                          </span>
                          <small className="text-muted-foreground">
                            <span className="font-semibold" style={{ color: accent }}>
                              {`${r.player.position}${r.positionRank}`}
                            </span>
                            {" · "}{r.kickoff}
                          </small>
                        </span>
                        <ArrowUpRight className="size-3 opacity-0 group-hover:opacity-100" />
                      </Link>
                    </TableCell>
                    <TableCell className="font-heading text-2xl font-extrabold">{r.projection}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative h-1.5 w-28 shrink-0 rounded-full bg-[#e3e8de]">
                          <div className="absolute inset-y-0 rounded-full bg-[#9db8a6]" style={{ left: `${(r.floor / scaleMax) * 100}%`, width: `${((r.ceiling - r.floor) / scaleMax) * 100}%` }} />
                          <span className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#102c21]" style={{ left: `${(r.projection / scaleMax) * 100}%` }} />
                        </div>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">{r.floor}–{r.ceiling}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{r.seasonPpg}</TableCell>
                    <TableCell>
                      <FormArrow trend={r.trend} />
                    </TableCell>
                    <TableCell><span className="font-heading text-lg font-bold">{r.matchupGrade}</span><small className="ml-2 text-muted-foreground">vs {r.opponent}</small></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>}
      </div>
    </main>
  );
}
