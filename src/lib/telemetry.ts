// TELEMETRY DUEL: turns raw OpenF1 car data (about 4 samples per second) into
// lap traces that can be compared metre by metre.
//
// How it works:
//   1. Each sample has a time and a speed. Adding up speed × time gives the
//      distance travelled, so every sample gets a position on the lap.
//   2. Both laps are stretched to the same length (small measuring errors make
//      them differ by a few metres) and re-sampled every 5 m.
//   3. At every point we know how long each driver took to get there, so
//      "time B − time A" is the gap (the delta) all around the lap.
//   4. The lap is cut into 25 mini-sectors; each is coloured by who was faster
//      there, and the biggest gains are explained with speed and braking data.

import type { OF1CarData, OF1Lap, OF1Location } from "@/api/openf1";

export const STEP_M = 5; // re-sample every 5 metres
export const MINI_SECTORS = 25;

export type Trace = {
  lapTime: number; // seconds
  length: number; // metres (shared by both drivers after stretching)
  time: number[]; // seconds from lap start, one value per 5 m
  speed: number[]; // km/h
  throttle: number[]; // 0–100 %
  brake: number[]; // 0 or 100
  gear: number[];
};

// OpenF1 dates have 6 decimal places, which some phones can't read: cut to 3.
export const parseDate = (s: string) => Date.parse(s.replace(/\.(\d{3})\d*/, ".$1"));

export function bestLap(laps: OF1Lap[]): OF1Lap | null {
  const valid = laps.filter((l) => l.lap_duration && l.date_start && !l.is_pit_out_lap);
  valid.sort((a, b) => (a.lap_duration as number) - (b.lap_duration as number));
  return valid[0] ?? null;
}

type Raw = { t: number; d: number; speed: number; throttle: number; brake: number; gear: number };

// Step 1: time + distance for every sample.
function integrate(samples: OF1CarData[], lap: OF1Lap): Raw[] {
  const start = parseDate(lap.date_start as string);
  const lapTime = lap.lap_duration as number;
  const raw: Raw[] = [];
  let d = 0;
  let prev: Raw | null = null;
  for (const s of samples) {
    const t = (parseDate(s.date) - start) / 1000;
    if (t < 0 || t > lapTime) continue;
    if (prev) d += ((prev.speed + s.speed) / 2 / 3.6) * (t - prev.t); // km/h → m/s
    else d = (s.speed / 3.6) * t; // distance covered before the first sample
    prev = { t, d, speed: s.speed, throttle: s.throttle, brake: s.brake > 0 ? 100 : 0, gear: s.n_gear };
    raw.push(prev);
  }
  if (prev && prev.t < lapTime) {
    // finish the lap at the line with the last known speed
    raw.push({ ...prev, t: lapTime, d: prev.d + (prev.speed / 3.6) * (lapTime - prev.t) });
  }
  return raw;
}

// Value at distance x, interpolated between the two nearest samples.
function sampleAt(raw: Raw[], x: number, key: "t" | "speed" | "throttle", i: { idx: number }) {
  while (i.idx < raw.length - 2 && raw[i.idx + 1].d < x) i.idx++;
  const a = raw[i.idx];
  const b = raw[Math.min(i.idx + 1, raw.length - 1)];
  const span = b.d - a.d;
  const f = span > 0 ? Math.min(Math.max((x - a.d) / span, 0), 1) : 0;
  return a[key] + (b[key] - a[key]) * f;
}

function nearest(raw: Raw[], x: number, key: "brake" | "gear", i: { idx: number }) {
  while (i.idx < raw.length - 2 && raw[i.idx + 1].d < x) i.idx++;
  const a = raw[i.idx];
  const b = raw[Math.min(i.idx + 1, raw.length - 1)];
  return x - a.d < b.d - x ? a[key] : b[key];
}

// Steps 1–2 for both drivers at once.
export function buildTraces(
  a: { lap: OF1Lap; data: OF1CarData[] },
  b: { lap: OF1Lap; data: OF1CarData[] },
): [Trace, Trace] | null {
  const rawA = integrate(a.data, a.lap);
  const rawB = integrate(b.data, b.lap);
  if (rawA.length < 20 || rawB.length < 20) return null;
  const lenA = rawA[rawA.length - 1].d;
  const lenB = rawB[rawB.length - 1].d;
  const length = (lenA + lenB) / 2;

  const make = (raw: Raw[], own: number, lap: OF1Lap): Trace => {
    const stretched = raw.map((r) => ({ ...r, d: (r.d * length) / own }));
    const tr: Trace = { lapTime: lap.lap_duration as number, length, time: [], speed: [], throttle: [], brake: [], gear: [] };
    const i1 = { idx: 0 }, i2 = { idx: 0 }, i3 = { idx: 0 }, i4 = { idx: 0 }, i5 = { idx: 0 };
    for (let x = 0; x <= length; x += STEP_M) {
      tr.time.push(sampleAt(stretched, x, "t", i1));
      tr.speed.push(sampleAt(stretched, x, "speed", i2));
      tr.throttle.push(sampleAt(stretched, x, "throttle", i3));
      tr.brake.push(nearest(stretched, x, "brake", i4));
      tr.gear.push(nearest(stretched, x, "gear", i5));
    }
    return tr;
  };
  return [make(rawA, lenA, a.lap), make(rawB, lenB, b.lap)];
}

// Step 3: positive = driver A is ahead by that many seconds.
export function delta(a: Trace, b: Trace): number[] {
  const n = Math.min(a.time.length, b.time.length);
  return Array.from({ length: n }, (_, i) => b.time[i] - a.time[i]);
}

// Step 4: who was faster in each mini-sector, and why.
export type MiniSector = {
  index: number;
  from: number; // metres
  to: number;
  gain: number; // seconds won by A here (negative = B won)
  minSpeedA: number;
  minSpeedB: number;
  topSpeedA: number;
  topSpeedB: number;
  brakeStartA: number | null; // metre where braking starts, if there is braking
  brakeStartB: number | null;
};

export function miniSectors(a: Trace, b: Trace): MiniSector[] {
  const d = delta(a, b);
  const n = d.length;
  const out: MiniSector[] = [];
  for (let s = 0; s < MINI_SECTORS; s++) {
    const i0 = Math.floor((s * (n - 1)) / MINI_SECTORS);
    const i1 = Math.floor(((s + 1) * (n - 1)) / MINI_SECTORS);
    const slice = (arr: number[]) => arr.slice(i0, i1 + 1);
    const firstBrake = (arr: number[]) => {
      const k = slice(arr).findIndex((v, j, all) => v > 0 && (j === 0 ? true : all[j - 1] === 0));
      return k < 0 ? null : (i0 + k) * STEP_M;
    };
    out.push({
      index: s,
      from: i0 * STEP_M,
      to: i1 * STEP_M,
      gain: d[i1] - d[i0],
      minSpeedA: Math.min(...slice(a.speed)),
      minSpeedB: Math.min(...slice(b.speed)),
      topSpeedA: Math.max(...slice(a.speed)),
      topSpeedB: Math.max(...slice(b.speed)),
      brakeStartA: firstBrake(a.brake),
      brakeStartB: firstBrake(b.brake),
    });
  }
  return out;
}

export type Reason =
  | { kind: "lateBraking"; metres: number }
  | { kind: "cornerSpeed"; kmh: number }
  | { kind: "straightSpeed"; kmh: number }
  | { kind: "traction" };

// A simple explanation for a sector where `winner` (A or B) gained time.
export function explain(s: MiniSector, winner: "A" | "B"): Reason {
  const w = winner === "A";
  const minW = w ? s.minSpeedA : s.minSpeedB, minL = w ? s.minSpeedB : s.minSpeedA;
  const topW = w ? s.topSpeedA : s.topSpeedB, topL = w ? s.topSpeedB : s.topSpeedA;
  const brW = w ? s.brakeStartA : s.brakeStartB, brL = w ? s.brakeStartB : s.brakeStartA;
  if (brW !== null && brL !== null && brW - brL >= 10) return { kind: "lateBraking", metres: Math.round(brW - brL) };
  if (minW - minL >= 4 && minW < 250) return { kind: "cornerSpeed", kmh: Math.round(minW - minL) };
  if (topW - topL >= 4) return { kind: "straightSpeed", kmh: Math.round(topW - topL) };
  return { kind: "traction" };
}

export type Summary = {
  topSpeed: [number, number];
  fullThrottle: [number, number]; // % of the lap at 98 %+ throttle
  braking: [number, number]; // % of the lap on the brakes
  avgSpeed: [number, number];
};

export function summarise(a: Trace, b: Trace): Summary {
  const pct = (arr: number[], test: (v: number) => boolean) => (arr.filter(test).length / arr.length) * 100;
  return {
    topSpeed: [Math.max(...a.speed), Math.max(...b.speed)],
    fullThrottle: [pct(a.throttle, (v) => v >= 98), pct(b.throttle, (v) => v >= 98)],
    braking: [pct(a.brake, (v) => v > 0), pct(b.brake, (v) => v > 0)],
    avgSpeed: [(a.length / a.lapTime) * 3.6, (b.length / b.lapTime) * 3.6],
  };
}

// Track map: each location point of driver A gets a distance on the lap
// (matched by time), so it can be coloured by the mini-sector it belongs to.
export function trackPoints(loc: OF1Location[], lap: OF1Lap, a: Trace): { x: number; y: number; d: number }[] {
  const start = parseDate(lap.date_start as string);
  const pts: { x: number; y: number; d: number }[] = [];
  let k = 0;
  for (const p of loc) {
    if (p.x === 0 && p.y === 0) continue; // missing position
    const t = (parseDate(p.date) - start) / 1000;
    if (t < 0 || t > a.lapTime) continue;
    while (k < a.time.length - 2 && a.time[k + 1] < t) k++;
    pts.push({ x: p.x, y: p.y, d: k * STEP_M });
  }
  return pts;
}

export const formatLap = (s: number) => {
  const m = Math.floor(s / 60);
  const rest = (s - m * 60).toFixed(3).padStart(6, "0");
  return m > 0 ? `${m}:${rest}` : rest;
};

// One driver's lap on its own (used for circuit profiles).
export function singleTrace(lap: OF1Lap, data: OF1CarData[]): Trace | null {
  const both = buildTraces({ lap, data }, { lap, data });
  return both ? both[0] : null;
}
