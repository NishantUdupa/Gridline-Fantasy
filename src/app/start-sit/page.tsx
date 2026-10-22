"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Scale, Trash2, X } from "lucide-react";
import type { Ranking, Scoring } from "@/lib/types";
import { useRankings } from "@/hooks/use-rankings";
import { PlayerPicker } from "@/components/player-picker";
import { ScoringControl } from "@/components/scoring-control";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HealthBadge } from "@/components/health-badge";

type Result = { players: Ranking[]; starterId: string; confidence: string; gap: number; reason: string };

function StartSitTool() {
  const params = useSearchParams();
  const [scoring, setScoring] = useState<Scoring>("ppr");
  const [ids, setIds] = useState<string[]>(() => (params.get("players") || "").split(",").filter(Boolean).slice(0, 4));
  const [result, setResult] = useState<Result | null>(null);
  const [requestError, setRequestError] = useState("");
  const { data } = useRankings(scoring);
  useEffect(() => {
    if (ids.length < 2) return;
    const controller = new AbortController();
    fetch("/api/start-sit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoring, playerIds: ids }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Unable to compare these players.");
        return json as Result;
      })
      .then(setResult)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRequestError(error instanceof Error ? error.message : "Unable to compare these players.");
      });
    return () => controller.abort();
  }, [ids, scoring]);
  const updateIds = (next: string[]) => {
    setResult(null);
    setRequestError("");
    setIds(next);
  };
  const changeScoring = (next: Scoring) => {
    setResult(null);
    setScoring(next);
  };
  return (
    <main className="mx-auto min-h-screen max-w-[1280px] px-5 py-10 sm:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="metric-label">Weekly decision engine</p><h1 className="font-heading text-5xl font-extrabold uppercase">Start / Sit</h1><p className="mt-2 text-sm text-muted-foreground">Put two to four players on the same Week {data?.week || "—"} model board.</p></div><ScoringControl value={scoring} onChange={changeScoring} /></div>
      {requestError && <p className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{requestError}</p>}
      <section className="panel p-5"><div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center"><div>{data && <PlayerPicker rankings={data.rankings} selected={ids} onAdd={(id) => ids.length < 4 && updateIds([...ids, id])} placeholder={ids.length >= 4 ? "Four-player limit reached" : "Search a player to compare..."} />}</div><Badge variant="secondary" className="justify-center">{ids.length}/4 selected</Badge></div></section>
      {ids.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{ids.map((id) => {
        const r = data?.rankings.find((entry) => entry.player.id === id);
        if (!r) return null;
        const isStart = result?.starterId === id;
        return <section key={id} className={`relative overflow-hidden border bg-white ${isStart ? "border-[#1d6a49] ring-2 ring-[#d7ff52]" : ""}`}>
          <div className={`p-4 ${isStart ? "bg-[#102c21] text-white" : "bg-[#e9eee5]"}`}><div className="flex justify-between"><div className="flex flex-wrap gap-2"><Badge className={isStart ? "bg-[#d7ff52] text-[#102c21]" : ""} variant={isStart ? "default" : "secondary"}>{isStart ? <><Check /> START</> : <><X /> SIT</>}</Badge><HealthBadge status={r.player.injuryStatus} /></div><Button size="icon" variant="ghost" className={isStart ? "text-white hover:text-white" : ""} onClick={() => updateIds(ids.filter((x) => x !== id))}><Trash2 className="size-4" /></Button></div><h2 className="mt-6 font-heading text-3xl font-extrabold uppercase leading-none">{r.player.name}</h2><p className={`mt-2 text-xs ${isStart ? "text-white/50" : "text-muted-foreground"}`}>{r.player.team} · {r.player.position}{r.positionRank} · vs {r.opponent}</p></div>
          <div className="grid grid-cols-2 gap-px bg-border"><Metric label="Projection" value={r.projection} /><Metric label="Floor—Ceil" value={`${r.floor}—${r.ceiling}`} /><Metric label="Matchup" value={r.matchupGrade} /><Metric label="Form" value={r.trend} /></div>
        </section>;
      })}</div> : null}
      {result && ids.length >= 2 ? <section className="mt-6 bg-[#d7ff52] p-6"><div className="flex gap-4"><Scale className="mt-1 size-7 shrink-0" /><div><p className="metric-label !text-[#102c21]/60">{result.confidence} · {result.gap} point edge</p><h2 className="font-heading text-3xl font-extrabold uppercase">{result.reason}</h2><p className="mt-2 text-sm text-[#102c21]/70">Recommendation uses the same ranking row, injury modifier and matchup model as the full weekly board.</p></div></div></section> :
      <section className="mt-6 grid min-h-48 place-items-center border border-dashed bg-white p-8 text-center"><div><Scale className="mx-auto mb-3 size-8 text-muted-foreground" /><h2 className="font-heading text-2xl font-bold uppercase">Choose at least two players</h2><p className="text-sm text-muted-foreground">Gridline will rank the group and explain the gap.</p></div></section>}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="bg-white p-4"><p className="metric-label">{label}</p><b className="font-heading text-2xl">{value}</b></div>;
}

export default function StartSitPage() {
  return <Suspense><StartSitTool /></Suspense>;
}
