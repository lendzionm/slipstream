// BACKTEST: how good would the model have been on races that already happened?
// For each past race the model only sees data from BEFORE that race, makes its
// prediction, and we compare it with the real result. We also compare it with a
// very simple rule ("the last race's result will repeat") so we know whether the
// model is actually adding something.
import { getRaceResults, Race, RaceResult } from "@/api/jolpica";
import { buildDriverInputs, getTwoSeasons } from "@/lib/predictionData";
import { predict } from "@/lib/predictionModel";
import { isRaceFinished } from "@/lib/sessions";

export type RaceCheck = {
  season: string;
  round: string;
  raceName: string;
  winnerId: string;
  names: Record<string, string>; // driverId -> code
  modelTop3: string[];
  baselineTop3: string[];
  actualTop3: string[];
  winnerProbability: number; // chance the model gave the real winner
  fieldSize: number;
};

export type Summary = {
  races: number;
  modelWinnerRate: number; // 0–1
  baselineWinnerRate: number;
  modelPodiumAvg: number; // 0–3
  baselinePodiumAvg: number;
  avgWinnerProbability: number; // 0–1
  randomGuess: number; // 1 / field size
};

const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x)).length;

export function summarise(checks: RaceCheck[]): Summary {
  const n = checks.length || 1;
  const sum = (f: (c: RaceCheck) => number) => checks.reduce((s, c) => s + f(c), 0);
  return {
    races: checks.length,
    modelWinnerRate: sum((c) => (c.modelTop3[0] === c.winnerId ? 1 : 0)) / n,
    baselineWinnerRate: sum((c) => (c.baselineTop3[0] === c.winnerId ? 1 : 0)) / n,
    modelPodiumAvg: sum((c) => overlap(c.modelTop3, c.actualTop3)) / n,
    baselinePodiumAvg: sum((c) => overlap(c.baselineTop3, c.actualTop3)) / n,
    avgWinnerProbability: sum((c) => c.winnerProbability) / n,
    randomGuess: sum((c) => 1 / Math.max(c.fieldSize, 1)) / n,
  };
}

const top3 = (results: RaceResult[]) =>
  ["1", "2", "3"].map((p) => results.find((r) => r.position === p)?.Driver.driverId ?? "");

export async function runBacktest(
  maxRaces: number,
  onProgress: (done: number, total: number) => void,
): Promise<RaceCheck[]> {
  const all = await getTwoSeasons(); // oldest first
  const now = Date.now();
  const finishedIdx = all.map((r, i) => (isRaceFinished(r, now) ? i : -1)).filter((i) => i >= 0);
  const targets = finishedIdx.slice(-maxRaces);
  const checks: RaceCheck[] = [];

  let failed = 0;
  for (let k = 0; k < targets.length; k++) {
    onProgress(k, targets.length);
    const index = targets[k];
    const race: Race = all[index];
    const past = all.slice(0, index).reverse(); // only races before this one

    let actual: RaceResult[];
    let inputs: Awaited<ReturnType<typeof buildDriverInputs>>;
    try {
      actual = (await getRaceResults(race.season, race.round))?.Results ?? [];
      inputs = await buildDriverInputs(race, past);
    } catch {
      failed++; // couldn't download this race: skip it, keep testing the others
      continue;
    }
    if (actual.length === 0) continue;
    const { drivers, lastResult } = inputs;
    if (drivers.length === 0) continue;

    const seed = Number(race.season) * 100 + Number(race.round);
    const prediction = predict(drivers, "race", seed);
    const winnerId = actual.find((r) => r.position === "1")?.Driver.driverId ?? "";

    const names: Record<string, string> = {};
    for (const r of [...actual, ...lastResult]) {
      names[r.Driver.driverId] = r.Driver.code ?? r.Driver.familyName.slice(0, 3).toUpperCase();
    }

    checks.push({
      season: race.season,
      round: race.round,
      raceName: race.raceName,
      winnerId,
      names,
      modelTop3: prediction.slice(0, 3).map((p) => p.driverId),
      baselineTop3: top3(lastResult),
      actualTop3: top3(actual),
      winnerProbability: prediction.find((p) => p.driverId === winnerId)?.p1 ?? 0,
      fieldSize: prediction.length,
    });
  }
  onProgress(targets.length, targets.length);
  if (checks.length === 0 && failed > 0) throw new Error("Could not download any race");
  return checks;
}
