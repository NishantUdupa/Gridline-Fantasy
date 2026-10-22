import { NextRequest, NextResponse } from "next/server";
import { getSeasonBundle } from "@/lib/sleeper";
import { internalError, publicCacheHeaders } from "@/lib/api-utils";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const query = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    if (query.length < 2) return NextResponse.json({ players: [] });

    const bundle = await getSeasonBundle();
    const players = bundle.players
      .filter((player) => `${player.name} ${player.firstName} ${player.lastName} ${player.team} ${player.position}`.toLowerCase().includes(query))
      .sort((a, b) => score(b, query) - score(a, query) || a.name.localeCompare(b.name))
      .slice(0, 8)
      .map((player) => ({
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        injuryStatus: player.injuryStatus ?? null,
      }));

    return NextResponse.json({ players }, { headers: publicCacheHeaders() });
  } catch (error) {
    return internalError("player-search", error);
  }
}

function score(player: { name: string; lastName: string; team: string }, query: string) {
  const name = player.name.toLowerCase();
  const last = player.lastName.toLowerCase();
  if (name === query) return 4;
  if (name.startsWith(query) || last.startsWith(query)) return 3;
  if (name.includes(query) || last.includes(query)) return 2;
  if (player.team.toLowerCase().startsWith(query)) return 1;
  return 0;
}
