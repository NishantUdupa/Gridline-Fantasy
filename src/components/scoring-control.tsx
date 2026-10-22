"use client";

import type { Scoring } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function ScoringControl({ value, onChange }: { value: Scoring; onChange: (value: Scoring) => void }) {
  const options: [Scoring, string][] = [["ppr", "PPR"], ["half_ppr", "Half PPR"], ["std", "Standard"]];
  return (
    <div className="inline-flex rounded-md border bg-white p-1">
      {options.map(([key, label]) => (
        <Button key={key} size="sm" variant={value === key ? "default" : "ghost"} onClick={() => onChange(key)}
          className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider">{label}</Button>
      ))}
    </div>
  );
}
