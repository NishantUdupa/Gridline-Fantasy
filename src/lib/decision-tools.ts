import type { Ranking, RosRanking } from "@/lib/types";

export function playerTradeValue(r: RosRanking) {
  const eliteCurve = 52 / Math.pow(Math.max(1, r.rosRank), .34);
  const positionalScarcity = Math.max(0, 10 - r.rosPositionRank * .34);
  const preInjuryProduction = r.seasonPpg * .45 + r.last3Ppg * .55;
  const production = preInjuryProduction * .55 + r.rosPpg * .9;
  const remainingVolume = r.rosProjection / Math.max(1, r.gamesRemaining) * .35;
  const stability = Math.max(0, 5 - (r.ceiling - r.floor) * .16);
  const recoveryAdjustment = .72 + r.healthAssessment.returnFactor * .28;
  return Math.round(Math.max(0, (eliteCurve + positionalScarcity + production + remainingVolume + stability) * recoveryAdjustment));
}

export function evaluateTrade(sides: { name: string; playerIds: string[] }[], rankings: RosRanking[]) {
  const lookup = new Map(rankings.map((r) => [r.player.id, r]));
  const results = sides.map((side) => {
    const players = side.playerIds.map((id) => lookup.get(id)).filter(Boolean) as RosRanking[];
    return {
      name: side.name,
      players: players.map((ranking) => ({ ranking, value: playerTradeValue(ranking) })),
      value: players.reduce((sum, ranking) => sum + playerTradeValue(ranking), 0),
      projectedPoints: Number(players.reduce((sum, ranking) => sum + ranking.rosProjection, 0).toFixed(1)),
    };
  });
  const values = results.map((r) => r.value);
  const high = Math.max(...values), low = Math.min(...values);
  const spread = high ? (high - low) / high : 0;
  const winner = results[values.indexOf(high)]?.name;
  const verdict = spread <= .07 ? "Fair deal" : spread <= .16 ? `Slight lean: ${winner}` : `Strong lean: ${winner}`;
  return { sides: results, verdict, spread: Number((spread * 100).toFixed(1)) };
}

export function compareStartSit(playerIds: string[], rankings: Ranking[]) {
  const lookup = new Map(rankings.map((r) => [r.player.id, r]));
  const players = playerIds.map((id) => lookup.get(id)).filter(Boolean).sort((a, b) => b!.projection - a!.projection) as Ranking[];
  const gap = players.length > 1 ? players[0].projection - players[1].projection : 0;
  const confidence = gap >= 3 ? "Strong lean" : gap >= 1.5 ? "Lean" : "Toss-up";
  const reason = players.length > 1
    ? `${players[0].player.name} leads by ${gap.toFixed(1)} projected points with a ${players[0].matchupGrade} matchup grade.`
    : "Add at least two players to compare.";
  return { players, starterId: players[0]?.player.id, confidence, gap: Number(gap.toFixed(1)), reason };
}
