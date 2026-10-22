import { NextRequest, NextResponse } from "next/server";
import { calculateRankings } from "@/lib/engine";
import { compareStartSit } from "@/lib/decision-tools";
import { internalError, isStringArray, parseScoring } from "@/lib/api-utils";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: { scoring?: unknown; playerIds?: unknown };
  try {
    body = await request.json() as { scoring?: unknown; playerIds?: unknown };
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  try {
    const scoring = parseScoring(body.scoring || "ppr");
    if (!scoring || !isStringArray(body.playerIds, 2, 4)) {
      return NextResponse.json({ error: "Choose two to four unique players and a valid scoring format." }, { status: 400 });
    }
    const data = await calculateRankings(scoring);
    const knownIds = new Set(data.rankings.map((ranking) => ranking.player.id));
    if (body.playerIds.some((id) => !knownIds.has(id))) {
      return NextResponse.json({ error: "One or more selected players are unavailable." }, { status: 422 });
    }
    return NextResponse.json(compareStartSit(body.playerIds, data.rankings));
  } catch (error) {
    return internalError("start-sit", error);
  }
}
