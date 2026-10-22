"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trash2, Users, WandSparkles } from "lucide-react";
import type { Scoring } from "@/lib/types";
import { useRankings } from "@/hooks/use-rankings";
import { PlayerPicker } from "@/components/player-picker";
import { ScoringControl } from "@/components/scoring-control";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HealthBadge } from "@/components/health-badge";

const KEY = "gridline-roster";

export default function RosterPage() {
  const [scoring, setScoring] = useState<Scoring>("ppr");
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const { data, loading } = useRankings(scoring, true);
  useEffect(() => {
    // Hydrate browser-only roster after mount; the server has no localStorage.
    let stored: string[] = [];
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (Array.isArray(parsed)) {
        stored = [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length <= 64))].slice(0, 15);
      }
    } catch {
      localStorage.removeItem(KEY);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIds(stored);
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(ids)); }, [ids, ready]);
  const roster = useMemo(() => (data?.rankings || []).filter((r) => ids.includes(r.player.id)).sort((a, b) => b.projection - a.projection), [data, ids]);
  const activeSlate = roster.filter((r) => !r.isBye);
  const starters = new Set<string>();
  for (const pos of ["QB", "RB", "WR", "TE", "K", "DEF"] as const) {
    const count = pos === "RB" || pos === "WR" ? 2 : 1;
    activeSlate.filter((r) => r.player.position === pos).slice(0, count).forEach((r) => starters.add(r.player.id));
  }
  const flex = activeSlate.filter((r) => ["RB", "WR", "TE"].includes(r.player.position) && !starters.has(r.player.id))[0];
  if (flex) starters.add(flex.player.id);
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="metric-label">Personal war room</p><h1 className="font-heading text-5xl font-extrabold uppercase">My Roster</h1><p className="mt-2 text-sm text-muted-foreground">{ids.length}/15 players saved locally on this device.</p></div><ScoringControl value={scoring} onChange={setScoring} /></div>
      <div className="grid gap-5 lg:grid-cols-[.7fr_1.3fr]">
        <aside className="panel h-fit p-5"><p className="metric-label">Add player</p><h2 className="mb-4 font-heading text-2xl font-bold uppercase">Roster search</h2>{data && <PlayerPicker rankings={data.rankings} selected={ids} onAdd={(id) => ids.length < 15 && setIds([...ids, id])} />}<div className="mt-6 border-t pt-5"><Button variant="outline" size="sm" disabled={!ids.length} onClick={() => setIds([])}><Trash2 /> Clear roster</Button></div><div className="mt-5 bg-[#102c21] p-4 text-sm text-white"><WandSparkles className="mb-3 size-5 text-[#d7ff52]" /><b className="block">Smart lineup</b><p className="mt-1 leading-5 text-white/55">Starts 1 QB, 2 RB, 2 WR, 1 TE and the highest projected FLEX.</p></div></aside>
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b bg-[#eef2e9] p-4"><div><p className="metric-label">Week {data?.week || "—"}</p><h2 className="font-heading text-2xl font-bold uppercase">Optimized lineup</h2></div>{ids.length >= 2 && <Link className={buttonVariants({ size: "sm" })} href={`/start-sit?players=${ids.slice(0,4).join(",")}`}>Compare players</Link>}</div>
          {loading ? <p className="p-8 text-sm text-muted-foreground">Loading your model board…</p> : !roster.length ? <div className="grid min-h-80 place-items-center p-8 text-center"><div><Users className="mx-auto mb-4 size-10 text-muted-foreground"/><h3 className="font-heading text-2xl font-bold uppercase">Your board is empty</h3><p className="mt-2 text-sm text-muted-foreground">Search and add up to 15 players to create your weekly lineup.</p></div></div> :
          <div>{roster.map((r) => <div key={r.player.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b p-4 last:border-0">
            <Badge className={starters.has(r.player.id) ? "bg-[#d7ff52] text-[#102c21]" : r.isBye ? "bg-slate-800 text-white" : ""} variant={starters.has(r.player.id) || r.isBye ? "default" : "secondary"}>{r.isBye ? "BYE" : starters.has(r.player.id) ? "START" : "BENCH"}</Badge>
            <div><div className="flex flex-wrap items-center gap-2"><Link href={`/player/${r.player.id}`} className="font-bold hover:underline">{r.player.name}</Link><HealthBadge status={r.player.injuryStatus} /></div><small className="block text-muted-foreground">{r.player.team} · {r.player.position}{r.positionRank} · vs {r.opponent}</small></div>
            <div className="text-right"><p className="metric-label">Projection</p><b className="font-heading text-2xl">{r.projection}</b></div>
            <Button size="icon" variant="ghost" onClick={() => setIds(ids.filter((id) => id !== r.player.id))}><Trash2 className="size-4" /></Button>
          </div>)}</div>}
        </section>
      </div>
    </main>
  );
}
