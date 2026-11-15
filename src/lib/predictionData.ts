// Collects the data the prediction model needs for a race:
// the 8 races before it (results + qualifying) and the last 3 visits to its track.
// About 19 small requests the first time, then everything comes from the cache.
// Used for the next race (Predictions tab) and for past races (the backtest).
import {
  getCircuitResults,
  getQualifying,
  getRaceResults,
  getSchedule,
  QualifyingResult,
  Race,
  RaceResult,
} from "@/api/jolpica";
import type { DriverInput } from "@/lib/predictionModel";
import { driverName, isClassified } from "@/lib/raceStats";
import { isRaceFinished } from "@/lib/sessions";

const RECENT_RACES = 8;
const TRACK_SEASONS = 3;

export type PredictionData = { race: Race; drivers: DriverInput[]; recentCount: number };

function finishOf(list: RaceResult[], driverId: string): (number | null)[] {
  const r = list.find((x) => x.Driver.driverId === driverId);
  if (!r) return [];
  return [isClassified(r) ? Number(r.position) : null];
}

// Builds the model input for `race` using only races from `pastNewestFirst`
// (all held before it, newest first). Also returns the most recent result,
// which the backtest uses as a simple comparison ("last race's order").
export async function buildDriverInputs(race: Race, pastNewestFirst: Race[]) {
  const recent: { results: RaceResult[]; quali: QualifyingResult[] }[] = [];
  for (const r of pastNewestFirst) {
    if (recent.length >= RECENT_RACES) break;
    const results = (await getRaceResults(r.season, r.round))?.Results ?? [];
    if (results.length === 0) continue; // results not published yet
    const quali = await getQualifying(r.season, r.round);
    recent.push({ results, quali });
  }

  const track: RaceResult[][] = [];
  for (let i = 1; i <= TRACK_SEASONS; i++) {
    const season = String(Number(race.season) - i);
    track.push(await getCircuitResults(season, race.Circuit.circuitId).catch(() => []));
  }

  // The current grid = drivers in the most recent race.
  const grid = recent[0]?.results ?? [];
  const drivers: DriverInput[] = grid.map((g) => {
    const id = g.Driver.driverId;
    return {
      driverId: id,
      name: driverName(g.Driver),
      code: g.Driver.code ?? g.Driver.familyName.slice(0, 3).toUpperCase(),
      team: g.Constructor.name,
      recentFinishes: recent.flatMap((rc) => finishOf(rc.results, id)),
      recentQuali: recent.flatMap((rc) => {
        const q = rc.quali.find((x) => x.Driver.driverId === id);
        return q ? [Number(q.position)] : [];
      }),
      trackFinishes: track.flatMap((list) => finishOf(list, id)),
      // Both cars of the driver's current team, race by race (newest first).
      teamFinishes: recent.flatMap((rc) =>
        rc.results
          .filter((r) => r.Constructor.constructorId === g.Constructor.constructorId)
          .map((r) => (isClassified(r) ? Number(r.position) : null)),
      ),
    };
  });

  return { drivers, recentCount: recent.length, lastResult: grid };
}

// Races of this season and last season, oldest first.
export async function getTwoSeasons(): Promise<Race[]> {
  const current = await getSchedule("current");
  const season = current[0]?.season ?? String(new Date().getFullYear());
  const previous = await getSchedule(String(Number(season) - 1)).catch(() => [] as Race[]);
  return [...previous, ...current];
}

export async function loadPredictionData(): Promise<PredictionData | null> {
  const all = await getTwoSeasons();
  const now = Date.now();
  const index = all.findIndex((r) => !isRaceFinished(r, now));
  if (index === -1) return null; // season over
  const race = all[index];
  const past = all.slice(0, index).reverse();
  const { drivers, recentCount } = await buildDriverInputs(race, past);
  return { race, drivers, recentCount };
}
