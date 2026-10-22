import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowLeft, CalendarRange, ChartLine, CheckCircle2, Gauge, SlidersHorizontal, Telescope, TriangleAlert } from "lucide-react";
import { MatchupCalendar } from "@/components/matchup-calendar";
import { calculateRankings, calculateRestOfSeasonRankings } from "@/lib/engine";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { HealthBadge } from "@/components/health-badge";

export const maxDuration = 60;

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="grid h-40 place-items-center text-sm text-muted-foreground">More games needed for trend chart.</div>;
  const max = Math.max(...points, 1), width = 560, height = 150;
  const polyline = points.map((p, i) => `${(i / (points.length - 1)) * width},${height - (p / max) * (height - 18)}`).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full overflow-visible"><path d={`M0 ${height} L${polyline} L${width} ${height} Z`} fill="rgba(29,106,73,.09)" /><polyline points={polyline} fill="none" stroke="#1d6a49" strokeWidth="4" strokeLinejoin="round" />{points.map((p, i) => <circle key={i} cx={(i / (points.length - 1)) * width} cy={height - (p / max) * (height - 18)} r="4" fill="#d7ff52" stroke="#102c21" strokeWidth="2" />)}</svg>;
}

function UsageChart({ history }: { history: { week: number; points: number; opportunity: number; snaps: number }[] }) {
  if (history.length < 2) return <div className="grid h-48 place-items-center text-sm text-muted-foreground">More games needed for usage trends.</div>;
  const width = 620, height = 180;
  const path = (values: number[]) => {
    const max = Math.max(...values, 1);
    return values.map((value, index) => `${(index / (values.length - 1)) * width},${height - (value / max) * (height - 24)}`).join(" ");
  };
  return <div><div className="mb-4 flex gap-5 text-[10px] font-bold uppercase tracking-wider"><span className="flex items-center gap-2"><i className="size-2 bg-[#1d6a49]" /> Opportunity</span><span className="flex items-center gap-2"><i className="size-2 bg-[#c7ef3f]" /> Snaps</span></div><svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full"><polyline points={path(history.map((h) => h.opportunity))} fill="none" stroke="#1d6a49" strokeWidth="4" /><polyline points={path(history.map((h) => h.snaps))} fill="none" stroke="#b6dd2e" strokeWidth="4" strokeDasharray="8 5" />{history.map((h, index) => <text key={h.week} x={(index / (history.length - 1)) * width} y={height} textAnchor="middle" fontSize="11" fill="#647067">W{h.week}</text>)}</svg></div>;
}

function ProjectionRange({ floor, projection, ceiling }: { floor: number; projection: number; ceiling: number }) {
  const max = Math.max(ceiling, 1);
  return <div className="py-4"><div className="relative h-3 rounded-full bg-[#dfe5da]"><div className="absolute h-3 rounded-full bg-[#86a894]" style={{ left: `${floor / max * 100}%`, right: 0 }} /><span className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-[#102c21] bg-[#d7ff52]" style={{ left: `${projection / max * 100}%` }} /></div><div className="mt-3 flex justify-between text-xs"><span>Floor <b>{floor}</b></span><span>Projection <b>{projection}</b></span><span>Ceiling <b>{ceiling}</b></span></div></div>;
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, rosData] = await Promise.all([calculateRankings("ppr", undefined, true), calculateRestOfSeasonRankings("ppr")]);
  const r = data.rankings.find((entry) => entry.player.id === id);
  if (!r) notFound();
  const ros = rosData.rankings.find((entry) => entry.player.id === id);
  const pointValues = r.history.map((h) => h.points);
  const average = pointValues.length ? pointValues.reduce((sum, value) => sum + value, 0) / pointValues.length : 0;
  const deviation = pointValues.length ? Math.sqrt(pointValues.reduce((sum, value) => sum + (value - average) ** 2, 0) / pointValues.length) : 0;
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8">
      <Link href="/rankings" className="mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to rankings</Link>
      <section className="overflow-hidden bg-[#102c21] text-white">
        <div className="grid gap-8 p-7 sm:p-10 md:grid-cols-[1fr_auto]">
          <div><div className="mb-4 flex flex-wrap gap-2"><Badge className="bg-[#d7ff52] text-[#102c21]">{r.player.position}{r.positionRank} · OVERALL {r.overallRank}</Badge><HealthBadge status={r.player.injuryStatus} /></div><h1 className="font-heading text-6xl font-extrabold uppercase leading-none">{r.player.name}</h1><p className="mt-3 text-white/55">{r.player.team} · vs {r.opponent} · {r.kickoff}</p>{r.player.injuryNotes && <p className="mt-2 max-w-xl text-sm text-amber-200">{r.player.injuryNotes}</p>}</div>
          <div className="flex items-end gap-8">
            <div><p className="metric-label !text-white/45">Floor</p><strong className="font-heading text-3xl">{r.floor}</strong></div>
            <div><p className="metric-label !text-[#d7ff52]">Gridline projection</p><strong className="font-heading text-7xl text-[#d7ff52]">{r.projection}</strong></div>
            <div><p className="metric-label !text-white/45">Ceiling</p><strong className="font-heading text-3xl">{r.ceiling}</strong></div>
          </div>
        </div>
      </section>
      <section className="mt-5 grid gap-px border bg-border sm:grid-cols-2 lg:grid-cols-5">
        {r.metrics.map((metric) => <div key={metric.key} className="bg-white p-4"><p className="metric-label">{metric.label}</p><b className="font-heading text-3xl">{metric.value}{metric.unit}</b></div>)}
      </section>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <section className="panel p-6"><div className="flex justify-between"><div><p className="metric-label">Season trajectory</p><h2 className="font-heading text-3xl font-bold uppercase">Weekly production</h2></div><div className="flex items-start gap-3"><Badge variant="secondary">{r.trend}</Badge><ChartLine className="text-[#1d6a49]" /></div></div><div className="mt-8"><Sparkline points={r.history.map((h) => h.points)} /></div><div className="flex justify-between border-t pt-4 text-center">{r.history.map((h) => <div key={h.week}><p className="metric-label">W{h.week}</p><b className="font-mono text-sm">{h.points}</b>{h.positionRank && <small className="block text-muted-foreground">{r.player.position}{h.positionRank}</small>}</div>)}</div></section>
        <section className="panel p-6"><div className="flex items-start justify-between"><div><p className="metric-label">Why this number</p><h2 className="font-heading text-3xl font-bold uppercase">Model factors</h2></div><SlidersHorizontal className="text-[#1d6a49]" /></div><div className="mt-6 space-y-6">{r.factors.map((factor) => <div key={factor.key}><div className="mb-2 flex justify-between text-xs"><b>{factor.label}</b><span className="font-mono">{factor.weight}% weight</span></div><Progress value={Math.min(100, factor.weight * 2.4)} /><p className="mt-1 text-[11px] text-muted-foreground">Value {factor.value} · +{factor.impact} model pts</p></div>)}</div></section>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <section className="panel p-6"><div className="flex items-start justify-between"><div><p className="metric-label">Role stability</p><h2 className="font-heading text-3xl font-bold uppercase">Opportunity & snap trend</h2></div><Activity className="text-[#1d6a49]" /></div><p className="mt-1 text-sm text-muted-foreground">Normalized independently to expose direction and role changes across the season.</p><div className="mt-5"><UsageChart history={r.history} /></div></section>
        <section className="panel p-6"><div className="flex items-start justify-between"><div><p className="metric-label">Projection distribution</p><h2 className="font-heading text-3xl font-bold uppercase">Week {r.week} range</h2></div><Gauge className="text-[#1d6a49]" /></div><ProjectionRange floor={r.floor} projection={r.projection} ceiling={r.ceiling} /><div className="mt-5 grid grid-cols-2 gap-px bg-border"><div className="bg-[#f7f9f4] p-4"><p className="metric-label">Volatility</p><b className="font-heading text-2xl">{deviation.toFixed(1)} pts</b></div><div className="bg-[#f7f9f4] p-4"><p className="metric-label">Consistency CV</p><b className="font-heading text-2xl">{average ? Math.round(deviation / average * 100) : 0}%</b></div></div></section>
      </div>
      {ros && <section className="panel mt-5 p-6">
        <div className="flex items-start justify-between"><div><p className="metric-label">Rest of season</p><h2 className="font-heading text-3xl font-bold uppercase">Projection & matchups</h2></div><CalendarRange className="text-[#1d6a49]" /></div>
        <div className="mt-5 grid gap-px border bg-border sm:grid-cols-3 lg:grid-cols-5">
          <div className="bg-[#102c21] p-4 text-white"><p className="metric-label !text-[#d7ff52]">ROS projection</p><b className="font-heading text-4xl text-[#d7ff52]">{ros.rosProjection}</b><small className="ml-1.5 text-white/55">pts</small></div>
          <div className="bg-[#f7f9f4] p-4"><p className="metric-label">ROS rank</p><b className="font-heading text-3xl">#{ros.rosRank}</b><small className="ml-1.5 text-muted-foreground">{ros.player.position}{ros.rosPositionRank}</small></div>
          <div className="bg-[#f7f9f4] p-4"><p className="metric-label">Points per game</p><b className="font-heading text-3xl">{ros.rosPpg}</b></div>
          <div className="bg-[#f7f9f4] p-4"><p className="metric-label">Active games</p><b className="font-heading text-3xl">{ros.expectedGamesActive}</b><small className="ml-1.5 text-muted-foreground">of {ros.gamesRemaining}</small></div>
          <div className="bg-[#f7f9f4] p-4"><p className="metric-label">Schedule grade</p><b className="font-heading text-3xl">{ros.scheduleGrade}</b><small className="ml-1.5 text-muted-foreground">{ros.healthAssessment.risk} recovery risk</small></div>
        </div>
        <div className="mt-6"><MatchupCalendar matchups={ros.matchups} currentWeek={rosData.week} size="lg" /></div>
        <p className="mt-3 text-xs text-muted-foreground">Letter is the matchup grade against that defense for {ros.player.position}s, A easiest to D hardest. Faded weeks are already played; the outlined week is next.</p>
      </section>}
      {ros && r.player.injuryStatus && <section className="panel mt-5 border-amber-200 bg-amber-50 p-6"><p className="metric-label text-amber-800">Recovery model</p><h2 className="font-heading text-3xl font-bold uppercase">{ros.healthAssessment.label} · {ros.healthAssessment.risk} risk</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900">{ros.healthAssessment.rationale} Model assumption: {ros.healthAssessment.expectedGamesMissed} expected games missed and a {Math.round(ros.healthAssessment.returnFactor * 100)}% post-return production factor.</p></section>}
      <section className="panel mt-5 p-6"><div className="mb-5 flex items-start justify-between"><div><p className="metric-label">Gridline outlook</p><h2 className="font-heading text-3xl font-bold uppercase">Week {r.week} intelligence</h2></div><Telescope className="text-[#1d6a49]" /></div><div className="grid gap-3 md:grid-cols-3">{r.outlook.map((line, i) => <div key={line} className="flex gap-3 border bg-[#f7f9f4] p-4 text-sm leading-6">{i === 2 && r.player.injuryStatus ? <TriangleAlert className="mt-1 size-4 shrink-0 text-amber-600" /> : <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-700" />}{line}</div>)}</div></section>
    </main>
  );
}
