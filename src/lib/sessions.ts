// Turns a race from the API into a simple, sorted list of sessions
// and finds which session is next (or live right now).
import type { Race, SessionTime } from "@/api/jolpica";

export type SessionKey = "fp1" | "fp2" | "fp3" | "sprintQuali" | "sprint" | "quali" | "race";
export type Session = { key: SessionKey; start: Date };

// Roughly how long each session lasts, so we know when it's "live".
const DURATION_MIN: Record<SessionKey, number> = {
  fp1: 60,
  fp2: 60,
  fp3: 60,
  sprintQuali: 45,
  sprint: 60,
  quali: 60,
  race: 120,
};

function toDate(s?: SessionTime): Date | null {
  if (!s?.date) return null;
  // The API gives times in UTC ("Z"). JavaScript converts them to local time for us.
  return new Date(`${s.date}T${s.time ?? "00:00:00Z"}`);
}

export function getSessions(race: Race): Session[] {
  const all: [SessionKey, SessionTime | undefined][] = [
    ["fp1", race.FirstPractice],
    ["fp2", race.SecondPractice],
    ["fp3", race.ThirdPractice],
    ["sprintQuali", race.SprintQualifying ?? race.SprintShootout],
    ["sprint", race.Sprint],
    ["quali", race.Qualifying],
    ["race", { date: race.date, time: race.time }],
  ];
  const sessions: Session[] = [];
  for (const [key, time] of all) {
    const start = toDate(time);
    if (start) sessions.push({ key, start });
  }
  return sessions.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function sessionEnd(session: Session): number {
  return session.start.getTime() + DURATION_MIN[session.key] * 60 * 1000;
}

export type NextSession = { race: Race; session: Session; isLive: boolean };

// First session that hasn't finished yet. null = the whole season is over.
export function findNextSession(races: Race[], now: number): NextSession | null {
  for (const race of races) {
    for (const session of getSessions(race)) {
      if (sessionEnd(session) > now) {
        return { race, session, isLive: session.start.getTime() <= now };
      }
    }
  }
  return null;
}

export function isRaceFinished(race: Race, now: number): boolean {
  const sessions = getSessions(race);
  const last = sessions[sessions.length - 1];
  return last ? sessionEnd(last) < now : false;
}
