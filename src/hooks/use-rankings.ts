"use client";

import { useEffect, useState } from "react";
import type { RankingsResponse, RosRankingsResponse, Scoring } from "@/lib/types";

export function useRankings(scoring: Scoring = "ppr", includeByes = false) {
  const [data, setData] = useState<RankingsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetch(`/api/rankings?scoring=${scoring}&includeByes=${includeByes}`)
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error || "Rankings unavailable");
        return response.json();
      })
      .then((json) => active && setData(json))
      .catch((cause) => active && setError(cause.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [scoring, includeByes]);
  return { data, error, loading };
}

export function useRestOfSeasonRankings(scoring: Scoring = "ppr") {
  const [data, setData] = useState<RosRankingsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetch(`/api/rest-of-season?scoring=${scoring}`)
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error || "Rest-of-season rankings unavailable");
        return response.json();
      })
      .then((json) => active && setData(json))
      .catch((cause) => active && setError(cause.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [scoring]);
  return { data, error, loading };
}
