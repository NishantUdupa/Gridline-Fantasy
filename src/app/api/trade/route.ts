import { NextRequest, NextResponse } from "next/server";
import { calculateRestOfSeasonRankings } from "@/lib/engine";
import { evaluateTrade } from "@/lib/decision-tools";
import { internalError, isStringArray, parseScoring } from "@/lib/api-utils";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: { scoring?: unknown; sides?: unknown };
  try {
    body = await request.json() as { scoring?: unknown; sides?: unknown };
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  try {
    const scoring = parseScoring(body.scoring || "ppr");
    const sides = body.sides;
    if (!scoring || !Array.isArray(sides) || sides.length < 2 || sides.length > 3) {
      return NextResponse.json({ error: "Trades require two or three valid sides." }, { status: 400 });
    }
    const validSides = sides.every((side): side is { name: string; playerIds: string[] } => {
      if (!side || typeof side !== "object") return false;
      const candidate = side as { name?: unknown; playerIds?: unknown };
      return typeof candidate.name === "string"
        && candidate.name.length > 0
        && candidate.name.length <= 40
        && isStringArray(candidate.playerIds, 1, 12);
    });
    if (!validSides) return NextResponse.json({ error: "Each side needs one to twelve unique players." }, { status: 400 });
    const allIds = sides.flatMap((side) => side.playerIds);
    if (new Set(allIds).size !== allIds.length) {
      return NextResponse.json({ error: "A player may appear on only one side." }, { status: 400 });
    }
    const data = await calculateRestOfSeasonRankings(scoring);
    const knownIds = new Set(data.rankings.map((ranking) => ranking.player.id));
    if (allIds.some((id) => !knownIds.has(id))) {
      return NextResponse.json({ error: "One or more selected players are unavailable." }, { status: 422 });
    }
    return NextResponse.json(evaluateTrade(sides, data.rankings));
  } catch (error) {
    return internalError("trade", error);
  }
}
