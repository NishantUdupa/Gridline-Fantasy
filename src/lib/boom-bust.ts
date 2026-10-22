import type { Ranking } from "@/lib/types";

export interface BoomBustPick {
  ranking: Ranking;
  recent: number;
  score: number;
  reasons: string[];
}

const matchupBoost = (grade: string) => grade === "A" ? .7 : grade === "B" ? .35 : grade === "D" ? -.55 : 0;
const trendBoost = (trend: Ranking["trend"]) => trend === "Rising" ? .35 : trend === "Fading" ? -.4 : 0;

function recentAverage(ranking: Ranking) {
  return ranking.last3Ppg || ranking.seasonPpg;
}

function reasonsFor(ranking: Ranking, kind: "boom" | "bust", recent: number) {
  const gap = ranking.projection - recent;
  const reasons = [
    kind === "boom"
      ? `Ceiling of ${ranking.ceiling} is ${(ranking.ceiling - recent).toFixed(1)} points above a ${recent.toFixed(1)} recent average.`
      : `Floor of ${ranking.floor} sits ${(recent - ranking.floor).toFixed(1)} points under a ${recent.toFixed(1)} recent average.`,
  ];
  if (Math.abs(gap) >= 1.5) reasons.push(kind === "boom"
    ? `This week's ${ranking.projection} projection clears recent form by ${gap.toFixed(1)}.`
    : `This week's ${ranking.projection} projection is ${Math.abs(gap).toFixed(1)} points below recent form.`);
  reasons.push(ranking.matchupGrade === "A" || ranking.matchupGrade === "B"
    ? `${ranking.matchupGrade} matchup versus ${ranking.opponent} raises the weekly range.`
    : ranking.matchupGrade === "D"
      ? `Tough ${ranking.matchupGrade} matchup versus ${ranking.opponent} compresses the expected score.`
      : `Neutral matchup versus ${ranking.opponent}; the call is driven by role and recent form.`);
  if (ranking.trend === "Rising" || ranking.trend === "Fading") reasons.push(`${ranking.trend} usage and scoring trend across the season.`);
  if (ranking.player.injuryStatus) reasons.push(`${ranking.player.injuryStatus} availability is already priced into the range.`);
  return reasons.slice(0, 3);
}

export function boomBustBoard(rankings: Ranking[]) {
  const scored = rankings.filter((ranking) => {
    const recent = recentAverage(ranking);
    return ["QB", "RB", "WR", "TE"].includes(ranking.player.position) && !ranking.isBye && ranking.history.filter((week) => week.points > 0).length >= 2 && !["out", "ir"].includes(ranking.player.injuryStatus?.toLowerCase() || "") && (ranking.projection >= 10 || recent >= 10);
  })
    .map((ranking) => {
      const recent = recentAverage(ranking);
      const volatility = Math.max(2.5, (ranking.ceiling - ranking.floor) / 2);
      const context = matchupBoost(ranking.matchupGrade) + trendBoost(ranking.trend);
      const injury = ranking.player.injuryStatus ? .45 : 0;
      return {
        ranking, recent, volatility, context, injury,
        boom: (ranking.ceiling - recent) / volatility + Math.max(0, ranking.projection - recent) / volatility * .4 + context,
        bust: (recent - ranking.floor) / volatility + Math.max(0, recent - ranking.projection) / volatility * .55 - context + injury,
      };
    });
  const boomIds = new Set(scored.filter((row) => row.boom > row.bust).sort((a, b) => b.boom - a.boom).slice(0, 15).map((row) => row.ranking.player.id));
  const booms: BoomBustPick[] = scored.filter((row) => boomIds.has(row.ranking.player.id)).sort((a, b) => b.boom - a.boom)
    .map((row) => ({ ranking: row.ranking, recent: Number(row.recent.toFixed(1)), score: Number(row.boom.toFixed(2)), reasons: reasonsFor(row.ranking, "boom", row.recent) }));
  const busts: BoomBustPick[] = scored.filter((row) => !boomIds.has(row.ranking.player.id)).sort((a, b) => b.bust - a.bust).slice(0, 15)
    .map((row) => ({ ranking: row.ranking, recent: Number(row.recent.toFixed(1)), score: Number(row.bust.toFixed(2)), reasons: reasonsFor(row.ranking, "bust", row.recent) }));
  return { booms, busts };
}
