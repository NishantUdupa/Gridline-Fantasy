import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { clearSleeperMemoryCaches, getSeasonBundle } from "@/lib/sleeper";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidateTag("sleeper-live", { expire: 0 });
  clearSleeperMemoryCaches();
  const bundle = await getSeasonBundle();

  return Response.json({
    refreshed: true,
    season: bundle.state.season,
    week: bundle.state.display_week || bundle.state.week,
    updatedAt: bundle.updatedAt,
  });
}
