// CIRCUIT GUIDE: statistics for every track in championship history, worked
// out from Jolpica race results, plus a "track character" profile measured
// from real OpenF1 car data for tracks raced on since 2023.

import type { Circuit, QualifyingResult, Race, RaceResult, RaceSummary } from "@/api/jolpica";
import type { Trace } from "@/lib/telemetry";

export type CircuitSummary = {
  circuit: Circuit;
  races: number;
  first: number | null; // first season
  last: number | null; // latest season
  onCalendar: boolean; // part of this season
  round: number | null; // round number this season
};

export function summariseCircuits(circuits: Circuit[], races: RaceSummary[], season: string): CircuitSummary[] {
  return circuits.map((circuit) => {
    const here = races.filter((r) => r.circuitId === circuit.circuitId);
    const years = here.map((r) => Number(r.season));
    const thisSeason = here.find((r) => r.season === season);
    return {
      circuit,
      races: here.filter((r) => Date.parse(r.date) <= Date.now()).length,
      first: years.length ? Math.min(...years) : null,
      last: years.length ? Math.max(...years) : null,
      onCalendar: !!thisSeason,
      round: thisSeason ? Number(thisSeason.round) : null,
    };
  });
}

type Count = { name: string; count: number; extra?: string };

function top(names: string[], n = 5): Count[] {
  const map = new Map<string, number>();
  for (const x of names) map.set(x, (map.get(x) ?? 0) + 1);
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, n);
}

const fullName = (r: { Driver: { givenName: string; familyName: string } }) => `${r.Driver.givenName} ${r.Driver.familyName}`;

// "1:23.504" → 83.504 seconds
export function lapSeconds(time: string): number {
  const parts = time.split(":").map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
}

export function circuitStats(
  winners: (Race & { Results?: RaceResult[] })[],
  poles: (Race & { QualifyingResults?: QualifyingResult[] })[],
  fastest: (Race & { Results?: RaceResult[] })[],
) {
  const wins = winners.map((r) => r.Results?.[0]).filter(Boolean) as RaceResult[];
  const poleBySeason = new Map(poles.map((r) => [r.season, r.QualifyingResults?.[0]]));

  // How often the pole sitter wins (only seasons where both are known).
  const withPole = winners.filter((r) => poleBySeason.get(r.season) && r.Results?.[0]);
  const poleWins = withPole.filter((r) => poleBySeason.get(r.season)!.Driver.driverId === r.Results![0].Driver.driverId).length;

  // Starting position of winners (grid "0" = pit lane start, counted as last).
  const grids = wins.map((w) => Number(w.grid)).filter((g) => g > 0);
  const lowest = wins.reduce<RaceResult | null>((worst, w) => {
    const g = Number(w.grid) || 99;
    return !worst || g > (Number(worst.grid) || 99) ? w : worst;
  }, null);
  const lowestRace = lowest ? winners.find((r) => r.Results?.[0] === lowest) : null;

  // Fastest race lap in the data (lap times exist from 2004).
  let lapRecord: { time: string; name: string; season: string } | null = null;
  for (const r of fastest) {
    const res = r.Results?.[0];
    const time = res?.FastestLap?.Time?.time;
    if (!res || !time) continue;
    if (!lapRecord || lapSeconds(time) < lapSeconds(lapRecord.time)) lapRecord = { time, name: fullName(res), season: r.season };
  }

  return {
    topDrivers: top(wins.map(fullName)),
    topTeams: top(wins.map((w) => w.Constructor.name)),
    topPoles: top(poles.map((r) => r.QualifyingResults?.[0]).filter(Boolean).map((q) => fullName(q as QualifyingResult))),
    poleWinRate: withPole.length ? poleWins / withPole.length : null,
    poleSample: withPole.length,
    avgWinnerGrid: grids.length ? grids.reduce((a, b) => a + b, 0) / grids.length : null,
    lowestWin: lowest && lowestRace ? { name: fullName(lowest), grid: Number(lowest.grid), season: lowestRace.season } : null,
    lapRecord,
    recent: [...winners].reverse().slice(0, 10).map((r) => ({
      season: r.season,
      name: r.Results?.[0] ? fullName(r.Results[0]) : "–",
      team: r.Results?.[0]?.Constructor.name ?? "",
      fromPole: poleBySeason.get(r.season)?.Driver.driverId === r.Results?.[0]?.Driver.driverId,
    })),
  };
}

// Track character from one fast lap.
export function trackProfile(trace: Trace) {
  const n = trace.speed.length;
  const pct = (test: (i: number) => boolean) => {
    let k = 0;
    for (let i = 0; i < n; i++) if (test(i)) k++;
    return (k / n) * 100;
  };
  // Braking zones: separate stretches on the brakes, at least 150 m apart.
  let zones = 0, lastEnd = -Infinity, gearChanges = 0;
  for (let i = 1; i < n; i++) {
    if (trace.brake[i] > 0 && trace.brake[i - 1] === 0 && i * 5 - lastEnd > 150) zones++;
    if (trace.brake[i] === 0 && trace.brake[i - 1] > 0) lastEnd = i * 5;
    if (trace.gear[i] !== trace.gear[i - 1]) gearChanges++;
  }
  const fullThrottle = pct((i) => trace.throttle[i] >= 98);
  const slowest = Math.min(...trace.speed);
  return {
    lengthKm: trace.length / 1000,
    topSpeed: Math.max(...trace.speed),
    minSpeed: slowest,
    avgSpeed: (trace.length / trace.lapTime) * 3.6,
    fullThrottle,
    braking: pct((i) => trace.brake[i] > 0),
    zones,
    gearChanges,
    lapTime: trace.lapTime,
    // a simple label for the kind of track
    character: fullThrottle >= 70 ? "power" : fullThrottle <= 50 ? "downforce" : "balanced",
  } as const;
}

// Colour for a speed: slow corners red, fast straights white.
export function speedColor(v: number, min: number, max: number) {
  const steps = ["#FF3B3B", "#FF6A3D", "#FF9A3F", "#FFC24A", "#F5DFA0", "#F0EEE8"];
  const k = Math.min(steps.length - 1, Math.max(0, Math.floor(((v - min) / (max - min || 1)) * steps.length)));
  return steps[k];
}
