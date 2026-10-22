import { NextResponse } from "next/server";
import type { Scoring } from "@/lib/types";

const SCORING = new Set<Scoring>(["ppr", "half_ppr", "std"]);

export function parseScoring(value: unknown): Scoring | null {
  return typeof value === "string" && SCORING.has(value as Scoring) ? value as Scoring : null;
}

export function parseWeek(value: string | null): number | undefined | null {
  if (!value) return undefined;
  const week = Number(value);
  return Number.isInteger(week) && week >= 1 && week <= 18 ? week : null;
}

export function publicCacheHeaders() {
  return { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" };
}

export function internalError(scope: string, error: unknown) {
  const requestId = crypto.randomUUID();
  console.error(`[${scope}] ${requestId}`, error);
  return NextResponse.json(
    { error: "Gridline data is temporarily unavailable.", requestId },
    { status: 500 },
  );
}

export function isStringArray(value: unknown, min: number, max: number): value is string[] {
  return Array.isArray(value)
    && value.length >= min
    && value.length <= max
    && value.every((item) => typeof item === "string" && item.length > 0 && item.length <= 64)
    && new Set(value).size === value.length;
}
