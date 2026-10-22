/** NFL primary (`team_color`) and secondary (`team_color2`) from nflverse. */
const teamColors: Record<string, { primary: string; secondary: string }> = {
  ARI: { primary: "#97233F", secondary: "#000000" },
  ATL: { primary: "#A71930", secondary: "#000000" },
  BAL: { primary: "#241773", secondary: "#9E7C0C" },
  BUF: { primary: "#00338D", secondary: "#C60C30" },
  CAR: { primary: "#0085CA", secondary: "#000000" },
  CHI: { primary: "#0B162A", secondary: "#E64100" },
  CIN: { primary: "#FB4F14", secondary: "#000000" },
  CLE: { primary: "#FF3C00", secondary: "#311D00" },
  DAL: { primary: "#002244", secondary: "#B0B7BC" },
  DEN: { primary: "#002244", secondary: "#FB4F14" },
  DET: { primary: "#0076B6", secondary: "#B0B7BC" },
  GB: { primary: "#203731", secondary: "#FFB612" },
  HOU: { primary: "#03202F", secondary: "#A71930" },
  IND: { primary: "#002C5F", secondary: "#A5ACAF" },
  JAX: { primary: "#006778", secondary: "#000000" },
  KC: { primary: "#E31837", secondary: "#FFB612" },
  LA: { primary: "#003594", secondary: "#FFD100" },
  LAC: { primary: "#007BC7", secondary: "#FFC20E" },
  LAR: { primary: "#003594", secondary: "#FFD100" },
  LV: { primary: "#000000", secondary: "#A5ACAF" },
  MIA: { primary: "#008E97", secondary: "#F58220" },
  MIN: { primary: "#4F2683", secondary: "#FFC62F" },
  NE: { primary: "#002244", secondary: "#C60C30" },
  NO: { primary: "#D3BC8D", secondary: "#000000" },
  NYG: { primary: "#0B2265", secondary: "#A71930" },
  NYJ: { primary: "#003F2D", secondary: "#FFFFFF" },
  PHI: { primary: "#004C54", secondary: "#A5ACAF" },
  PIT: { primary: "#000000", secondary: "#FFB612" },
  SEA: { primary: "#002244", secondary: "#69BE28" },
  SF: { primary: "#AA0000", secondary: "#B3995D" },
  TB: { primary: "#A71930", secondary: "#322F2B" },
  TEN: { primary: "#4495D2", secondary: "#D50A0A" },
  WAS: { primary: "#5A1414", secondary: "#FFB612" },
};

const fallback = { primary: "#e6ece2", secondary: "#102c21" };

export function teamColorsFor(team: string) {
  return teamColors[team] ?? fallback;
}
