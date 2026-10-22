export type Scoring = "ppr" | "half_ppr" | "std";
export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

export interface Player {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  position: Position;
  team: string;
  active: boolean;
  injuryStatus?: string | null;
  injuryNotes?: string | null;
  injuryBodyPart?: string | null;
  injuryStartDate?: string | null;
  depthOrder?: number | null;
}

export interface WeekStat {
  playerId: string;
  week: number;
  opponent?: string | null;
  stats: Record<string, number>;
}

export interface Game {
  week: number;
  home: string;
  away: string;
  date: string;
  status?: string;
}

export interface NflState {
  season: string;
  week: number;
  display_week?: number;
  season_type: string;
  previous_season: string;
}

export interface SeasonBundle {
  state: NflState;
  players: Player[];
  history: Map<string, WeekStat[]>;
  projections: Map<string, Record<string, number>>;
  projectionHistory: Map<number, Map<string, Record<string, number>>>;
  schedule: Game[];
  source: "live";
  updatedAt: string;
}

export interface Factor {
  key: string;
  label: string;
  value: number;
  weight: number;
  impact: number;
}

export interface HealthAssessment {
  severity: number;
  label: string;
  risk: "Low" | "Moderate" | "High" | "Very high";
  expectedGamesMissed: number;
  returnFactor: number;
  rationale: string;
}

export interface PlayerMetric {
  key: string;
  label: string;
  value: number;
  unit?: string;
}

export interface Ranking {
  player: Player;
  overallRank: number;
  positionRank: number;
  projection: number;
  floor: number;
  ceiling: number;
  seasonPpg: number;
  last3Ppg: number;
  trend: "Rising" | "Steady" | "Fading" | "New";
  matchupGrade: string;
  opponent: string;
  kickoff: string;
  isBye: boolean;
  week: number;
  history: { week: number; points: number; positionRank?: number; opportunity: number; efficiency: number; snaps: number }[];
  factors: Factor[];
  metrics: PlayerMetric[];
  outlook: string[];
  injuryMultiplier: number;
  healthAssessment: HealthAssessment;
  adaptiveWeights: Record<string, number>;
}

export interface RankingsResponse {
  season: string;
  week: number;
  scoring: Scoring;
  source: "live";
  updatedAt: string;
  rankings: Ranking[];
  modelWeights: Record<Position, Record<string, number>>;
}

export interface PositionModelDiagnostic {
  position: Position;
  selectedModel: string;
  samples: number;
  mae: number;
  rmse: number;
  lastWeekMae: number;
  baselineMae: number;
  improvementPct: number;
  biasCorrection: number;
  variables: { key: string; label: string; weight: number; correlation: number }[];
  candidates: { name: string; mae: number; rmse: number }[];
}

export interface RosRanking extends Ranking {
  rosRank: number;
  rosPositionRank: number;
  rosProjection: number;
  rosPpg: number;
  gamesRemaining: number;
  expectedGamesActive: number;
  scheduleGrade: string;
  valueScore: number;
  matchups: RosMatchup[];
}

export interface RosMatchup {
  week: number;
  opponent: string | null;
  grade: "A" | "B" | "C" | "D" | null;
}

export interface RosRankingsResponse {
  season: string;
  week: number;
  scoring: Scoring;
  source: "live";
  updatedAt: string;
  rankings: RosRanking[];
}
