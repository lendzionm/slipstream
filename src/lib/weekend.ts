// Helpers for the race-weekend hub: which weekend to show, session status,
// and turning OpenF1 data into simple numbers. Plain functions, easy to test.
import type { OF1RaceControl, OF1Result, OF1Session, OF1Weather } from "@/api/openf1";

export const FREE_DATA_DELAY_MS = 30 * 60 * 1000; // free data appears 30 min after a session

export type SessionStatus = "upcoming" | "live" | "processing" | "done";

export function sessionStatus(s: OF1Session, now: number): SessionStatus {
  const start = Date.parse(s.date_start);
  const end = Date.parse(s.date_end);
  if (now < start) return "upcoming";
  if (now <= end) return "live";
  if (now < end + FREE_DATA_DELAY_MS) return "processing";
  return "done";
}

// This weekend if a session is within 5 days, otherwise the most recent weekend.
export function pickWeekend(sessions: OF1Session[], now: number): OF1Session[] {
  const sorted = [...sessions].sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));
  const next = sorted.find((s) => Date.parse(s.date_end) > now);
  const lastStarted = [...sorted].reverse().find((s) => Date.parse(s.date_start) <= now);
  const soon = next && Date.parse(next.date_start) - now < 5 * 24 * 3600 * 1000;
  const meeting = soon ? next.meeting_key : (lastStarted ?? next)?.meeting_key;
  return sorted.filter((s) => s.meeting_key === meeting);
}

// Which session to open first: the latest one with data, else the next one.
export function defaultSession(weekend: OF1Session[], now: number): OF1Session | undefined {
  const done = weekend.filter((s) => sessionStatus(s, now) === "done");
  return done[done.length - 1] ?? weekend.find((s) => sessionStatus(s, now) !== "done");
}

// 83.456 -> "1:23.456"
export function formatSeconds(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = (sec % 60).toFixed(3).padStart(6, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function lastNumber<T>(x: T | (T | null)[] | null | undefined): T | null {
  if (Array.isArray(x)) {
    const vals = x.filter((v) => v !== null && v !== undefined);
    return (vals[vals.length - 1] as T) ?? null;
  }
  return (x as T) ?? null;
}

// What to show in the time column of a result row.
export function resultLabel(r: OF1Result): string {
  if (r.dsq) return "DSQ";
  if (r.dns) return "DNS";
  if (r.dnf) return "DNF";
  if (r.position === 1) {
    const d = lastNumber(r.duration); // qualifying: best (last) session time
    return typeof d === "number" ? formatSeconds(d) : "";
  }
  const gap = lastNumber(r.gap_to_leader);
  if (typeof gap === "number") return `+${gap.toFixed(3)}`;
  if (typeof gap === "string") return gap.startsWith("+") ? gap : `+${gap}`;
  const d = lastNumber(r.duration);
  return typeof d === "number" ? formatSeconds(d) : "";
}

export function weatherSummary(samples: OF1Weather[]) {
  if (samples.length === 0) return null;
  const avg = (f: (w: OF1Weather) => number) => samples.reduce((s, w) => s + f(w), 0) / samples.length;
  return {
    air: avg((w) => w.air_temperature),
    track: avg((w) => w.track_temperature),
    trackMax: Math.max(...samples.map((w) => w.track_temperature)),
    humidity: avg((w) => w.humidity),
    wind: Math.max(...samples.map((w) => w.wind_speed)),
    rain: samples.some((w) => w.rainfall > 0),
  };
}

// Only the important race-control messages: safety cars, red flags, penalties, investigations.
export function keyMessages(messages: OF1RaceControl[]): OF1RaceControl[] {
  return messages.filter((m) => {
    const text = m.message.toUpperCase();
    // "Reviewed, no further investigation/action" isn't news: skip it.
    if (text.includes("NO FURTHER")) return false;
    return (
      m.category === "SafetyCar" ||
      m.flag === "RED" ||
      text.includes("PENALTY") ||
      text.includes("INVESTIGATION") ||
      text.includes("SAFETY CAR")
    );
  });
}
