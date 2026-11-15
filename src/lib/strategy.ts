// "Which strategy worked best?" analysis.
// Groups finishers by number of pit stops and compares how many places
// each group gained from the start. Plain functions, easy to test.
import type { PitStop, RaceResult } from "@/api/jolpica";
import { isClassified, positionChange } from "@/lib/raceStats";

export type DriverStrategy = {
  result: RaceResult;
  stopLaps: number[]; // laps on which the driver pitted
  gained: number | null; // places gained from the start
};

export type StrategyGroup = {
  stops: number;
  drivers: DriverStrategy[];
  avgGained: number | null;
  bestFinish: number;
};

// "22.512" or "1:02.512" -> seconds
export function parseDuration(text: string): number | null {
  const parts = text.split(":");
  const seconds = parts.length === 2 ? Number(parts[0]) * 60 + Number(parts[1]) : Number(parts[0]);
  return Number.isFinite(seconds) ? seconds : null;
}

export function analyseStrategy(results: RaceResult[], pitStops: PitStop[]) {
  const lapsByDriver = new Map<string, number[]>();
  for (const p of pitStops) {
    const list = lapsByDriver.get(p.driverId) ?? [];
    list.push(Number(p.lap));
    lapsByDriver.set(p.driverId, list);
  }

  const drivers: DriverStrategy[] = results.map((r) => ({
    result: r,
    stopLaps: (lapsByDriver.get(r.Driver.driverId) ?? []).sort((a, b) => a - b),
    gained: positionChange(r),
  }));

  // Only finishers: a driver who retired early never completed their strategy.
  const finishers = drivers.filter((d) => isClassified(d.result));
  const groupMap = new Map<number, DriverStrategy[]>();
  for (const d of finishers) {
    const list = groupMap.get(d.stopLaps.length) ?? [];
    list.push(d);
    groupMap.set(d.stopLaps.length, list);
  }

  const groups: StrategyGroup[] = [...groupMap.entries()]
    .map(([stops, list]) => {
      const known = list.map((d) => d.gained).filter((g): g is number => g !== null);
      return {
        stops,
        drivers: list,
        avgGained: known.length ? known.reduce((a, b) => a + b, 0) / known.length : null,
        bestFinish: Math.min(...list.map((d) => Number(d.result.position))),
      };
    })
    .sort((a, b) => a.stops - b.stops);

  // Best strategy = highest average places gained, among groups with at least 2 drivers.
  const comparable = groups.filter((g) => g.drivers.length >= 2 && g.avgGained !== null);
  const best =
    comparable.length >= 2
      ? comparable.reduce((a, b) => ((b.avgGained as number) > (a.avgGained as number) ? b : a))
      : null;

  let fastest: { stop: PitStop; seconds: number } | null = null;
  for (const p of pitStops) {
    const seconds = parseDuration(p.duration);
    if (seconds !== null && (!fastest || seconds < fastest.seconds)) fastest = { stop: p, seconds };
  }

  const winner = drivers.find((d) => d.result.position === "1") ?? null;
  const totalLaps = Number(winner?.result.laps ?? 0);

  return { drivers, finishers, groups, best, fastest, winner, totalLaps };
}

// Splits a race into stints: [0, stop laps..., total laps] -> lengths
export function stintLengths(stopLaps: number[], totalLaps: number): number[] {
  const marks = [0, ...stopLaps, totalLaps];
  const lengths: number[] = [];
  for (let i = 1; i < marks.length; i++) lengths.push(Math.max(0, marks[i] - marks[i - 1]));
  return lengths.filter((l) => l > 0);
}
