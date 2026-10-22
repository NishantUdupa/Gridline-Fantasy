import type { RosMatchup } from "@/lib/types";

const gradeColor: Record<NonNullable<RosMatchup["grade"]>, string> = {
  A: "#1d6a49",
  B: "#6b8f2a",
  C: "#b7791f",
  D: "#a3412f",
};

const sizes = {
  sm: { grid: "grid-cols-9 gap-0.5", cell: "h-[21px] w-[22px] rounded-[3px]", grade: "text-[10px]", opponent: "text-[6.5px]", week: "" },
  md: { grid: "grid-cols-9 gap-[3px]", cell: "h-[31px] w-[27px] rounded-[4px]", grade: "text-[14px]", opponent: "text-[8px]", week: "" },
  lg: { grid: "grid-cols-9 gap-1.5 sm:grid-cols-[repeat(17,minmax(0,1fr))]", cell: "h-14 w-full min-w-9 rounded-md", grade: "text-lg", opponent: "text-[10px]", week: "text-[9px]" },
} as const;

export function MatchupCalendar({
  matchups,
  currentWeek,
  size = "sm",
  grow = false,
}: {
  matchups: RosMatchup[];
  currentWeek: number;
  size?: keyof typeof sizes;
  grow?: boolean;
}) {
  const s = sizes[size];
  return (
    <div
      className={`grid ${size === "lg" ? "w-full" : "w-max"} ${s.grid} ${grow ? "relative origin-left bg-white transition-transform duration-200 hover:z-20 hover:scale-[1.55] hover:rounded-[4px] hover:outline hover:outline-4 hover:outline-white" : ""}`}
    >
      {matchups.map((m) => {
        const past = m.week < currentWeek;
        const current = m.week === currentWeek;
        return (
          <div
            key={m.week}
            title={m.opponent ? `Week ${m.week} vs ${m.opponent}${m.grade ? ` · ${m.grade} matchup` : ""}` : `Week ${m.week} · bye`}
            className={`flex flex-col items-center justify-center leading-none ${s.cell} ${current ? "bg-white ring-1 ring-[#102c21]" : "bg-[#f1f4ee]"} ${past ? "opacity-40" : ""}`}
          >
            {s.week && <span className={`mb-1 font-bold uppercase tracking-wider text-[#8a938c] ${s.week}`}>W{m.week}</span>}
            {m.opponent ? (
              <>
                <span className={`font-heading font-bold ${s.grade}`} style={{ color: m.grade ? gradeColor[m.grade] : "#8a938c" }}>{m.grade || "–"}</span>
                <span className={`font-semibold tracking-tight text-[#8a938c] ${s.opponent}`}>{m.opponent}</span>
              </>
            ) : (
              <span className={`font-bold tracking-tight text-[#b3bab4] ${s.opponent}`}>BYE</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
