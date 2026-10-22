import { NextRequest, NextResponse } from "next/server";
import { calculateRestOfSeasonRankings } from "@/lib/engine";
import { internalError, parseScoring, publicCacheHeaders } from "@/lib/api-utils";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const scoring = parseScoring(request.nextUrl.searchParams.get("scoring") || "ppr");
    if (!scoring) return NextResponse.json({ error: "Invalid scoring format." }, { status: 400 });
    return NextResponse.json(await calculateRestOfSeasonRankings(scoring), { headers: publicCacheHeaders() });
  } catch (error) {
    return internalError("rest-of-season", error);
  }
}
