"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

type SearchPlayer = {
  id: string;
  name: string;
  team: string;
  position: string;
  injuryStatus?: string | null;
};

export function PlayerSearch() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPlayer[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [settledQuery, setSettledQuery] = useState("");

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      fetch(`/api/players/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then(async (response) => {
          const json = await response.json();
          if (!response.ok) throw new Error(json.error || "Search unavailable");
          return json as { players: SearchPlayer[] };
        })
        .then((json) => {
          if (controller.signal.aborted) return;
          setResults(json.players || []);
          setActive(0);
          setSettledQuery(trimmed);
          setLoading(false);
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted || (cause instanceof DOMException && cause.name === "AbortError")) return;
          setResults([]);
          setSettledQuery(trimmed);
          setError(cause instanceof Error ? cause.message : "Search unavailable");
          setLoading(false);
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function openPlayer(id: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/player/${id}`);
  }

  function updateQuery(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setError("");
      setSettledQuery("");
    }
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(results.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter" && results[active]) {
      event.preventDefault();
      openPlayer(results[active].id);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const trimmed = query.trim();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Search players"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-sm border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-white/80 transition hover:border-[#d7ff52]/60 hover:text-[#d7ff52]"
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline">Search</span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-white/10 bg-[#10241c] text-white shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 px-3">
            <Search className="size-4 shrink-0 text-white/40" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search players..."
              aria-label="Player name"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-white/35"
            />
            {loading && <Loader2 className="size-4 shrink-0 animate-spin text-white/40" />}
          </div>
          {trimmed.length < 2 && <p className="px-3 py-3 text-xs text-white/50">Type a player name to open their page.</p>}
          {error && <p className="px-3 py-3 text-xs text-amber-200">{error}</p>}
          {trimmed.length >= 2 && !loading && settledQuery === trimmed && !error && !results.length && (
            <p className="px-3 py-3 text-xs text-white/50">No player matches “{trimmed}”.</p>
          )}
          {!!results.length && (
            <ul>
              {results.map((player, index) => (
                <li key={player.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => openPlayer(player.id)}
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-left ${index === active ? "bg-white/10" : "hover:bg-white/10"}`}
                  >
                    <span>
                      <b className="text-sm">{player.name}</b>
                      <span className="ml-2 text-xs text-white/50">{player.team} · {player.position}</span>
                    </span>
                    {player.injuryStatus && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200">{player.injuryStatus}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
