// Calculations for the race results page: winner, pole, fastest lap,
// biggest climber and retirements. Plain functions = easy to test later.
import type { Driver, QualifyingResult, RaceResult } from "@/api/jolpica";

// A driver is "classified" if they got a number position (not "R" = retired, "D" = disqualified…).
export function isClassified(r: RaceResult): boolean {
  return /^\d+$/.test(r.positionText);
}

export function driverName(d: Driver): string {
  return `${d.givenName} ${d.familyName}`;
}

// How many places a driver gained (+) or lost (−) from the start. null = unknown.
export function positionChange(r: RaceResult): number | null {
  const grid = Number(r.grid);
  if (!isClassified(r) || !grid) return null; // grid 0 = pit-lane start
  return grid - Number(r.position);
}

// Time for P1 ("1:32:14.123"), gap for others ("+5.432"),
// "+1 lap" for lapped cars, else the status ("Retired", "Engine"…).
// leaderLaps = laps completed by the winner.
export function resultTime(r: RaceResult, leaderLaps?: number): string {
  const lapsDown = leaderLaps ? leaderLaps - Number(r.laps) : 0;
  if (isClassified(r) && lapsDown > 0) return `+${lapsDown} ${lapsDown === 1 ? "lap" : "laps"}`;
  return r.Time?.time ?? r.status;
}

export function bestQualiTime(q: QualifyingResult): string {
  return q.Q3 || q.Q2 || q.Q1 || "–";
}

export function raceStats(results: RaceResult[], quali: QualifyingResult[]) {
  const winner = results.find((r) => r.position === "1");
  const pole = quali.find((q) => q.position === "1");
  const fastest = results.find((r) => r.FastestLap?.rank === "1");

  let climber: { result: RaceResult; gained: number } | null = null;
  for (const r of results) {
    if (!isClassified(r)) continue;
    // Pit-lane starters (grid 0) count as starting last.
    const grid = Number(r.grid) || results.length;
    const gained = grid - Number(r.position);
    if (gained > 0 && (!climber || gained > climber.gained)) climber = { result: r, gained };
  }

  const retirements = results.filter((r) => !isClassified(r));
  return { winner, pole, fastest, climber, retirements };
}
