// RACE REPLAY: re-plays a race on a track map using only 5 small downloads.
//
// Idea: OpenF1 gives the exact moment each driver started every lap. Between
// two lap starts we know what fraction of the lap a driver has done. To turn
// "62% of the lap" into a dot on the map we use one reference lap with
// positions (x, y) over time, so cars slow down in corners and speed up on
// straights just like the real thing, without downloading every car's GPS
// data (that would be about 40 MB per race).

import type { OF1Lap, OF1Location, OF1RaceControl, OF1Stint } from "@/api/openf1";
import { parseDate } from "@/lib/telemetry";

export type DriverTimeline = {
  number: number;
  starts: number[]; // ms: start of lap 1, lap 2, …
  end: number; // ms: when the last completed lap ended
  laps: number; // laps completed
};

export function buildTimelines(laps: OF1Lap[]): DriverTimeline[] {
  const byDriver = new Map<number, OF1Lap[]>();
  for (const l of laps) byDriver.set(l.driver_number, [...(byDriver.get(l.driver_number) ?? []), l]);
  const out: DriverTimeline[] = [];
  for (const [number, list] of byDriver) {
    list.sort((a, b) => a.lap_number - b.lap_number);
    const starts: number[] = [];
    let end = 0;
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      let start = l.date_start ? parseDate(l.date_start) : NaN;
      if (Number.isNaN(start) && starts.length) start = starts[starts.length - 1] + (list[i - 1].lap_duration ?? 90) * 1000;
      if (Number.isNaN(start)) continue;
      starts.push(start);
      const next = list[i + 1]?.date_start;
      if (next) end = parseDate(next);
      else if (l.lap_duration) end = start + l.lap_duration * 1000;
      else starts.pop(); // last lap never finished (retirement)
    }
    if (starts.length) out.push({ number, starts, end: Math.max(end, starts[starts.length - 1]), laps: starts.length });
  }
  return out;
}

// How far through the race a driver is at time T, e.g. 12.62 = 62% into lap 13.
export function progressAt(d: DriverTimeline, T: number): number {
  if (T <= d.starts[0]) return 0;
  if (T >= d.end) return d.laps;
  let lo = 0, hi = d.starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (d.starts[mid] <= T) lo = mid;
    else hi = mid - 1;
  }
  const next = lo + 1 < d.starts.length ? d.starts[lo + 1] : d.end;
  return lo + (T - d.starts[lo]) / (next - d.starts[lo] || 1);
}

// When a driver reached a given progress (inverse of progressAt).
export function timeAtProgress(d: DriverTimeline, p: number): number {
  const lap = Math.min(Math.floor(p), d.laps - 1);
  const start = d.starts[lap];
  const next = lap + 1 < d.starts.length ? d.starts[lap + 1] : d.end;
  return start + (p - lap) * (next - start);
}

// Reference lap: points with the fraction of the lap at which they were recorded.
export type PathPoint = { x: number; y: number; f: number };

export function referencePath(loc: OF1Location[], lapStart: string, lapSeconds: number): PathPoint[] {
  const start = parseDate(lapStart);
  return loc
    .filter((p) => !(p.x === 0 && p.y === 0))
    .map((p) => ({ x: p.x, y: p.y, f: (parseDate(p.date) - start) / 1000 / lapSeconds }))
    .filter((p) => p.f >= 0 && p.f <= 1);
}

export function pointAt(path: PathPoint[], fraction: number): { x: number; y: number } {
  const f = fraction - Math.floor(fraction);
  let lo = 0, hi = path.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid].f <= f) lo = mid;
    else hi = mid;
  }
  const a = path[lo], b = path[hi];
  const k = b.f > a.f ? Math.min(Math.max((f - a.f) / (b.f - a.f), 0), 1) : 0;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

export type Standing = {
  number: number;
  progress: number;
  position: number;
  gap: string; // "+3.4", "+1 L", "LEADER", "OUT"
  finished: boolean;
  out: boolean;
};

// Running order at time T with the gap to the leader.
export function standingsAt(timelines: DriverTimeline[], T: number, retired: Set<number>): Standing[] {
  const rows = timelines.map((d) => {
    const progress = progressAt(d, T);
    const finished = T >= d.end && !retired.has(d.number);
    const out = retired.has(d.number) && T >= d.end;
    return { d, progress, finished, out };
  });
  rows.sort((a, b) => {
    if (a.out !== b.out) return a.out ? 1 : -1;
    if (b.progress !== a.progress) return b.progress - a.progress;
    return a.d.end - b.d.end; // same laps: whoever finished first
  });
  const leader = rows[0];
  return rows.map((r, i) => {
    let gap = "";
    if (i === 0) gap = "LEADER";
    else if (r.out) gap = "OUT";
    else {
      const lapsDown = Math.floor(leader.progress - r.progress);
      if (lapsDown >= 1) gap = `+${lapsDown} L`;
      else {
        const myTime = r.finished ? r.d.end : T;
        const leaderTime = timeAtProgress(leader.d, r.progress);
        gap = `+${Math.max(0, (myTime - leaderTime) / 1000).toFixed(1)}`;
      }
    }
    return { number: r.d.number, progress: r.progress, position: i + 1, gap, finished: r.finished, out: r.out };
  });
}

// Safety car, virtual safety car and red flag periods from race-control messages.
export type Neutral = { kind: "SC" | "VSC" | "RED"; from: number; to: number };

export function neutralPeriods(msgs: OF1RaceControl[], raceEnd: number): Neutral[] {
  const out: Neutral[] = [];
  let open: { kind: Neutral["kind"]; from: number } | null = null;
  const close = (to: number) => {
    if (open) out.push({ ...open, to });
    open = null;
  };
  for (const m of [...msgs].sort((a, b) => parseDate(a.date) - parseDate(b.date))) {
    const t = parseDate(m.date);
    const msg = m.message.toUpperCase();
    if (msg.includes("VIRTUAL SAFETY CAR DEPLOYED")) {
      close(t);
      open = { kind: "VSC", from: t };
    } else if (msg.includes("VIRTUAL SAFETY CAR ENDING")) {
      if (open?.kind === "VSC") close(t);
    } else if (msg.includes("SAFETY CAR DEPLOYED")) {
      close(t);
      open = { kind: "SC", from: t };
    } else if (msg.includes("SAFETY CAR IN THIS LAP")) {
      if (open?.kind === "SC") close(t + 60_000); // it pits about a lap later
    } else if (m.flag === "RED") {
      close(t);
      open = { kind: "RED", from: t };
    } else if (m.flag === "GREEN" && open?.kind === "RED") {
      close(t);
    }
  }
  close(raceEnd);
  return out;
}

// Tyre a driver is on at a given lap.
export function tyreAt(stints: OF1Stint[], driver: number, lap: number): string | null {
  const s = stints.find((x) => x.driver_number === driver && lap >= x.lap_start && lap <= x.lap_end);
  return s?.compound ?? null;
}

export const TYRE_LETTER: Record<string, string> = { SOFT: "S", MEDIUM: "M", HARD: "H", INTERMEDIATE: "I", WET: "W" };
export const TYRE_COLOR: Record<string, string> = {
  SOFT: "#F87171",
  MEDIUM: "#FACC15",
  HARD: "#E5E7EB",
  INTERMEDIATE: "#4ADE80",
  WET: "#60A5FA",
};
