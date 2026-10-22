import type { HealthAssessment, Player } from "@/lib/types";

export function assessInjury(player: Player, remainingGames = 14): HealthAssessment {
  const status = player.injuryStatus?.toLowerCase() || "";
  const detail = `${player.injuryBodyPart || ""} ${player.injuryNotes || ""}`.toLowerCase();
  if (!status) {
    return { severity: 0, label: "Healthy", risk: "Low", expectedGamesMissed: 0, returnFactor: 1, rationale: "No active injury designation." };
  }

  const catastrophic = /acl|achilles|season[- ]ending|torn|surgery/.test(detail);
  const highRecurrence = /hamstring|groin|back|foot/.test(detail);
  const moderate = /ankle|knee|shoulder|calf|hip/.test(detail);
  const shortProtocol = /concussion|illness/.test(detail);

  if (catastrophic) {
    return {
      severity: 5, label: "Major injury", risk: "Very high",
      expectedGamesMissed: remainingGames, returnFactor: .25,
      rationale: "Notes indicate a major structural injury or surgery; current-season availability is heavily discounted.",
    };
  }
  if (status === "ir" || status.includes("reserve") || status === "pup") {
    return {
      severity: 4, label: "Extended absence", risk: "Very high",
      expectedGamesMissed: Math.min(remainingGames, 4), returnFactor: highRecurrence ? .72 : .8,
      rationale: "Reserve designation implies a multi-week absence, with a workload ramp expected after activation.",
    };
  }
  if (status === "out") {
    const missed = shortProtocol ? 1 : highRecurrence ? 2 : moderate ? 1.5 : 1;
    return {
      severity: 3, label: "Ruled out", risk: highRecurrence ? "High" : "Moderate",
      expectedGamesMissed: Math.min(remainingGames, missed), returnFactor: highRecurrence ? .8 : moderate ? .86 : .9,
      rationale: highRecurrence
        ? "The injury type carries elevated recurrence and workload-management risk after return."
        : "At least one missed game is expected; return production is conservatively ramped.",
    };
  }
  if (status === "doubtful") {
    return {
      severity: 2, label: "Doubtful", risk: "High", expectedGamesMissed: 1, returnFactor: highRecurrence ? .82 : .88,
      rationale: "A missed game is likely and the first game back receives an efficiency discount.",
    };
  }
  if (status === "questionable") {
    return {
      severity: 1, label: "Questionable", risk: highRecurrence ? "Moderate" : "Low",
      expectedGamesMissed: highRecurrence ? .5 : .25, returnFactor: highRecurrence ? .88 : .94,
      rationale: highRecurrence
        ? "Active status is plausible, but soft-tissue recurrence and snap limitations remain."
        : "Most expected production is retained with a modest availability discount.",
    };
  }
  if (status.includes("suspend")) {
    return {
      severity: 3, label: "Unavailable", risk: "High", expectedGamesMissed: Math.min(remainingGames, 2), returnFactor: .95,
      rationale: "Known unavailable games are removed; performance is preserved upon return.",
    };
  }
  return {
    severity: 1, label: player.injuryStatus || "Limited", risk: "Moderate",
    expectedGamesMissed: .5, returnFactor: .9,
    rationale: "An active designation creates moderate availability and workload uncertainty.",
  };
}
