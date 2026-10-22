import { NextRequest, NextResponse } from "next/server";
import { calculateRankings } from "@/lib/engine";
import { internalError, parseScoring, publicCacheHeaders } from "@/lib/api-utils";

export const maxDuration = 60;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const scoring = parseScoring(request.nextUrl.searchParams.get("scoring") || "ppr");
    if (!scoring) return NextResponse.json({ error: "Invalid scoring format." }, { status: 400 });
    const data = await calculateRankings(scoring, undefined, true);
    const player = data.rankings.find((ranking) => ranking.player.id === id);
    if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    return NextResponse.json(
      { ...player, season: data.season, scoring, source: data.source },
      { headers: publicCacheHeaders() },
    );
  } catch (error) {
    return internalError("player", error);
  }
}
