import { NextRequest, NextResponse } from "next/server";
import { calculateRankings } from "@/lib/engine";
import { internalError, parseScoring, parseWeek, publicCacheHeaders } from "@/lib/api-utils";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const scoring = parseScoring(request.nextUrl.searchParams.get("scoring") || "ppr");
    const week = parseWeek(request.nextUrl.searchParams.get("week"));
    if (!scoring || week === null) {
      return NextResponse.json({ error: "Invalid scoring format or week." }, { status: 400 });
    }
    const includeByes = request.nextUrl.searchParams.get("includeByes") === "true";
    const data = await calculateRankings(scoring, week, includeByes);
    return NextResponse.json(data, { headers: publicCacheHeaders() });
  } catch (error) {
    return internalError("rankings", error);
  }
}
