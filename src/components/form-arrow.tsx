import type { Position, Ranking } from "@/lib/types";
import { cn } from "@/lib/utils";

export const positionAccent: Record<Position, string> = {
  QB: "#3f5f9e",
  RB: "#2f6b45",
  WR: "#b7791f",
  TE: "#2c6e73",
  K: "#6e5a85",
  DEF: "#6b5d4f",
};

export function injuryTag(status?: string | null) {
  const key = status?.toLowerCase() || "";
  if (key === "questionable") return "Q";
  if (key === "doubtful") return "D";
  if (["out", "ir", "pup", "sus", "na"].includes(key)) return "O";
  return null;
}

const formArrow = {
  Rising: { points: [[1, 14], [14, 3], [27, 11], [40, 2]], tone: "text-emerald-600/80" },
  Steady: { points: [[1, 8], [40, 8]], tone: "text-slate-400" },
  Fading: { points: [[1, 2], [14, 13], [27, 5], [40, 14]], tone: "text-amber-600/80" },
  New: { points: [[1, 14], [14, 3], [27, 11], [40, 2]], tone: "text-sky-500/80" },
};

function arrowHead(points: number[][]) {
  const [x1, y1] = points.at(-2)!;
  const [x2, y2] = points.at(-1)!;
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  const back = 4.4;
  const spread = 2.2;
  const bx = x2 - ux * back;
  const by = y2 - uy * back;
  const px = -uy * spread;
  const py = ux * spread;
  const place = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;
  return `${place(bx + px, by + py)} ${place(x2, y2)} ${place(bx - px, by - py)}`;
}

export function FormArrow({ trend }: { trend: Ranking["trend"] }) {
  const arrow = formArrow[trend];
  return (
    <svg viewBox="0 0 44 16" className={cn("h-4 w-12 overflow-visible", arrow.tone)} role="img" aria-label={trend}>
      <polyline points={arrow.points.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={arrowHead(arrow.points)} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
