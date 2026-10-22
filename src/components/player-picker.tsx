"use client";

import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import type { Ranking, RosRanking } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { HealthBadge } from "@/components/health-badge";

export function PlayerPicker({ rankings, selected, onAdd, placeholder = "Search player..." }: {
  rankings: (Ranking | RosRanking)[]; selected: string[]; onAdd: (id: string) => void; placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => query.trim().length < 2 ? [] : rankings
    .filter((r) => !selected.includes(r.player.id) && `${r.player.name} ${r.player.team}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6), [query, rankings, selected]);
  return (
    <div className="relative">
      <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} className="bg-white pl-9" />
      {!!results.length && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-xl">
          {results.map((r) => (
            <button key={r.player.id} onClick={() => { onAdd(r.player.id); setQuery(""); }}
              className="flex w-full items-center justify-between border-b px-3 py-2.5 text-left last:border-0 hover:bg-secondary">
              <span><b className="text-sm">{r.player.name}</b><span className="ml-2 text-xs text-muted-foreground">{r.player.team} · {r.player.position}{"rosPositionRank" in r ? r.rosPositionRank : r.positionRank}</span>{r.player.injuryStatus && <HealthBadge status={r.player.injuryStatus} className="ml-2" />}</span>
              <span className="flex items-center gap-1 font-mono text-xs font-bold">{"rosProjection" in r ? `${r.rosProjection} ROS` : r.projection} <Plus className="size-3" /></span>
            </button>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && !results.length && (
        <div className="absolute z-30 mt-1 w-full rounded-md border bg-white p-3 text-xs text-muted-foreground shadow-xl">
          No active fantasy player matches “{query}”.
        </div>
      )}
    </div>
  );
}
