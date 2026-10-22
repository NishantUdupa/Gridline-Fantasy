import { teamColorsFor } from "@/lib/team-colors";

export function TeamMark({ team }: { team: string }) {
  const { primary } = teamColorsFor(team);
  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e6ece2] font-heading text-[13px] font-bold italic leading-none tracking-tight"
      style={{ color: primary, fontSize: team.length >= 3 ? "13px" : "15px" }}
    >
      {team}
    </span>
  );
}
