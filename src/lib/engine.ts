import { getPriorSeasonTraining, getSeasonBundle, type TrainingSeason, type TrainingWeekStat } from "@/lib/sleeper";
import { assessInjury } from "@/lib/injury-model";
import { USAGE_CANDIDATES, fitUsageAdjustments, usageProfile, weeklyUsage, type UsageFit, type UsageSample } from "@/lib/usage-metrics";
import type { Factor, PlayerMetric, Position, PositionModelDiagnostic, Ranking, RankingsResponse, RosMatchup, RosRanking, RosRankingsResponse, Scoring, SeasonBundle, WeekStat } from "@/lib/types";

const FEATURES = ["season", "ewma", "last3", "opportunity", "efficiency", "trend"] as const;
type FeatureKey = (typeof FEATURES)[number];

const DEFAULT_WEIGHTS: Record<Position, Record<FeatureKey, number>> = {
  QB: { season: .16, ewma: .24, last3: .16, opportunity: .24, efficiency: .12, trend: .08 },
  RB: { season: .14, ewma: .22, last3: .14, opportunity: .32, efficiency: .10, trend: .08 },
  WR: { season: .14, ewma: .22, last3: .14, opportunity: .32, efficiency: .10, trend: .08 },
  TE: { season: .14, ewma: .22, last3: .14, opportunity: .32, efficiency: .10, trend: .08 },
  K: { season: .18, ewma: .25, last3: .18, opportunity: .23, efficiency: .08, trend: .08 },
  DEF: { season: .20, ewma: .28, last3: .20, opportunity: .16, efficiency: .08, trend: .08 },
};
const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "K", "DEF"];
const FEATURE_LABELS: Record<FeatureKey, string> = {
  season: "Season PPG", ewma: "Recency EWMA", last3: "Last-3 form",
  opportunity: "Opportunity volume", efficiency: "Efficiency", trend: "Trajectory",
};

const round = (n: number, digits = 1) => Number(n.toFixed(digits));
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const std = (values: number[]) => {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
};
const slope = (values: number[]) => {
  if (values.length < 2) return 0;
  const xm = (values.length - 1) / 2;
  const ym = mean(values);
  const numerator = values.reduce((sum, y, x) => sum + (x - xm) * (y - ym), 0);
  const denominator = values.reduce((sum, _, x) => sum + (x - xm) ** 2, 0);
  return denominator ? numerator / denominator : 0;
};
const ewma = (values: number[], alpha = .42) => {
  if (!values.length) return 0;
  return values.slice(1).reduce((value, next) => alpha * next + (1 - alpha) * value, values[0]);
};
const correlation = (a: number[], b: number[]) => {
  if (a.length < 8 || a.length !== b.length) return 0;
  const am = mean(a), bm = mean(b), as = std(a), bs = std(b);
  if (!as || !bs) return 0;
  return mean(a.map((v, i) => ((v - am) / as) * ((b[i] - bm) / bs)));
};

function statPoints(stats: Record<string, number>, scoring: Scoring) {
  const direct = stats[`pts_${scoring}`];
  if (typeof direct === "number") return direct;
  const reception = scoring === "ppr" ? 1 : scoring === "half_ppr" ? .5 : 0;
  return (stats.pass_yd || 0) / 25 + (stats.pass_td || 0) * 4 - (stats.pass_int || 0) * 2
    + (stats.rush_yd || 0) / 10 + (stats.rush_td || 0) * 6
    + (stats.rec_yd || 0) / 10 + (stats.rec_td || 0) * 6 + (stats.rec || 0) * reception
    - (stats.fum_lost || 0) * 2;
}

function opportunity(stats: Record<string, number>, position: Position) {
  if (position === "QB") return (stats.pass_att || 0) + (stats.rush_att || 0) * 1.8;
  if (position === "RB") return (stats.rush_att || 0) + (stats.rec_tgt || 0) * 1.6;
  if (position === "K") return (stats.fga || 0) * 2.2 + (stats.xpa || 0);
  if (position === "DEF") return (stats.sack || 0) + (stats.int || 0) * 2 +
    (stats.fum_rec || 0) * 2 + (stats.blk_kick || 0) * 2;
  return (stats.rec_tgt || 0) * 2 + (stats.rush_att || 0);
}

function efficiency(stats: Record<string, number>, position: Position) {
  if (position === "QB") return (stats.pass_yd || 0) / Math.max(1, stats.pass_att || 0);
  if (position === "RB") return ((stats.rush_yd || 0) + (stats.rec_yd || 0)) /
    Math.max(1, (stats.rush_att || 0) + (stats.rec_tgt || 0));
  if (position === "K") return (stats.fgm || 0) / Math.max(1, stats.fga || 0) * 10;
  if (position === "DEF") return statPoints(stats, "std");
  return (stats.rec_yd || 0) / Math.max(1, stats.rec_tgt || 0);
}

function featureSet(rows: WeekStat[], position: Position, scoring: Scoring) {
  const points = rows.map((r) => statPoints(r.stats, scoring));
  const opp = rows.map((r) => opportunity(r.stats, position));
  const eff = rows.map((r) => efficiency(r.stats, position));
  return {
    season: mean(points), ewma: ewma(points), last3: mean(points.slice(-3)),
    opportunity: ewma(opp), efficiency: ewma(eff), trend: slope(points),
  };
}

function featureValues(features: ReturnType<typeof featureSet>, position: Position): Record<FeatureKey, number> {
  return {
    season: features.season,
    ewma: features.ewma,
    last3: features.last3,
    opportunity: position === "QB" ? features.opportunity * .42
      : position === "K" ? features.opportunity * 1.2
      : position === "DEF" ? features.opportunity * 1.1 : features.opportunity * .48,
    efficiency: position === "QB" ? features.efficiency * 2.5 : features.efficiency,
    trend: Math.max(0, features.season + features.trend * 2),
  };
}

function weightedBaseline(features: ReturnType<typeof featureSet>, position: Position, weights: Record<FeatureKey, number>) {
  const values = featureValues(features, position);
  return FEATURES.reduce((total, key) => total + values[key] * weights[key], 0);
}

function buildMetrics(rows: WeekStat[], position: Position): PlayerMetric[] {
  const avg = (key: string) => mean(rows.map((r) => r.stats[key] || 0));
  const sum = (key: string) => rows.reduce((total, r) => total + (r.stats[key] || 0), 0);
  const common: PlayerMetric[] = [
    { key: "snaps", label: "Snaps / game", value: round(mean(rows.map((r) => r.stats.off_snp || r.stats.def_snp || r.stats.st_snp || 0))) },
  ];
  if (position === "QB") return [
    { key: "passAtt", label: "Pass attempts", value: round(avg("pass_att")) },
    { key: "passYds", label: "Pass yards", value: round(avg("pass_yd")) },
    { key: "passTd", label: "Pass TDs", value: round(avg("pass_td"), 2) },
    { key: "rushAtt", label: "Rush attempts", value: round(avg("rush_att")) }, ...common,
  ];
  if (position === "RB") return [
    { key: "touches", label: "Touches / game", value: round(avg("rush_att") + avg("rec")) },
    { key: "carries", label: "Carries / game", value: round(avg("rush_att")) },
    { key: "targets", label: "Targets / game", value: round(avg("rec_tgt")) },
    { key: "totalYds", label: "Scrimmage yards", value: round(avg("rush_yd") + avg("rec_yd")) }, ...common,
  ];
  if (position === "WR" || position === "TE") return [
    { key: "targets", label: "Targets / game", value: round(avg("rec_tgt")) },
    { key: "receptions", label: "Receptions / game", value: round(avg("rec")) },
    { key: "recYds", label: "Receiving yards", value: round(avg("rec_yd")) },
    { key: "catchRate", label: "Catch rate", value: round(sum("rec") / Math.max(1, sum("rec_tgt")) * 100), unit: "%" }, ...common,
  ];
  if (position === "K") return [
    { key: "fga", label: "FG attempts / game", value: round(avg("fga")) },
    { key: "fgm", label: "FG made / game", value: round(avg("fgm")) },
    { key: "fgPct", label: "FG conversion", value: round(sum("fgm") / Math.max(1, sum("fga")) * 100), unit: "%" },
    { key: "xpm", label: "XP made / game", value: round(avg("xpm")) },
  ];
  return [
    { key: "sacks", label: "Sacks / game", value: round(avg("sack")) },
    { key: "takeaways", label: "Takeaways / game", value: round(avg("int") + avg("fum_rec")) },
    { key: "pointsAllowed", label: "Points allowed", value: round(avg("pts_allow")) },
    { key: "yardsAllowed", label: "Yards allowed", value: round(avg("yds_allow")) },
  ];
}

function matchup(bundle: SeasonBundle, team: string, week: number) {
  const game = bundle.schedule.find((g) => g.week === week && (g.home === team || g.away === team));
  if (!game) return { opponent: "BYE", kickoff: "Bye week", isBye: true };
  const date = new Date(`${game.date}T12:00:00Z`);
  return {
    opponent: game.home === team ? game.away : game.home,
    kickoff: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }),
    isBye: false,
  };
}

function injuryMultiplier(status?: string | null) {
  const s = status?.toLowerCase();
  if (s === "out" || s === "ir") return 0;
  if (s === "doubtful") return .15;
  if (s === "questionable") return .85;
  return 1;
}

function positionRanksByWeek(bundle: SeasonBundle, scoring: Scoring) {
  const output = new Map<string, Map<number, number>>();
  for (const position of POSITIONS) {
    for (let week = 1; week < bundle.state.week; week++) {
      const players = bundle.players.filter((p) => p.position === position)
        .map((p) => ({ id: p.id, points: statPoints((bundle.history.get(p.id) || []).find((r) => r.week === week)?.stats || {}, scoring) }))
        .filter((x) => x.points > 0).sort((a, b) => b.points - a.points);
      players.forEach((entry, index) => {
        if (!output.has(entry.id)) output.set(entry.id, new Map());
        output.get(entry.id)!.set(week, index + 1);
      });
    }
  }
  return output;
}

function pointsAllowedByDefense(bundle: SeasonBundle, scoring: Scoring) {
  const allowed = new Map<string, number[]>();
  for (const player of bundle.players) {
    for (const row of bundle.history.get(player.id) || []) {
      const game = bundle.schedule.find((entry) => entry.week === row.week && (entry.home === player.team || entry.away === player.team));
      if (!game) continue;
      const defense = game.home === player.team ? game.away : game.home;
      const key = `${player.position}:${defense}`;
      const values = allowed.get(key) || [];
      values.push(statPoints(row.stats, scoring));
      allowed.set(key, values);
    }
  }
  return new Map([...allowed.entries()].map(([key, values]) => [key, mean(values)]));
}

function defenseVsPosition(bundle: SeasonBundle, scoring: Scoring, beforeWeek?: number) {
  const allowed = new Map<string, number[]>();
  for (const player of bundle.players) {
    for (const row of (bundle.history.get(player.id) || []).filter((entry) => beforeWeek === undefined || entry.week < beforeWeek)) {
      const game = bundle.schedule.find((g) => g.week === row.week && (g.home === player.team || g.away === player.team));
      if (!game) continue;
      const defense = game.home === player.team ? game.away : game.home;
      const key = `${player.position}:${defense}`;
      const values = allowed.get(key) || [];
      values.push(statPoints(row.stats, scoring));
      allowed.set(key, values);
    }
  }
  const output = new Map<string, number>();
  for (const position of POSITIONS) {
    const teams = [...allowed.entries()].filter(([key]) => key.startsWith(`${position}:`))
      .map(([key, values]) => ({ key, average: mean(values) })).sort((a, b) => a.average - b.average);
    teams.forEach((team, index) => {
      const percentile = teams.length > 1 ? index / (teams.length - 1) : .5;
      output.set(team.key, (percentile - .5) * .24);
    });
  }
  return output;
}

type ModelSpec = {
  name: string;
  weights: Record<FeatureKey, number>;
  sleeperWeight: number;
};

type SelectedModel = ModelSpec & { bias: number };

const backtestCache = new Map<string, { selected: Record<Position, SelectedModel>; diagnostics: PositionModelDiagnostic[]; usage: Record<Position, UsageFit> }>();

function candidateModels(position: Position): ModelSpec[] {
  const balanced = DEFAULT_WEIGHTS[position];
  return [
    { name: "Balanced ensemble", weights: balanced, sleeperWeight: .45 },
    { name: "Volume first", weights: { season: .10, ewma: .18, last3: .10, opportunity: .45, efficiency: .07, trend: .10 }, sleeperWeight: .30 },
    { name: "Recent form", weights: { season: .08, ewma: .32, last3: .28, opportunity: .17, efficiency: .05, trend: .10 }, sleeperWeight: .30 },
    { name: "Season stable", weights: { season: .34, ewma: .25, last3: .08, opportunity: .18, efficiency: .10, trend: .05 }, sleeperWeight: .40 },
    { name: "Consensus anchored", weights: balanced, sleeperWeight: .68 },
    { name: "Sleeper consensus", weights: balanced, sleeperWeight: 1 },
  ];
}

function currentSeasonTraining(bundle: SeasonBundle): TrainingSeason {
  const rows = new Map<string, TrainingWeekStat[]>();
  for (const player of bundle.players) {
    const history = (bundle.history.get(player.id) || []).map((row) => ({ ...row, team: player.team, position: player.position }));
    if (history.length) rows.set(player.id, history);
  }
  return { season: bundle.state.season, schedule: bundle.schedule, rows, projections: bundle.projectionHistory };
}

function seasonDefenseSignal(season: TrainingSeason, scoring: Scoring, beforeWeek: number) {
  const allowed = new Map<string, number[]>();
  for (const rows of season.rows.values()) {
    for (const row of rows) {
      if (row.week >= beforeWeek) continue;
      const game = season.schedule.find((entry) => entry.week === row.week && (entry.home === row.team || entry.away === row.team));
      if (!game) continue;
      const defense = game.home === row.team ? game.away : game.home;
      const key = `${row.position}:${defense}`;
      const values = allowed.get(key) || [];
      values.push(statPoints(row.stats, scoring));
      allowed.set(key, values);
    }
  }
  const output = new Map<string, number>();
  for (const position of POSITIONS) {
    const teams = [...allowed.entries()].filter(([key]) => key.startsWith(`${position}:`))
      .map(([key, values]) => ({ key, average: mean(values) })).sort((a, b) => a.average - b.average);
    teams.forEach((team, index) => output.set(team.key, teams.length > 1 ? (index / (teams.length - 1) - .5) * .24 : 0));
  }
  return output;
}

function teamTotals(season: TrainingSeason) {
  const totals = new Map<string, { targets: number; carries: number }>();
  for (const rows of season.rows.values()) {
    for (const row of rows) {
      const key = `${row.team}:${row.week}`;
      const current = totals.get(key) || { targets: 0, carries: 0 };
      current.targets += row.stats.rec_tgt || 0;
      current.carries += row.stats.rush_att || 0;
      totals.set(key, current);
    }
  }
  return totals;
}

function fanSignals(season: TrainingSeason, throughWeek: number) {
  const series = new Map<string, { week: number; value: number }[]>();
  const fields: [Position, string][] = [["QB", "fan_pts_allow_qb"], ["RB", "fan_pts_allow_rb"], ["WR", "fan_pts_allow_wr"], ["TE", "fan_pts_allow_te"], ["K", "fan_pts_allow_k"]];
  for (const rows of season.rows.values()) {
    for (const row of rows) {
      if (row.position !== "DEF") continue;
      for (const [position, field] of fields) {
        if (typeof row.stats[field] !== "number") continue;
        const key = `${position}:${row.team}`;
        const list = series.get(key) || [];
        list.push({ week: row.week, value: row.stats[field] });
        series.set(key, list);
      }
    }
  }
  const output = new Map<string, number>();
  for (let week = 3; week <= throughWeek; week++) {
    for (const position of ["QB", "RB", "WR", "TE", "K"] as Position[]) {
      const averages: { team: string; average: number }[] = [];
      for (const [key, games] of series) {
        if (!key.startsWith(`${position}:`)) continue;
        const prior = games.filter((game) => game.week < week);
        if (prior.length < 2) continue;
        averages.push({ team: key.slice(position.length + 1), average: mean(prior.map((game) => game.value)) });
      }
      averages.sort((a, b) => a.average - b.average);
      averages.forEach((team, index) => output.set(`${week}:${position}:${team.team}`, averages.length > 1 ? (index / (averages.length - 1) - .5) * .24 : 0));
    }
  }
  return output;
}

function collectSeasonSamples(season: TrainingSeason, position: Position, scoring: Scoring, results: { spec: ModelSpec; predictions: number[]; actuals: number[] }[], featureSamples: Record<FeatureKey, number[]>, featureTargets: number[]) {
  const completedWeeks = [...season.projections.keys()].filter((week) => week >= 3).sort((a, b) => a - b);
  for (const targetWeek of completedWeeks) {
    const dvp = seasonDefenseSignal(season, scoring, targetWeek);
    for (const [playerId, rows] of season.rows) {
      const actualRow = rows.find((row) => row.week === targetWeek && row.position === position);
      const priorRows = rows.filter((row) => row.week < targetWeek && row.position === position).sort((a, b) => a.week - b.week);
      if (!actualRow || priorRows.length < 2) continue;
      const game = season.schedule.find((entry) => entry.week === targetWeek && (entry.home === actualRow.team || entry.away === actualRow.team));
      if (!game) continue;
      const actual = statPoints(actualRow.stats, scoring);
      const features = featureSet(priorRows, position, scoring);
      const values = featureValues(features, position);
      const historicalPrior = statPoints(season.projections.get(targetWeek)?.get(playerId) || {}, scoring);
      const opponent = game.home === actualRow.team ? game.away : game.home;
      const recentOpportunity = opportunity(priorRows.at(-1)!.stats, position);
      const opportunityShare = Math.min(1, recentOpportunity / Math.max(1, features.opportunity));
      const matchupSignal = (dvp.get(`${position}:${opponent}`) || 0) * (.55 + opportunityShare * .45);
      FEATURES.forEach((key) => featureSamples[key].push(values[key]));
      featureTargets.push(actual);
      for (const result of results) {
        const baseline = weightedBaseline(features, position, result.spec.weights);
        const blended = historicalPrior > 0 ? baseline * (1 - result.spec.sleeperWeight) + historicalPrior * result.spec.sleeperWeight : baseline;
        result.predictions.push(Math.max(0, blended * (1 + matchupSignal)));
        result.actuals.push(actual);
      }
    }
  }
}

function collectUsageSamples(seasons: TrainingSeason[], position: Position, spec: ModelSpec, scoring: Scoring) {
  const samples: UsageSample[] = [];
  for (const season of seasons) {
    const totals = teamTotals(season);
    const maxWeek = Math.max(...season.projections.keys(), 0);
    const fan = fanSignals(season, maxWeek);
    const completedWeeks = [...season.projections.keys()].filter((week) => week >= 3).sort((a, b) => a - b);
    for (const targetWeek of completedWeeks) {
      const dvp = seasonDefenseSignal(season, scoring, targetWeek);
      for (const [playerId, rows] of season.rows) {
        const actualRow = rows.find((row) => row.week === targetWeek && row.position === position);
        const priorRows = rows.filter((row) => row.week < targetWeek && row.position === position).sort((a, b) => a.week - b.week);
        if (!actualRow || priorRows.length < 2) continue;
        const game = season.schedule.find((entry) => entry.week === targetWeek && (entry.home === actualRow.team || entry.away === actualRow.team));
        if (!game) continue;
        const features = featureSet(priorRows, position, scoring);
        const values = featureValues(features, position);
        const historicalPrior = statPoints(season.projections.get(targetWeek)?.get(playerId) || {}, scoring);
        const opponent = game.home === actualRow.team ? game.away : game.home;
        const recentOpportunity = opportunity(priorRows.at(-1)!.stats, position);
        const opportunityShare = Math.min(1, recentOpportunity / Math.max(1, features.opportunity));
        const scale = .55 + opportunityShare * .45;
        const profile = usageProfile(priorRows.map((row) => {
          const team = totals.get(`${row.team}:${row.week}`) || { targets: 0, carries: 0 };
          return weeklyUsage(row.stats, position, team.targets, team.carries);
        }), USAGE_CANDIDATES[position]);
        const model = weightedBaseline(features, position, spec.weights);
        samples.push({
          actual: statPoints(actualRow.stats, scoring),
          preMatchup: historicalPrior > 0 ? model * (1 - spec.sleeperWeight) + historicalPrior * spec.sleeperWeight : model,
          dvpSignal: (dvp.get(`${position}:${opponent}`) || 0) * scale,
          fanSignal: fan.has(`${targetWeek}:${position}:${opponent}`) ? (fan.get(`${targetWeek}:${position}:${opponent}`) || 0) * scale : null,
          values, weights: spec.weights,
          sleeperPoints: historicalPrior, sleeperWeight: historicalPrior > 0 ? spec.sleeperWeight : 0,
          metrics: profile,
        });
      }
    }
  }
  return samples;
}

function backtestModels(bundle: SeasonBundle, priorSeason: TrainingSeason | null, scoring: Scoring) {
  const completedRows = [...bundle.history.values()].reduce((total, rows) => total + rows.length, 0);
  const cacheKey = `${bundle.state.season}:${bundle.state.display_week || bundle.state.week}:${completedRows}:${priorSeason?.season || "none"}:${scoring}`;
  const cached = backtestCache.get(cacheKey);
  if (cached) return cached;
  const selected = {} as Record<Position, SelectedModel>;
  const diagnostics: PositionModelDiagnostic[] = [];
  const usage = {} as Record<Position, UsageFit>;
  const seasons = [priorSeason, currentSeasonTraining(bundle)].filter((season): season is TrainingSeason => Boolean(season));

  for (const position of POSITIONS) {
    const specs = candidateModels(position);
    const results = specs.map((spec) => ({ spec, predictions: [] as number[], actuals: [] as number[] }));
    const featureSamples = Object.fromEntries(FEATURES.map((key) => [key, [] as number[]])) as unknown as Record<FeatureKey, number[]>;
    const featureTargets: number[] = [];
    for (const season of seasons) collectSeasonSamples(season, position, scoring, results, featureSamples, featureTargets);

    const evaluated = results.map((result) => {
      const errors = result.predictions.map((prediction, index) => result.actuals[index] - prediction);
      return {
        ...result,
        mae: mean(errors.map(Math.abs)),
        rmse: Math.sqrt(mean(errors.map((error) => error ** 2))),
        bias: mean(errors),
      };
    }).filter((result) => result.predictions.length > 0);
    const fallback = specs[0];
    const winner = evaluated.slice().sort((a, b) => a.mae - b.mae)[0];
    const baselineResult = evaluated.find((result) => result.spec.name === "Balanced ensemble") || winner;
    const fit = fitUsageAdjustments(collectUsageSamples(seasons, position, winner?.spec || fallback, scoring), position);
    usage[position] = fit;
    selected[position] = { ...(winner?.spec || fallback), bias: fit.baselineMae > 0 ? fit.bias : Math.max(-2.5, Math.min(2.5, winner?.bias || 0)) };
    if (process.env.NODE_ENV !== "production") {
      console.info(`USAGE ${position} ${JSON.stringify({ baselineMae: round(fit.baselineMae, 3), finalMae: round(fit.finalMae, 3), fanMatchup: fit.useFanMatchup, fanGain: round(fit.matchupMaeImprovement, 3), added: fit.added.map((item) => ({ metric: item.label, mae: round(item.maeImprovement, 3) })), core: fit.core.map((item) => ({ metric: item.label, mae: round(item.maeIncreaseIfRemoved, 3) })) })}`);
    }
    const variableRows = FEATURES.map((key) => ({
      key,
      label: FEATURE_LABELS[key],
      weight: round(selected[position].weights[key] * 100),
      correlation: round(correlation(featureSamples[key], featureTargets), 2),
    })).sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
    diagnostics.push({
      position,
      selectedModel: selected[position].name,
      samples: winner?.predictions.length || 0,
      mae: round(winner?.mae || 0, 2),
      rmse: round(winner?.rmse || 0, 2),
      lastWeekMae: 0,
      baselineMae: round(baselineResult?.mae || 0, 2),
      improvementPct: baselineResult?.mae
        ? round(Math.max(0, (baselineResult.mae - (winner?.mae || baselineResult.mae)) / baselineResult.mae * 100), 1)
        : 0,
      biasCorrection: round(selected[position].bias, 2),
      variables: variableRows,
      candidates: evaluated.map((result) => ({ name: result.spec.name, mae: round(result.mae, 2), rmse: round(result.rmse, 2) }))
        .sort((a, b) => a.mae - b.mae),
    });
  }
  const output = { selected, diagnostics, usage };
  backtestCache.set(cacheKey, output);
  if (backtestCache.size > 12) backtestCache.delete(backtestCache.keys().next().value!);
  if (process.env.NODE_ENV !== "production") {
    console.info(`Gridline trained on ${seasons.map((season) => season.season).join(" + ")}: ${diagnostics.map((item) => `${item.position} ${item.selectedModel} MAE ${item.mae} (${item.samples})`).join("; ")}`);
  }
  return output;
}

export async function calculateRankings(scoring: Scoring = "ppr", requestedWeek?: number, includeByes = false): Promise<RankingsResponse> {
  const bundle = await getSeasonBundle();
  const priorSeason = await getPriorSeasonTraining(bundle.state.previous_season);
  const week = requestedWeek || bundle.state.display_week || bundle.state.week;
  const backtest = backtestModels(bundle, priorSeason, scoring);
  const weights = Object.fromEntries(POSITIONS
    .map((p) => [p, backtest.selected[p].weights])) as Record<Position, Record<FeatureKey, number>>;
  const rankHistory = positionRanksByWeek(bundle, scoring);
  const dvp = defenseVsPosition(bundle, scoring);
  const currentSeason = currentSeasonTraining(bundle);
  const currentTotals = teamTotals(currentSeason);
  const currentFan = fanSignals(currentSeason, week);
  const eligible = bundle.players.filter((p) =>
    bundle.projections.has(p.id) || bundle.history.has(p.id) || Boolean(p.injuryStatus),
  );
  const rough: Ranking[] = eligible.map((player) => {
    const rows = (bundle.history.get(player.id) || []).filter((r) => r.week < week).sort((a, b) => a.week - b.week);
    const points = rows.map((r) => statPoints(r.stats, scoring));
    const f = featureSet(rows, player.position, scoring);
    const w = weights[player.position];
    const selectedModel = backtest.selected[player.position];
    const projectionStats = bundle.projections.get(player.id) || {};
    const prior = statPoints(projectionStats, scoring);
    const values = featureValues(f, player.position);
    const opportunityBaseline = values.opportunity;
    const efficiencyBaseline = values.efficiency;
    const model = weightedBaseline(f, player.position, w);
    const { opponent, kickoff, isBye } = matchup(bundle, player.team, week);
    const m = injuryMultiplier(player.injuryStatus);
    const remainingGames = bundle.schedule.filter((g) => g.week >= week && (g.home === player.team || g.away === player.team)).length;
    const healthAssessment = assessInjury(player, remainingGames);
    const volatility = Math.max(2.2, std(points));
    const oppTrend = slope(rows.map((r) => opportunity(r.stats, player.position)));
    const trend: Ranking["trend"] = points.length < 2 ? "New" : f.trend > .65 || oppTrend > .7 ? "Rising" : f.trend < -.65 || oppTrend < -.7 ? "Fading" : "Steady";
    const rawDvp = dvp.get(`${player.position}:${opponent}`) || 0;
    const recentOpportunity = rows.length ? opportunity(rows.at(-1)!.stats, player.position) : 0;
    const opportunityShare = Math.min(1, recentOpportunity / Math.max(1, f.opportunity));
    const usageFit = backtest.usage[player.position];
    const fanSignal = currentFan.get(`${week}:${player.position}:${opponent}`);
    const rawMatchup = usageFit?.useFanMatchup && fanSignal !== undefined ? fanSignal : rawDvp;
    const matchupSignal = rawMatchup * (.55 + opportunityShare * .45);
    const blended = prior > 0
      ? model * (1 - selectedModel.sleeperWeight) + prior * selectedModel.sleeperWeight
      : model;
    const usageProfileNow = usageProfile(rows.map((row) => {
      const team = currentTotals.get(`${player.team}:${row.week}`) || { targets: 0, carries: 0 };
      return weeklyUsage(row.stats, player.position, team.targets, team.carries);
    }), usageFit?.added.map((term) => term.key) || []);
    const usageAdjustment = (usageFit?.added || []).reduce((total, term) => {
      const value = usageProfileNow[term.key];
      return value === null ? total : total + Math.max(-4, Math.min(4, term.slope * value));
    }, 0);
    const projection = Math.max(0, (blended * (1 + matchupSignal) + selectedModel.bias + usageAdjustment) * m);
    const factors: Factor[] = [
      { key: "opportunity", label: "Opportunity", value: round(f.opportunity), weight: round(w.opportunity * 100), impact: round(opportunityBaseline * w.opportunity) },
      { key: "form", label: "Recent form", value: round(f.last3), weight: round((w.last3 + w.ewma) * 100), impact: round(f.last3 * w.last3 + f.ewma * w.ewma) },
      { key: "season", label: "Season body", value: round(f.season), weight: round(w.season * 100), impact: round(f.season * w.season) },
      { key: "efficiency", label: "Efficiency", value: round(f.efficiency), weight: round(w.efficiency * 100), impact: round(efficiencyBaseline * w.efficiency) },
    ];
    return {
      player, overallRank: 0, positionRank: 0, projection: round(projection),
      floor: round(Math.max(0, projection - volatility)), ceiling: round(projection + volatility),
      seasonPpg: round(mean(points)), last3Ppg: round(mean(points.slice(-3))), trend,
      matchupGrade: matchupSignal >= .03 ? "A" : matchupSignal >= .01 ? "B" : matchupSignal <= -.03 ? "D" : "C",
      opponent, kickoff, isBye, week,
      history: rows.map((r) => ({
        week: r.week, points: round(statPoints(r.stats, scoring)), positionRank: rankHistory.get(player.id)?.get(r.week),
        opportunity: round(opportunity(r.stats, player.position)), efficiency: round(efficiency(r.stats, player.position)),
        snaps: round(r.stats.off_snp || r.stats.def_snp || r.stats.st_snp || 0),
      })),
      factors, metrics: buildMetrics(rows, player.position), outlook: [
        `${trend} profile: ${round(f.last3)} points per game over the last three.`,
        `${isBye ? `Bye in Week ${week}` : `${matchupSignal >= 0 ? "Positive" : "Challenging"} matchup vs ${opponent}`}.`,
        player.injuryStatus ? `${player.injuryStatus}: availability is priced into the range.` : `Healthy usage profile entering Week ${week}.`,
      ],
      injuryMultiplier: m, healthAssessment, adaptiveWeights: w,
    };
  }).filter((r) => r.projection > .5 || r.seasonPpg > 2 || Boolean(r.player.injuryStatus));
  const rankedPool = includeByes ? rough : rough.filter((r) => !r.isBye);
  rankedPool.sort((a, b) => b.projection - a.projection);
  rankedPool.forEach((r, index) => { r.overallRank = index + 1; });
  for (const position of POSITIONS) {
    rankedPool.filter((r) => r.player.position === position).forEach((r, index) => { r.positionRank = index + 1; });
  }
  const visible = rankedPool.slice(0, 400);
  const visibleIds = new Set(visible.map((r) => r.player.id));
  for (const injured of rankedPool.filter((r) => r.player.injuryStatus && !visibleIds.has(r.player.id))) {
    visible.push(injured);
  }
  return {
    season: bundle.state.season, week, scoring, source: bundle.source,
    updatedAt: bundle.updatedAt, rankings: visible, modelWeights: weights,
  };
}

export async function calculateRestOfSeasonRankings(scoring: Scoring = "ppr"): Promise<RosRankingsResponse> {
  const bundle = await getSeasonBundle();
  const week = bundle.state.display_week || bundle.state.week;
  const weekly = await calculateRankings(scoring, week, true);
  const pointsAllowed = pointsAllowedByDefense(bundle, scoring);
  const matchupSignal = defenseVsPosition(bundle, scoring);
  const regularSeasonWeeks = Math.max(18, ...bundle.schedule.map((game) => game.week));
  const calendarWeeks = Array.from({ length: regularSeasonWeeks }, (_, index) => index + 1);
  const calendarFor = (team: string, position: Position) => calendarWeeks.map((calendarWeek) => {
    const game = bundle.schedule.find((g) => g.week === calendarWeek && (g.home === team || g.away === team));
    if (!game) return { week: calendarWeek, opponent: null, grade: null };
    const opponent = game.home === team ? game.away : game.home;
    const signal = matchupSignal.get(`${position}:${opponent}`);
    const grade = signal === undefined ? null : signal >= .06 ? "A" : signal >= 0 ? "B" : signal >= -.06 ? "C" : "D";
    return { week: calendarWeek, opponent, grade } satisfies RosMatchup;
  });
  const preliminary: (RosRanking & { scheduleEase: number })[] = weekly.rankings.map((ranking) => {
    const games = bundle.schedule.filter((g) => g.week >= week && (g.home === ranking.player.team || g.away === ranking.player.team));
    const health = assessInjury(ranking.player, games.length);
    const preInjury = ranking.last3Ppg > 0
      ? ranking.seasonPpg * .45 + ranking.last3Ppg * .55
      : ranking.seasonPpg;
    const healthyWeekly = ranking.injuryMultiplier > 0 && ranking.projection > 0
      ? ranking.projection / ranking.injuryMultiplier
      : preInjury;
    const baseline = Math.max(0, preInjury * .62 + healthyWeekly * .38);
    const allowed = games.map((game) => {
      const opponent = game.home === ranking.player.team ? game.away : game.home;
      return pointsAllowed.get(`${ranking.player.position}:${opponent}`) ?? Number.NaN;
    }).filter((value) => Number.isFinite(value));
    const expectedGamesActive = Math.max(0, games.length - health.expectedGamesMissed);
    return {
      ...ranking, healthAssessment: health, rosRank: 0, rosPositionRank: 0,
      rosProjection: 0, rosPpg: round(baseline * health.returnFactor),
      gamesRemaining: games.length, expectedGamesActive: round(expectedGamesActive),
      scheduleGrade: games.length ? "C" : "—", scheduleEase: allowed.length ? mean(allowed) : Number.NaN, valueScore: 0,
      matchups: calendarFor(ranking.player.team, ranking.player.position),
    };
  });
  for (const position of POSITIONS) {
    const group = preliminary.filter((ranking) => ranking.player.position === position && ranking.gamesRemaining > 0)
      .sort((a, b) => (b.scheduleEase || 0) - (a.scheduleEase || 0));
    group.forEach((ranking, index) => {
      const percentile = group.length > 1 ? index / (group.length - 1) : .5;
      ranking.scheduleGrade = percentile <= .24 ? "A" : percentile <= .49 ? "B" : percentile <= .74 ? "C" : "D";
      const scheduleMultiplier = 1.12 - percentile * .24;
      ranking.rosPpg = round(ranking.rosPpg * scheduleMultiplier);
      ranking.rosProjection = round(ranking.rosPpg * ranking.expectedGamesActive);
    });
  }
  for (const position of POSITIONS) {
    const group = preliminary.filter((r) => r.player.position === position).sort((a, b) => b.rosPpg - a.rosPpg);
    const replacementIndex = position === "RB" ? 29 : position === "WR" ? 35 : 11;
    const replacement = group[Math.min(replacementIndex, Math.max(0, group.length - 1))]?.rosPpg || 0;
    for (const ranking of group) {
      const aboveReplacement = Math.max(0, ranking.rosPpg - replacement) * ranking.expectedGamesActive;
      ranking.valueScore = round(aboveReplacement + ranking.rosProjection * .28);
    }
  }
  preliminary.sort((a, b) => b.valueScore - a.valueScore);
  preliminary.forEach((r, index) => { r.rosRank = index + 1; });
  for (const position of POSITIONS) {
    preliminary.filter((r) => r.player.position === position).forEach((r, index) => { r.rosPositionRank = index + 1; });
  }
  return {
    season: bundle.state.season, week, scoring, source: bundle.source,
    updatedAt: bundle.updatedAt, rankings: preliminary,
  };
}
