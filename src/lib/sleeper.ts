import { unstable_cache } from "next/cache";
import type { Game, NflState, Player, Position, SeasonBundle, WeekStat } from "@/lib/types";

export interface TrainingWeekStat extends WeekStat {
  team: string;
  position: Position;
}

/** Prior-season observations used only to train projections. Never rendered. */
export interface TrainingSeason {
  season: string;
  schedule: Game[];
  rows: Map<string, TrainingWeekStat[]>;
  projections: Map<number, Map<string, Record<string, number>>>;
}

const API = "https://api.sleeper.com";
const APP_API = "https://api.sleeper.app/v1";
const POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

type SleeperRow = {
  player_id: string;
  team?: string | null;
  opponent?: string;
  stats?: Record<string, number>;
  player?: Record<string, unknown>;
};

type CachePolicy = {
  revalidate: number;
  tags: string[];
};

const LIVE_POLICY = { revalidate: 900, tags: ["sleeper-live"] };
const COMPLETED_WEEK_POLICY = { revalidate: 21600, tags: ["sleeper-live"] };
const SCHEDULE_POLICY = { revalidate: 86400, tags: ["sleeper-live"] };
const TRAINING_POLICY = { revalidate: 2592000, tags: ["sleeper-training"] };

async function getJson<T>(url: string, policy: CachePolicy = LIVE_POLICY): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    cache: "force-cache",
    next: policy,
  });
  if (!response.ok) throw new Error(`Sleeper ${response.status}: ${url}`);
  return response.json() as Promise<T>;
}

async function getUncachedJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Sleeper ${response.status}: ${url}`);
  return response.json() as Promise<T>;
}

function normalizePlayers(raw: Record<string, Record<string, unknown>>): Player[] {
  return Object.entries(raw).flatMap(([id, p]) => {
    const position = String(p.position || "");
    if (!POSITIONS.has(position) || p.active === false || !p.team) return [];
    const team = String(p.team || "");
    const name = position === "DEF"
      ? `${team} D/ST`
      : String(p.full_name || `${p.first_name || ""} ${p.last_name || ""}`).trim();
    return [{
      id,
      name,
      firstName: String(p.first_name || ""),
      lastName: String(p.last_name || ""),
      position: position as Position,
      team,
      active: p.active !== false,
      injuryStatus: p.injury_status as string | null,
      injuryNotes: p.injury_notes as string | null,
      injuryBodyPart: p.injury_body_part as string | null,
      injuryStartDate: p.injury_start_date as string | null,
      depthOrder: typeof p.depth_chart_order === "number" ? p.depth_chart_order : null,
    }];
  });
}

async function fetchLiveBundle(): Promise<SeasonBundle> {
  const state = await getJson<NflState>(`${APP_API}/state/nfl`, {
    revalidate: 300,
    tags: ["sleeper-live", "sleeper-state"],
  });
  const season = state.season;
  const targetWeek = Math.max(1, state.display_week || state.week);
  const completed = Array.from({ length: Math.max(0, targetWeek - 1) }, (_, i) => i + 1);
  const [players, schedule, projections] = await Promise.all([
    getCachedPlayers(),
    getJson<Game[]>(`${API}/schedule/nfl/regular/${season}`, SCHEDULE_POLICY),
    getCurrentProjections(season, targetWeek),
  ]);
  const weekly = await mapLimited(completed, 4, async (week) => {
      const [rows, projectionRows] = await Promise.all([
        getCompletedStats(season, week),
        getCompletedProjections(season, week),
      ]);
      return { week, rows, projectionRows };
  });
  const history = new Map<string, WeekStat[]>();
  const projectionHistory = new Map<number, Map<string, Record<string, number>>>();
  for (const { week, rows, projectionRows } of weekly) {
    for (const row of rows) {
      if (!row.player_id || !row.stats) continue;
      const list = history.get(row.player_id) || [];
      list.push({ playerId: row.player_id, week, opponent: row.opponent, stats: row.stats });
      history.set(row.player_id, list);
    }
    const weekProjections = new Map<string, Record<string, number>>();
    for (const row of projectionRows) {
      if (row.player_id && row.stats) weekProjections.set(row.player_id, row.stats);
    }
    projectionHistory.set(week, weekProjections);
  }
  const projectionMap = new Map<string, Record<string, number>>();
  for (const row of projections as SleeperRow[]) {
    if (row.player_id && row.stats) projectionMap.set(row.player_id, row.stats);
  }
  return {
    state, players, history, projections: projectionMap, projectionHistory, schedule,
    source: "live", updatedAt: new Date().toISOString(),
  };
}

const TRAINING_STAT_KEYS = ["pts_ppr", "pts_half_ppr", "pts_std", "pass_yd", "pass_td", "pass_int", "pass_att", "pass_cmp", "pass_ypa", "pass_air_yd", "pass_sack", "pass_rz_att", "pass_fd", "rush_yd", "rush_td", "rush_att", "rush_yac", "rush_ypa", "rush_rz_att", "rush_fd", "rec_yd", "rec_td", "rec", "rec_tgt", "rec_air_yd", "rec_yar", "rec_ypt", "rec_fd", "rec_rz_tgt", "rec_0_4", "rec_5_9", "rec_10_19", "rec_20_29", "rec_30_39", "rec_40p", "fum_lost", "fga", "fgm", "fgm_20_29", "fgm_30_39", "fgm_40_49", "fgm_50p", "xpa", "xpm", "sack", "int", "fum_rec", "ff", "blk_kick", "qb_hit", "tkl_loss", "def_pass_def", "off_snp", "def_snp", "st_snp", "tm_off_snp", "gs", "gp", "h1_pass_yd", "h1_rush_yd", "h1_rec_yd", "pts_allow", "yds_allow", "fan_pts_allow", "fan_pts_allow_qb", "fan_pts_allow_rb", "fan_pts_allow_wr", "fan_pts_allow_te", "fan_pts_allow_k"];

function slimStats(stats: Record<string, number>) {
  const output: Record<string, number> = {};
  for (const key of TRAINING_STAT_KEYS) if (typeof stats[key] === "number") output[key] = stats[key];
  return output;
}

function slimProjection(stats: Record<string, number>) {
  return Object.fromEntries(
    ["pts_ppr", "pts_half_ppr", "pts_std"]
      .filter((key) => typeof stats[key] === "number")
      .map((key) => [key, stats[key]]),
  );
}

function normalizeRows(rows: SleeperRow[], projectionOnly = false): SleeperRow[] {
  return rows.flatMap((row) => {
    if (!row.player_id || !row.stats) return [];
    const position = rowPosition(row);
    const team = String(row.team || row.player?.team || "");
    return [{
      player_id: row.player_id,
      team: team || null,
      opponent: row.opponent,
      stats: projectionOnly ? slimProjection(row.stats) : slimStats(row.stats),
      player: position ? { position, team } : undefined,
    }];
  });
}

const getCachedPlayers = unstable_cache(
  async () => normalizePlayers(await getUncachedJson<Record<string, Record<string, unknown>>>(`${APP_API}/players/nfl`)),
  ["sleeper-players-normalized-v1"],
  { revalidate: 900, tags: ["sleeper-live"] },
);

const getCurrentProjections = unstable_cache(
  async (season: string, week: number) => normalizeRows(
    await getUncachedJson<SleeperRow[]>(`${API}/projections/nfl/${season}/${week}?season_type=regular`),
    true,
  ),
  ["sleeper-current-projections-normalized-v1"],
  { revalidate: LIVE_POLICY.revalidate, tags: ["sleeper-live"] },
);

const getCompletedStats = unstable_cache(
  async (season: string, week: number) => normalizeRows(
    await getUncachedJson<SleeperRow[]>(`${API}/stats/nfl/${season}/${week}?season_type=regular`),
  ),
  ["sleeper-completed-stats-normalized-v1"],
  { revalidate: COMPLETED_WEEK_POLICY.revalidate, tags: ["sleeper-live"] },
);

const getCompletedProjections = unstable_cache(
  async (season: string, week: number) => normalizeRows(
    await getUncachedJson<SleeperRow[]>(`${API}/projections/nfl/${season}/${week}?season_type=regular`),
    true,
  ),
  ["sleeper-completed-projections-normalized-v1"],
  { revalidate: COMPLETED_WEEK_POLICY.revalidate, tags: ["sleeper-live"] },
);

const getTrainingStats = unstable_cache(
  async (season: string, week: number) => normalizeRows(
    await getUncachedJson<SleeperRow[]>(`${API}/stats/nfl/${season}/${week}?season_type=regular`),
  ),
  ["sleeper-training-stats-normalized-v1"],
  { revalidate: TRAINING_POLICY.revalidate, tags: ["sleeper-training"] },
);

const getTrainingProjections = unstable_cache(
  async (season: string, week: number) => normalizeRows(
    await getUncachedJson<SleeperRow[]>(`${API}/projections/nfl/${season}/${week}?season_type=regular`),
    true,
  ),
  ["sleeper-training-projections-normalized-v1"],
  { revalidate: TRAINING_POLICY.revalidate, tags: ["sleeper-training"] },
);

function rowPosition(row: SleeperRow): Position | null {
  const raw = row.player?.position || (Array.isArray(row.player?.fantasy_positions) ? row.player.fantasy_positions[0] : "");
  const position = String(raw || "");
  return POSITIONS.has(position) ? position as Position : null;
}

async function mapLimited<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const output = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await task(items[index]);
    }
  }));
  return output;
}

async function fetchTrainingSeason(season: string): Promise<TrainingSeason> {
  const schedule = await getJson<Game[]>(`${API}/schedule/nfl/regular/${season}`, TRAINING_POLICY);
  const weeks = await mapLimited(Array.from({ length: 18 }, (_, index) => index + 1), 4, async (week) => {
    try {
      const [stats, projections] = await Promise.all([
        getTrainingStats(season, week),
        getTrainingProjections(season, week),
      ]);
      return { week, stats, projections };
    } catch (error) {
      console.error(`Skipping ${season} week ${week} training data:`, error);
      return { week, stats: [] as SleeperRow[], projections: [] as SleeperRow[] };
    }
  });
  const rows = new Map<string, TrainingWeekStat[]>();
  const projectionHistory = new Map<number, Map<string, Record<string, number>>>();
  for (const week of weeks) {
    for (const row of week.stats) {
      const position = rowPosition(row);
      const team = String(row.team || row.player?.team || "");
      if (!row.player_id || !row.stats || !position || !team) continue;
      const list = rows.get(row.player_id) || [];
      list.push({ playerId: row.player_id, week: week.week, opponent: row.opponent, team, position, stats: slimStats(row.stats) });
      rows.set(row.player_id, list);
    }
    const weekProjections = new Map<string, Record<string, number>>();
    for (const row of week.projections) {
      if (row.player_id && row.stats) weekProjections.set(row.player_id, slimStats(row.stats));
    }
    if (weekProjections.size) projectionHistory.set(week.week, weekProjections);
  }
  return { season, schedule, rows, projections: projectionHistory };
}

let memoryCache: { bundle: SeasonBundle; expiresAt: number } | null = null;
let bundlePromise: Promise<SeasonBundle> | null = null;
const trainingCache = new Map<string, { season: TrainingSeason | null; expiresAt: number }>();
const trainingPromises = new Map<string, Promise<TrainingSeason | null>>();

export async function getPriorSeasonTraining(requestedSeason?: string): Promise<TrainingSeason | null> {
  const season = requestedSeason || (await getSeasonBundle()).state.previous_season;
  const cached = trainingCache.get(season);
  if (cached && cached.expiresAt > Date.now()) return cached.season;
  const pending = trainingPromises.get(season);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const training = await fetchTrainingSeason(season);
      if (training.rows.size < 100 || training.projections.size < 8) {
        throw new Error(`Incomplete ${season} training season`);
      }
      trainingCache.set(season, { season: training, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
      return training;
    } catch (error) {
      console.error(`${season} training season unavailable; using current season only:`, error);
      trainingCache.set(season, { season: null, expiresAt: Date.now() + 10 * 60 * 1000 });
      return null;
    } finally {
      trainingPromises.delete(season);
    }
  })();
  trainingPromises.set(season, promise);
  return promise;
}

export async function getSeasonBundle(): Promise<SeasonBundle> {
  if (memoryCache && memoryCache.expiresAt > Date.now()) return memoryCache.bundle;
  if (bundlePromise) return bundlePromise;
  bundlePromise = (async () => {
    const bundle = await fetchLiveBundle();
    const usable = bundle.players.filter((p) =>
      bundle.projections.has(p.id) || bundle.history.has(p.id) || Boolean(p.injuryStatus),
    );
    if (usable.length < 20) throw new Error("Sleeper returned incomplete rankings data");
    bundle.players = usable;
    memoryCache = { bundle, expiresAt: Date.now() + 15 * 60 * 1000 };
    return bundle;
  })();
  try {
    return await bundlePromise;
  } finally {
    bundlePromise = null;
  }
}

export function clearSleeperMemoryCaches() {
  memoryCache = null;
  trainingCache.clear();
}
