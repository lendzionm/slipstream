// TYRE DEGRADATION & PIT WINDOW: learns from a real race how fast each tyre
// compound wears, then searches every possible strategy for the quickest one.
//
// Steps:
//   1. Keep only "clean" laps: no lap 1, no pit in/out laps, no safety car,
//      nothing more than 7% slower than the driver's normal pace.
//   2. Fuel correction: a car gets about 0.06 s faster every lap because it
//      burns ~1.6 kg of fuel per lap. We add that back so only tyre wear is left.
//   3. For each compound, fit a straight line "lap time vs tyre age" inside
//      each stint (so fast and slow drivers can be mixed). Its slope is the
//      degradation in seconds per lap.
//   4. Pit loss = (in-lap + out-lap) − 2 × a normal lap, median over all stops.
//   5. Try every 1-stop and 2-stop strategy (rules: at least two different dry
//      compounds) and add up the predicted lap times. The lowest total wins.

import type { OF1Lap, OF1Stint } from "@/api/openf1";
import type { Neutral } from "@/lib/replay";
import { parseDate } from "@/lib/telemetry";

export const FUEL_EFFECT = 0.06; // seconds per lap
export const DRY = ["SOFT", "MEDIUM", "HARD"] as const;
export type Dry = (typeof DRY)[number];

export type CleanLap = { driver: number; lap: number; age: number; time: number; corrected: number; compound: string; stint: string };

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function lapIsNeutral(l: OF1Lap, neutral: Neutral[]) {
  if (!l.date_start || !l.lap_duration) return true;
  const from = parseDate(l.date_start);
  const to = from + l.lap_duration * 1000;
  return neutral.some((n) => n.from < to && n.to > from);
}

// Step 1–2
export function cleanLaps(laps: OF1Lap[], stints: OF1Stint[], neutral: Neutral[]): CleanLap[] {
  const out: CleanLap[] = [];
  const byDriver = new Map<number, OF1Lap[]>();
  for (const l of laps) byDriver.set(l.driver_number, [...(byDriver.get(l.driver_number) ?? []), l]);
  for (const [driver, list] of byDriver) {
    const times = list.filter((l) => l.lap_duration && l.lap_number > 1).map((l) => l.lap_duration as number);
    const normal = median(times);
    const myStints = stints.filter((s) => s.driver_number === driver);
    for (const l of list) {
      const s = myStints.find((x) => l.lap_number >= x.lap_start && l.lap_number <= x.lap_end);
      if (!s || !l.lap_duration || l.lap_number === 1 || l.is_pit_out_lap) continue;
      const isInLap = l.lap_number === s.lap_end && myStints.some((x) => x.lap_start === s.lap_end + 1);
      if (isInLap || l.lap_number === s.lap_start) continue;
      if (l.lap_duration > normal * 1.07 || lapIsNeutral(l, neutral)) continue;
      out.push({
        driver,
        lap: l.lap_number,
        age: s.tyre_age_at_start + (l.lap_number - s.lap_start),
        time: l.lap_duration,
        corrected: l.lap_duration + FUEL_EFFECT * (l.lap_number - 1),
        compound: s.compound,
        stint: `${driver}-${s.stint_number}`,
      });
    }
  }
  return out;
}

export type CompoundModel = {
  compound: Dry;
  slope: number; // seconds lost per lap of tyre age
  offset: number; // pace on a new tyre compared with the fastest compound (s)
  laps: number; // clean laps used
  stints: number;
  maxStint: number; // longest stint we trust: we never predict beyond the tyre ages seen in the race
};

// Step 3: within-stint regression, pooled over all stints of a compound.
export function fitCompounds(clean: CleanLap[]): CompoundModel[] {
  // Each driver's reference pace, so compound offsets compare like with like.
  const driverRef = new Map<number, number>();
  for (const d of new Set(clean.map((c) => c.driver))) driverRef.set(d, median(clean.filter((c) => c.driver === d).map((c) => c.corrected)));

  const models: (CompoundModel & { base: number })[] = [];
  for (const compound of DRY) {
    const rows = clean.filter((c) => c.compound === compound);
    const stints = new Map<string, CleanLap[]>();
    for (const r of rows) stints.set(r.stint, [...(stints.get(r.stint) ?? []), r]);
    let sxy = 0, sxx = 0, used = 0;
    const groups = [...stints.values()].filter((g) => g.length >= 4);
    for (const g of groups) {
      const mx = g.reduce((s, r) => s + r.age, 0) / g.length;
      const my = g.reduce((s, r) => s + r.corrected, 0) / g.length;
      for (const r of g) {
        sxy += (r.age - mx) * (r.corrected - my);
        sxx += (r.age - mx) ** 2;
      }
      used += g.length;
    }
    // Need enough evidence: at least 40 clean laps from 3 different stints.
    if (used < 40 || groups.length < 3 || sxx === 0) continue;
    const maxStint = Math.max(...groups.flatMap((g) => g.map((r) => r.age))) + 3;
    const slope = Math.max(0, sxy / sxx); // tyres don't get faster with age
    // Pace on a new tyre, relative to each driver's own reference pace.
    const base = median(groups.flatMap((g) => g.map((r) => r.corrected - slope * r.age - (driverRef.get(r.driver) as number))));
    models.push({ compound, slope, offset: 0, laps: used, stints: groups.length, maxStint, base });
  }
  const fastest = Math.min(...models.map((m) => m.base));
  return models.map(({ base, ...m }) => ({ ...m, offset: base - fastest }));
}

// Step 4
export function pitLoss(laps: OF1Lap[], stints: OF1Stint[], neutral: Neutral[]): number | null {
  const losses: number[] = [];
  for (const s of stints) {
    const next = stints.find((x) => x.driver_number === s.driver_number && x.lap_start === s.lap_end + 1);
    if (!next) continue;
    const mine = laps.filter((l) => l.driver_number === s.driver_number);
    const inLap = mine.find((l) => l.lap_number === s.lap_end);
    const outLap = mine.find((l) => l.lap_number === next.lap_start);
    if (!inLap?.lap_duration || !outLap?.lap_duration) continue;
    if (lapIsNeutral(inLap, neutral) || lapIsNeutral(outLap, neutral)) continue;
    const around = mine
      .filter((l) => Math.abs(l.lap_number - s.lap_end) <= 6 && l !== inLap && l !== outLap && l.lap_duration && !l.is_pit_out_lap)
      .map((l) => l.lap_duration as number);
    if (around.length < 4) continue;
    const loss = inLap.lap_duration + outLap.lap_duration - 2 * median(around);
    if (loss > 10 && loss < 60) losses.push(loss);
  }
  return losses.length ? median(losses) : null;
}

// Step 5
export type Plan = { stints: { compound: Dry; laps: number }[]; total: number; stopLaps: number[] };

// Time for one stint of n laps on new tyres (ages 1..n), relative to "perfect" pace.
// Infinity = longer than any stint seen in the race, so we refuse to guess.
const stintTime = (m: CompoundModel, n: number) =>
  n > m.maxStint ? Infinity : n * m.offset + (m.slope * n * (n + 1)) / 2;

export function bestPlans(models: CompoundModel[], raceLaps: number, loss: number) {
  const plans: Plan[] = [];
  const min = 5; // shortest sensible stint
  for (const a of models)
    for (const b of models) {
      if (a.compound !== b.compound) {
        for (let L = min; L <= raceLaps - min; L++) {
          plans.push({
            stints: [{ compound: a.compound, laps: L }, { compound: b.compound, laps: raceLaps - L }],
            total: stintTime(a, L) + stintTime(b, raceLaps - L) + loss,
            stopLaps: [L],
          });
        }
      }
      for (const c of models) {
        if (a.compound === b.compound && b.compound === c.compound) continue;
        for (let L1 = min; L1 <= raceLaps - 2 * min; L1++)
          for (let L2 = L1 + min; L2 <= raceLaps - min; L2++) {
            plans.push({
              stints: [
                { compound: a.compound, laps: L1 },
                { compound: b.compound, laps: L2 - L1 },
                { compound: c.compound, laps: raceLaps - L2 },
              ],
              total: stintTime(a, L1) + stintTime(b, L2 - L1) + stintTime(c, raceLaps - L2) + 2 * loss,
              stopLaps: [L1, L2],
            });
          }
      }
    }
  plans.sort((x, y) => x.total - y.total);
  const ok = (p: Plan) => Number.isFinite(p.total);
  const oneStop = plans.find((p) => ok(p) && p.stopLaps.length === 1) ?? null;
  const twoStop = plans.find((p) => ok(p) && p.stopLaps.length === 2) ?? null;

  // Pit window for the best one-stop: every stop lap and how much slower it is.
  let window: { lap: number; delta: number | null }[] = [];
  if (oneStop) {
    const [a, b] = oneStop.stints.map((s) => models.find((m) => m.compound === s.compound)!);
    window = [];
    for (let L = min; L <= raceLaps - min; L++) {
      const d = stintTime(a, L) + stintTime(b, raceLaps - L) + loss - oneStop.total;
      window.push({ lap: L, delta: Number.isFinite(d) ? d : null });
    }
  }
  return { oneStop, twoStop, window };
}

// What a driver actually did, for comparison.
export function actualStrategy(stints: OF1Stint[], driver: number) {
  return stints
    .filter((s) => s.driver_number === driver)
    .sort((a, b) => a.stint_number - b.stint_number)
    .map((s) => ({ compound: s.compound, laps: s.lap_end - s.lap_start + 1, from: s.lap_start }));
}

// Predicted time of any strategy (same scale as Plan.total), or null if the
// model can't judge it (wet tyres or a stint longer than anything seen).
export function strategyTime(models: CompoundModel[], stints: { compound: string; laps: number }[], loss: number): number | null {
  let total = (stints.length - 1) * loss;
  for (const s of stints) {
    const m = models.find((x) => x.compound === s.compound);
    if (!m) return null;
    total += stintTime(m, s.laps);
  }
  return Number.isFinite(total) ? total : null;
}

// Average fuel-corrected pace at each tyre age (for the chart), relative to
// each driver's normal pace so different cars can be shown together.
export function wearCurve(clean: CleanLap[], compound: string): { age: number; delta: number }[] {
  const driverRef = new Map<number, number>();
  for (const d of new Set(clean.map((c) => c.driver))) driverRef.set(d, median(clean.filter((c) => c.driver === d).map((c) => c.corrected)));
  const byAge = new Map<number, number[]>();
  for (const c of clean.filter((x) => x.compound === compound)) {
    byAge.set(c.age, [...(byAge.get(c.age) ?? []), c.corrected - (driverRef.get(c.driver) as number)]);
  }
  return [...byAge.entries()]
    .filter(([, v]) => v.length >= 3)
    .map(([age, v]) => ({ age, delta: median(v) }))
    .sort((a, b) => a.age - b.age);
}
