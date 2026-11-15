// SLIPSTREAM PREDICTION MODEL v2
//
// Step 1. Give every driver an "expected position" from four factors:
//   - form:  average finishing position in the last 8 races (newer races count more)
//   - quali: average qualifying position in the last 8 races
//   - team:  average finishing position of BOTH team cars (how good the car is)
//   - track: average finishing position at this circuit in the last 3 seasons
//   Race prediction uses 45% form + 30% quali + 15% team + 10% track.
//
//   v2 weights were tuned on 29 races (2025 round 6 – 2026 round 10) and checked
//   on 10 races the tuning never saw (2026 rounds 11–20). Compared with v1 they
//   raised the average chance given to the real winner from 15.6% to 19.4% and
//   podium drivers correct from 1.51 to 1.69 (out of 3) over all 39 races.
//   Track history turned out to matter little in 2026 (new rules = new cars).
//   Qualifying weights were not tuned (no qualifying backtest yet).
//
// Step 2. Simulate the session thousands of times. In each simulation drivers
//   are drawn into positions one by one; a driver with a better expected
//   position has a bigger chance of being drawn earlier (Plackett–Luce model).
//   Counting the outcomes gives win / podium / top-10 probabilities.
//
// Everything here is plain TypeScript with no app code, so it is easy to test.

export type Mode = "race" | "quali";
export type FactorKey = "form" | "quali" | "team" | "track";

export type DriverInput = {
  driverId: string;
  name: string;
  code: string;
  team: string;
  recentFinishes: (number | null)[]; // newest first; null = did not finish
  recentQuali: number[]; // newest first
  trackFinishes: (number | null)[]; // newest first, at this circuit
  teamFinishes: (number | null)[]; // both team cars, newest race first
};

export type Factor = { key: FactorKey; avg: number | null; count: number; weight: number };

export type DriverPrediction = {
  driverId: string;
  name: string;
  code: string;
  team: string;
  expected: number; // expected position (lower = better)
  p1: number; // probability 0–1 of winning (or pole)
  top3: number;
  top10: number;
  factors: Factor[];
  strongest: FactorKey; // the factor that helps this driver most
};

const DNF_POSITION = 18; // a retirement counts like finishing P18
const NO_DATA_POSITION = 14; // new driver with no results yet
const RECENCY = 0.8; // each older race counts 80% of the next newer one
// Higher = more random races, lower = favourites win more. 2.0 came out best in the backtest.
const TEMPERATURE = 2.0;
const SIMULATIONS = 4000;

const WEIGHTS: Record<Mode, Record<FactorKey, number>> = {
  race: { form: 0.45, quali: 0.3, team: 0.15, track: 0.1 },
  quali: { quali: 0.55, form: 0.25, team: 0.15, track: 0.05 },
};

export function recencyAverage(positions: (number | null)[]): number | null {
  if (positions.length === 0) return null;
  let sum = 0;
  let weightSum = 0;
  positions.forEach((p, i) => {
    const w = Math.pow(RECENCY, i);
    sum += (p ?? DNF_POSITION) * w;
    weightSum += w;
  });
  return sum / weightSum;
}

// Small random number generator with a fixed seed, so the same race
// always gives the same percentages (results don't jump on every refresh).
function seededRandom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function predict(drivers: DriverInput[], mode: Mode, seed = 1): DriverPrediction[] {
  const w = WEIGHTS[mode];

  // Step 1: expected position per driver
  const scored = drivers.map((d) => {
    const form = recencyAverage(d.recentFinishes);
    const quali = recencyAverage(d.recentQuali);
    const track = recencyAverage(d.trackFinishes);
    const team = recencyAverage(d.teamFinishes);
    const formValue = form ?? NO_DATA_POSITION;
    const qualiValue = quali ?? formValue;
    const trackValue = track ?? formValue; // no track history = neutral
    const teamValue = team ?? formValue;
    const expected =
      w.form * formValue + w.quali * qualiValue + w.team * teamValue + w.track * trackValue;

    const factors: Factor[] = [
      { key: "form", avg: form, count: d.recentFinishes.length, weight: w.form },
      { key: "quali", avg: quali, count: d.recentQuali.length, weight: w.quali },
      { key: "team", avg: team, count: d.teamFinishes.length, weight: w.team },
      { key: "track", avg: track, count: d.trackFinishes.length, weight: w.track },
    ];
    const known = factors.filter((f) => f.avg !== null);
    const strongest = known.length
      ? known.reduce((best, f) => ((f.avg as number) < (best.avg as number) ? f : best)).key
      : "form";
    return { d, expected, factors, strongest };
  });

  // Step 2: simulate
  const n = scored.length;
  const strength = scored.map((s) => Math.exp(-s.expected / TEMPERATURE));
  const wins = new Array(n).fill(0);
  const podiums = new Array(n).fill(0);
  const top10s = new Array(n).fill(0);
  const random = seededRandom(seed);

  for (let sim = 0; sim < SIMULATIONS; sim++) {
    const remaining = scored.map((_, i) => i);
    let total = strength.reduce((a, b) => a + b, 0);
    for (let place = 0; place < Math.min(10, n); place++) {
      let r = random() * total;
      let k = 0;
      for (; k < remaining.length - 1; k++) {
        r -= strength[remaining[k]];
        if (r <= 0) break;
      }
      const driver = remaining[k];
      if (place === 0) wins[driver]++;
      if (place < 3) podiums[driver]++;
      top10s[driver]++;
      total -= strength[driver];
      remaining.splice(k, 1);
    }
  }

  return scored
    .map((s, i) => ({
      driverId: s.d.driverId,
      name: s.d.name,
      code: s.d.code,
      team: s.d.team,
      expected: s.expected,
      p1: wins[i] / SIMULATIONS,
      top3: podiums[i] / SIMULATIONS,
      top10: top10s[i] / SIMULATIONS,
      factors: s.factors,
      strongest: s.strongest,
    }))
    .sort((a, b) => a.expected - b.expected);
}
