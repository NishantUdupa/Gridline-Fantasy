"use client";

import { useEffect, useState } from "react";
import { GitCompareArrows, Plus, Trash2, Trophy } from "lucide-react";
import type { RosRanking, Scoring } from "@/lib/types";
import { useRestOfSeasonRankings } from "@/hooks/use-rankings";
import { PlayerPicker } from "@/components/player-picker";
import { ScoringControl } from "@/components/scoring-control";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HealthBadge } from "@/components/health-badge";
import { MatchupCalendar } from "@/components/matchup-calendar";

type Result = { verdict: string; spread: number; sides: { name: string; value: number; projectedPoints: number; players: { ranking: RosRanking; value: number }[] }[] };

export default function TradePage() {
  const [scoring, setScoring] = useState<Scoring>("ppr");
  const [sides, setSides] = useState([{ name: "Team A", playerIds: [] as string[] }, { name: "Team B", playerIds: [] as string[] }]);
  const [result, setResult] = useState<Result | null>(null);
  const [requestError, setRequestError] = useState("");
  const { data } = useRestOfSeasonRankings(scoring);
  useEffect(() => {
    if (sides.some((s) => !s.playerIds.length)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setRequestError("");
      fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoring, sides }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const json = await response.json();
          if (!response.ok) throw new Error(json.error || "Unable to evaluate this trade.");
          return json as Result;
        })
        .then(setResult)
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setRequestError(error instanceof Error ? error.message : "Unable to evaluate this trade.");
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [sides, scoring]);
  const allSelected = sides.flatMap((s) => s.playerIds);
  const add = (sideIndex: number, id: string) => {
    setResult(null);
    setSides(sides.map((s, i) => i === sideIndex ? { ...s, playerIds: [...s.playerIds, id] } : s));
  };
  const remove = (sideIndex: number, id: string) => {
    setResult(null);
    setSides(sides.map((s, i) => i === sideIndex ? { ...s, playerIds: s.playerIds.filter((p) => p !== id) } : s));
  };
  const changeScoring = (next: Scoring) => {
    setResult(null);
    setScoring(next);
  };
  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-5 py-10 sm:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="metric-label">Multi-team value engine</p><h1 className="font-heading text-5xl font-extrabold uppercase">Trade Lab</h1><p className="mt-2 text-sm text-muted-foreground">Rest-of-season production, pre-injury form, recovery risk, positional scarcity and remaining matchups—priced into one deal.</p></div><ScoringControl value={scoring} onChange={changeScoring} /></div>
      {requestError && <p className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{requestError}</p>}
      <div className={`grid gap-4 ${sides.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        {sides.map((side, sideIndex) => <section key={side.name} className="panel overflow-visible">
          <div className="flex items-center justify-between bg-[#102c21] p-4 text-white"><h2 className="font-heading text-2xl font-bold uppercase">{side.name}</h2>{result && <div className="text-right"><p className="metric-label !text-white/40">Side value</p><b className="font-heading text-2xl text-[#d7ff52]">{result.sides[sideIndex]?.value}</b></div>}</div>
          <div className="p-4">{data && <PlayerPicker rankings={data.rankings} selected={allSelected} onAdd={(id) => add(sideIndex, id)} placeholder={`Add player to ${side.name}`} />}</div>
          <div className="min-h-44">{side.playerIds.map((id) => {
            const r = data?.rankings.find((entry) => entry.player.id === id);
            if (!r) return null;
            const valued = result?.sides[sideIndex]?.players.find((p) => p.ranking.player.id === id);
            return <div key={id} className="mx-4 mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 bg-white px-4 py-4">
                <div className="min-w-32 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><b className="leading-tight">{r.player.name}</b><HealthBadge status={r.player.injuryStatus} /></div>
                  <small className="mt-1 block leading-snug text-muted-foreground">{r.player.position}{r.rosPositionRank} · {r.scheduleGrade} schedule<br /><b className="text-foreground">{r.rosProjection} ROS pts</b></small>
                  <div className="mt-2 flex items-center gap-1">
                    {valued && <Badge variant="secondary" className="bg-white/70">{valued.value} value</Badge>}
                    <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:bg-white/60" aria-label={`Remove ${r.player.name}`} onClick={() => remove(sideIndex, id)}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
                {r.matchups && <MatchupCalendar matchups={r.matchups} currentWeek={data?.week || 0} size="md" />}
                {r.player.injuryStatus && <div className="basis-full border-l-2 border-amber-400 pl-2"><small className="block text-amber-800">{r.healthAssessment.risk} recovery risk · {r.healthAssessment.expectedGamesMissed} games missed · {Math.round(r.healthAssessment.returnFactor * 100)}% return factor</small><small className="block text-amber-700">Pre-injury form: {r.last3Ppg} L3 PPG / {r.seasonPpg} season PPG. {r.healthAssessment.rationale}</small></div>}
            </div>;
          })}</div>
        </section>)}
      </div>
      <div className="mt-4 flex justify-between">{sides.length === 2 ? <Button variant="outline" onClick={() => setSides([...sides, { name: "Team C", playerIds: [] }])}><Plus /> Add third team</Button> : <Button variant="outline" onClick={() => setSides(sides.slice(0, 2))}><Trash2 /> Remove Team C</Button>}<span className="text-xs text-muted-foreground">No player may appear on multiple sides.</span></div>
      {result && sides.every((s) => s.playerIds.length) ? <section className="mt-6 border border-[#1d6a49] bg-[#eff9e8] p-6"><div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center bg-[#d7ff52]"><Trophy className="size-6" /></span><div><p className="metric-label">Gridline verdict · {result.spread}% spread</p><h2 className="font-heading text-4xl font-extrabold uppercase">{result.verdict}</h2><p className="mt-2 text-sm text-muted-foreground">{result.sides.map((s) => `${s.name}: ${s.value} value / ${s.projectedPoints} projected ROS pts`).join(" · ")}</p></div></div></section> :
      <section className="mt-6 grid min-h-36 place-items-center border border-dashed bg-white p-6 text-center"><div><GitCompareArrows className="mx-auto mb-3 text-muted-foreground" /><b>Add at least one player to every side</b><p className="text-sm text-muted-foreground">The fairness verdict updates automatically.</p></div></section>}
    </main>
  );
}
