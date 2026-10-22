import type { Position } from "@/lib/types";

export const USAGE_LABELS: Record<string, string> = {
  snapShare: "Snap share",
  targetShare: "Target share",
  carryShare: "Carry share",
  redZone: "Red-zone opportunities",
  airYards: "Air yards",
  yardsAfterCatch: "Yards after catch",
  yardsAfterContact: "Yards after contact",
  firstDowns: "First downs",
  deepTargets: "Downfield target rate",
  firstHalf: "First-half production",
  sackRate: "Sack rate",
  completion: "Completion rate",
  yardsPerAttempt: "Yards per attempt",
  yardsPerCarry: "Yards per carry",
  yardsPerTarget: "Yards per target",
  startRate: "Games started",
  longFieldGoals: "Long field-goal rate",
  extraPoints: "Extra points",
  pressure: "Pressure created",
  takeaways: "Takeaways",
  pointsAllowed: "Points allowed",
  yardsAllowed: "Yards allowed",
  fantasyAllowed: "Fantasy points allowed",
  sleeper: "Consensus projection",
  season: "Season average",
  ewma: "Recent form",
  last3: "Last three games",
  opportunity: "Opportunity volume",
  efficiency: "Efficiency",
  trend: "Season trend",
  matchup: "Matchup",
};

export const USAGE_CANDIDATES: Record<Position, string[]> = {
  QB: ["redZone", "airYards", "firstDowns", "firstHalf", "sackRate", "completion", "yardsPerAttempt", "startRate"],
  RB: ["snapShare", "carryShare", "targetShare", "redZone", "yardsAfterContact", "firstDowns", "firstHalf", "yardsPerCarry", "startRate"],
  WR: ["snapShare", "targetShare", "redZone", "airYards", "yardsAfterCatch", "firstDowns", "deepTargets", "firstHalf", "yardsPerTarget", "startRate"],
  TE: ["snapShare", "targetShare", "redZone", "airYards", "yardsAfterCatch", "firstDowns", "deepTargets", "firstHalf", "yardsPerTarget", "startRate"],
  K: ["longFieldGoals", "extraPoints"],
  DEF: ["pressure", "takeaways", "pointsAllowed", "yardsAllowed", "fantasyAllowed"],
};

export interface UsageSample {
  actual: number;
  preMatchup: number;
  dvpSignal: number;
  fanSignal: number | null;
  values: Record<string, number>;
  weights: Record<string, number>;
  sleeperPoints: number;
  sleeperWeight: number;
  metrics: Record<string, number | null>;
}

export interface UsageTerm {
  key: string;
  label: string;
  slope: number;
  maeImprovement: number;
}

export interface UsageFit {
  baselineMae: number;
  finalMae: number;
  useFanMatchup: boolean;
  matchupMaeImprovement: number;
  added: UsageTerm[];
  core: { key: string; label: string; maeIncreaseIfRemoved: number }[];
  bias: number;
}

const numberOrNull = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

export function weeklyUsage(stats: Record<string, number>, position: Position, teamTargets: number, teamCarries: number) {
  const targets = numberOrNull(stats.rec_tgt);
  const carries = numberOrNull(stats.rush_att);
  const attempts = numberOrNull(stats.pass_att);
  const snaps = numberOrNull(stats.off_snp);
  const teamSnaps = numberOrNull(stats.tm_off_snp);
  const deep = (stats.rec_20_29 || 0) + (stats.rec_30_39 || 0) + (stats.rec_40p || 0);
  return {
    snapShare: snaps !== null && teamSnaps ? snaps / teamSnaps : null,
    targetShare: targets !== null && teamTargets > 0 ? targets / teamTargets : null,
    carryShare: carries !== null && teamCarries > 0 ? carries / teamCarries : null,
    redZone: (stats.rec_rz_tgt || 0) + (stats.rush_rz_att || 0) + (stats.pass_rz_att || 0),
    airYards: position === "QB" ? numberOrNull(stats.pass_air_yd) : numberOrNull(stats.rec_air_yd),
    yardsAfterCatch: numberOrNull(stats.rec_yar),
    yardsAfterContact: numberOrNull(stats.rush_yac),
    firstDowns: (stats.rec_fd || 0) + (stats.rush_fd || 0) + (stats.pass_fd || 0),
    deepTargets: targets ? deep / targets : null,
    firstHalf: (stats.h1_pass_yd || 0) + (stats.h1_rush_yd || 0) + (stats.h1_rec_yd || 0),
    sackRate: attempts !== null && attempts + (stats.pass_sack || 0) > 0 ? (stats.pass_sack || 0) / (attempts + (stats.pass_sack || 0)) : null,
    completion: attempts ? (stats.pass_cmp || 0) / attempts : null,
    yardsPerAttempt: attempts ? (stats.pass_yd || 0) / attempts : null,
    yardsPerCarry: carries ? (stats.rush_yd || 0) / carries : null,
    yardsPerTarget: targets ? (stats.rec_yd || 0) / targets : null,
    startRate: numberOrNull(stats.gs),
    longFieldGoals: stats.fga > 0 ? ((stats.fgm_40_49 || 0) + (stats.fgm_50p || 0)) / stats.fga : null,
    extraPoints: numberOrNull(stats.xpm),
    pressure: (stats.qb_hit || 0) + (stats.sack || 0) + (stats.tkl_loss || 0),
    takeaways: (stats.int || 0) + (stats.fum_rec || 0) + (stats.ff || 0),
    pointsAllowed: numberOrNull(stats.pts_allow),
    yardsAllowed: numberOrNull(stats.yds_allow),
    fantasyAllowed: numberOrNull(stats.fan_pts_allow),
  } as Record<string, number | null>;
}

export function usageProfile(weeks: Record<string, number | null>[], keys: string[]) {
  const output: Record<string, number | null> = {};
  for (const key of keys) {
    const series = weeks.map((week) => week[key]).filter((value): value is number => value !== null && Number.isFinite(value));
    output[key] = series.length >= 2
      ? series.slice(1).reduce((value, next) => .42 * next + .58 * value, series[0])
      : null;
  }
  return output;
}

function mae(samples: UsageSample[], predictions: number[], indexes: number[]) {
  if (!indexes.length) return Number.POSITIVE_INFINITY;
  return indexes.reduce((total, index) => total + Math.abs(samples[index].actual - predictions[index]), 0) / indexes.length;
}

function prediction(sample: UsageSample, signal: number, weights = sample.weights, useSleeper = true) {
  const weightTotal = Object.values(weights).reduce((total, value) => total + value, 0) || 1;
  const model = Object.entries(weights).reduce((total, [key, weight]) => total + (sample.values[key] || 0) * weight / weightTotal, 0);
  const blended = useSleeper && sample.sleeperPoints > 0
    ? model * (1 - sample.sleeperWeight) + sample.sleeperPoints * sample.sleeperWeight
    : model;
  return Math.max(0, blended * (1 + signal));
}

function chosenSignal(sample: UsageSample, useFan: boolean) {
  return useFan && sample.fanSignal !== null ? sample.fanSignal : sample.dvpSignal;
}

function walkForward(samples: UsageSample[], predictions: number[], key: string) {
  let count = 0, sumX = 0, sumY = 0, sumXX = 0, sumXY = 0, error = 0, scored = 0, slope = 0;
  const next = predictions.slice();
  const indexes: number[] = [];
  samples.forEach((sample, index) => {
    const value = sample.metrics[key];
    if (value === null || !Number.isFinite(value)) return;
    if (count >= 40) {
      const denominator = count * sumXX - sumX * sumX;
      const rawSlope = denominator > 1e-8 ? (count * sumXY - sumX * sumY) / denominator : 0;
      slope = rawSlope * Math.min(1, count / 120);
      next[index] = Math.max(0, predictions[index] + Math.max(-4, Math.min(4, slope * value)));
      error += Math.abs(sample.actual - next[index]);
      scored += 1;
      indexes.push(index);
    }
    const residual = sample.actual - predictions[index];
    count += 1;
    sumX += value;
    sumY += residual;
    sumXX += value * value;
    sumXY += value * residual;
  });
  const denominator = count * sumXX - sumX * sumX;
  slope = (denominator > 1e-8 ? (count * sumXY - sumX * sumY) / denominator : 0) * Math.min(1, count / 120);
  return { mae: scored ? error / scored : Number.POSITIVE_INFINITY, slope, next, indexes, scored };
}

export function fitUsageAdjustments(samples: UsageSample[], position: Position): UsageFit {
  if (samples.length < 80) {
    return { baselineMae: 0, finalMae: 0, useFanMatchup: false, matchupMaeImprovement: 0, added: [], core: [], bias: 0 };
  }
  const dvpPredictions = samples.map((sample) => prediction(sample, sample.dvpSignal));
  const fanIndexes = samples.flatMap((sample, index) => sample.fanSignal === null ? [] : [index]);
  const fanPredictions = samples.map((sample) => prediction(sample, sample.fanSignal ?? sample.dvpSignal));
  const dvpMae = mae(samples, dvpPredictions, fanIndexes);
  const fanMae = mae(samples, fanPredictions, fanIndexes);
  const useFanMatchup = fanIndexes.length >= 80 && dvpMae - fanMae >= .01;
  let predictions = samples.map((sample) => prediction(sample, chosenSignal(sample, useFanMatchup)));
  const baselineMae = mae(samples, predictions, predictions.map((_, index) => index));
  const added: UsageTerm[] = [];
  const remaining = new Set(USAGE_CANDIDATES[position]);
  while (remaining.size && added.length < 5) {
    let best: { key: string; result: ReturnType<typeof walkForward> } | null = null;
    for (const key of remaining) {
      const result = walkForward(samples, predictions, key);
      const current = mae(samples, predictions, result.indexes);
      if (result.scored >= 80 && current - result.mae >= .01 && (!best || result.mae < best.result.mae)) best = { key, result };
    }
    if (!best) break;
    const current = mae(samples, predictions, best.result.indexes);
    added.push({ key: best.key, label: USAGE_LABELS[best.key], slope: best.result.slope, maeImprovement: current - best.result.mae });
    predictions = best.result.next;
    remaining.delete(best.key);
  }
  const finalIndexes = predictions.map((_, index) => index);
  const residuals = samples.map((sample, index) => sample.actual - predictions[index]);
  const bias = Math.max(-2.5, Math.min(2.5, residuals.reduce((total, value) => total + value, 0) / Math.max(1, residuals.length)));
  const coreKeys = ["sleeper", "matchup", ...Object.keys(samples[0]?.weights || {})];
  const core = coreKeys.map((key) => {
    const without = samples.map((sample) => {
      if (key === "matchup") return prediction(sample, 0);
      if (key === "sleeper") return prediction(sample, chosenSignal(sample, useFanMatchup), sample.weights, false);
      const weights = { ...sample.weights, [key]: 0 };
      return prediction(sample, chosenSignal(sample, useFanMatchup), weights);
    });
    return { key, label: USAGE_LABELS[key] || key, maeIncreaseIfRemoved: mae(samples, without, finalIndexes) - baselineMae };
  }).filter((item) => Math.abs(item.maeIncreaseIfRemoved) >= .005 || item.key === "sleeper" || item.key === "matchup");
  return {
    baselineMae, finalMae: mae(samples, predictions, finalIndexes), useFanMatchup,
    matchupMaeImprovement: useFanMatchup ? dvpMae - fanMae : 0, added, core, bias,
  };
}
