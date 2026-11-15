// Talks to the free Jolpica-F1 API (the successor of the old Ergast API).
// Limits: max 4 requests per second and 500 per hour, so we keep answers
// in memory for an hour instead of asking again every time.

import { CALENDAR_2027 } from "@/content/calendar2027";
import { loadJSON, saveJSON } from "@/lib/storage";

const BASE_URL = "https://api.jolpi.ca/ergast/f1";
const CACHE_TIME_MS = 60 * 60 * 1000; // 1 hour

// ---------- Types: what the data looks like ----------

export type SessionTime = { date: string; time?: string };

export type Driver = {
  driverId: string;
  permanentNumber?: string;
  code?: string; // e.g. "VER"
  givenName: string;
  familyName: string;
  nationality: string;
};

export type Constructor = { constructorId: string; name: string; nationality: string };

export type Race = {
  season: string;
  round: string;
  url: string; // Wikipedia link
  raceName: string;
  Circuit: {
    circuitId: string;
    url: string;
    circuitName: string;
    Location: { lat: string; long: string; locality: string; country: string };
  };
  date: string;
  time?: string;
  FirstPractice?: SessionTime;
  SecondPractice?: SessionTime;
  ThirdPractice?: SessionTime;
  Qualifying?: SessionTime;
  Sprint?: SessionTime;
  SprintQualifying?: SessionTime;
  SprintShootout?: SessionTime; // older name for sprint qualifying (2023)
  provisional?: { sprint: boolean; note?: string }; // our own: dates announced, times not yet
};

export type DriverStanding = {
  positionText: string;
  points: string;
  wins: string;
  Driver: Driver;
  Constructors: Constructor[];
};

export type ConstructorStanding = {
  positionText: string;
  points: string;
  wins: string;
  Constructor: Constructor;
};

export type RaceResult = {
  number: string;
  position: string;
  positionText: string; // "1", "2"… or "R" (retired), "D" (disqualified)…
  points: string;
  Driver: Driver;
  Constructor: Constructor;
  grid: string; // starting position ("0" = pit lane)
  laps: string;
  status: string; // "Finished", "+1 Lap", "Engine"…
  Time?: { millis?: string; time: string };
  FastestLap?: { rank?: string; lap: string; Time?: { time: string } };
};

export type QualifyingResult = {
  number: string;
  position: string;
  Driver: Driver;
  Constructor: Constructor;
  Q1?: string;
  Q2?: string;
  Q3?: string;
};

// ---------- Downloading with a simple cache ----------

const cache = new Map<string, { savedAt: number; data: unknown }>();
const inFlight = new Map<string, Promise<unknown>>(); // same request already on its way

// Rate limiting: wait at least 500 ms between requests (API allows 4 per second; we stay well under).
const MIN_GAP_MS = 500;
let nextFreeSlot = 0;
async function waitForTurn() {
  const now = Date.now();
  const wait = Math.max(0, nextFreeSlot - now);
  nextFreeSlot = now + wait + MIN_GAP_MS;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function download(path: string, triesLeft = 3): Promise<unknown> {
  await waitForTurn();
  let response: Response;
  try {
    response = await fetch(BASE_URL + path);
  } catch (error) {
    // A network hiccup, or a "too many requests" answer that the browser hides
    // from us (it arrives without the headers browsers need). Wait and retry.
    if (triesLeft > 0) {
      await sleep(3000);
      return download(path, triesLeft - 1);
    }
    throw error;
  }
  if (response.status === 429 && triesLeft > 0) {
    // "Too many requests": wait 3 seconds and try again
    await sleep(3000);
    return download(path, triesLeft - 1);
  }
  if (!response.ok) throw new Error(`Jolpica error ${response.status}`);
  return response.json();
}

async function getJson<T>(path: string): Promise<T> {
  const saved = cache.get(path);
  if (saved && Date.now() - saved.savedAt < CACHE_TIME_MS) {
    return saved.data as T;
  }
  let request = inFlight.get(path);
  if (!request) {
    request = download(path).finally(() => inFlight.delete(path));
    inFlight.set(path, request);
  }
  const data = await request;
  cache.set(path, { savedAt: Date.now(), data });
  return data as T;
}

type RaceTableResponse<R> = { MRData: { RaceTable: { Races: R[] } } };

// ---------- The functions screens use ----------

// season: "current" or a year like "2027"
export async function getSchedule(season: string = "current"): Promise<Race[]> {
  const data = await getJson<RaceTableResponse<Race>>(`/${season}.json?limit=100`);
  const races = data.MRData.RaceTable.Races;
  // Not in the API yet? Use the officially announced dates we keep in the app.
  if (races.length === 0 && season === "2027") return provisional2027();
  return races;
}

async function provisional2027(): Promise<Race[]> {
  const circuits = await getCircuits();
  return CALENDAR_2027.map((r) => {
    const circuit = circuits.find((c) => c.circuitId === r.circuitId);
    return {
      season: "2027",
      round: String(r.round),
      url: "",
      raceName: r.raceName,
      Circuit: circuit ?? {
        circuitId: r.circuitId,
        url: "",
        circuitName: r.raceName,
        Location: { lat: "0", long: "0", locality: "", country: "" },
      },
      date: r.raceDate,
      provisional: { sprint: r.sprint, note: r.note },
    };
  });
}

export async function getDriverStandings(season: string = "current") {
  const data = await getJson<{
    MRData: { StandingsTable: { season: string; StandingsLists: { DriverStandings: DriverStanding[] }[] } };
  }>(`/${season}/driverstandings.json?limit=100`);
  const table = data.MRData.StandingsTable;
  return { season: table.season, list: table.StandingsLists[0]?.DriverStandings ?? [] };
}

export async function getConstructorStandings(season: string = "current") {
  const data = await getJson<{
    MRData: {
      StandingsTable: { season: string; StandingsLists: { ConstructorStandings: ConstructorStanding[] }[] };
    };
  }>(`/${season}/constructorstandings.json?limit=100`);
  const table = data.MRData.StandingsTable;
  return { season: table.season, list: table.StandingsLists[0]?.ConstructorStandings ?? [] };
}

export async function getRaceResults(season: string, round: string) {
  const data = await getJson<RaceTableResponse<Race & { Results?: RaceResult[] }>>(
    `/${season}/${round}/results.json?limit=100`,
  );
  return data.MRData.RaceTable.Races[0];
}

export async function getQualifying(season: string, round: string) {
  const data = await getJson<RaceTableResponse<Race & { QualifyingResults?: QualifyingResult[] }>>(
    `/${season}/${round}/qualifying.json?limit=100`,
  );
  return data.MRData.RaceTable.Races[0]?.QualifyingResults ?? [];
}

export type PitStop = { driverId: string; lap: string; stop: string; time: string; duration: string };

// Every pit stop in one race (available from 2011 onwards).
export async function getPitStops(season: string, round: string) {
  const data = await getJson<RaceTableResponse<Race & { PitStops?: PitStop[] }>>(
    `/${season}/${round}/pitstops.json?limit=100`,
  );
  return data.MRData.RaceTable.Races[0]?.PitStops ?? [];
}

// Results of the race held at one circuit in one season ([] if there was no race there).
export async function getCircuitResults(season: string, circuitId: string) {
  const data = await getJson<RaceTableResponse<Race & { Results?: RaceResult[] }>>(
    `/${season}/circuits/${circuitId}/results.json?limit=100`,
  );
  return data.MRData.RaceTable.Races[0]?.Results ?? [];
}

export async function getSprintResults(season: string, round: string) {
  const data = await getJson<RaceTableResponse<Race & { SprintResults?: RaceResult[] }>>(
    `/${season}/${round}/sprint.json?limit=100`,
  );
  return data.MRData.RaceTable.Races[0]?.SprintResults ?? [];
}

// ---------- Circuits ----------

export type Circuit = Race["Circuit"];

export async function getCircuits(): Promise<Circuit[]> {
  const data = await getJson<{ MRData: { CircuitTable: { Circuits: Circuit[] } } }>(`/circuits.json?limit=100`);
  return data.MRData.CircuitTable.Circuits;
}

// A short list of every championship race ever held (about 1,200 races).
// The API gives max 100 per request, so this takes ~12 requests the first time;
// after that it's saved on the device for a day.
export type RaceSummary = { season: string; round: string; date: string; raceName: string; circuitId: string };
const ALL_RACES_KEY = "slipstream.allRaces.v1";
const DAY_MS = 24 * 60 * 60 * 1000;

export async function getAllRaces(): Promise<RaceSummary[]> {
  const saved = loadJSON<{ savedAt: number; races: RaceSummary[] } | null>(ALL_RACES_KEY, null);
  if (saved && Date.now() - saved.savedAt < DAY_MS) return saved.races;
  const races: RaceSummary[] = [];
  for (let offset = 0; ; offset += 100) {
    const data = await getJson<{ MRData: { total: string; RaceTable: { Races: Race[] } } }>(`/races.json?limit=100&offset=${offset}`);
    for (const r of data.MRData.RaceTable.Races) {
      races.push({ season: r.season, round: r.round, date: r.date, raceName: r.raceName, circuitId: r.Circuit.circuitId });
    }
    if (offset + 100 >= Number(data.MRData.total)) break;
  }
  saveJSON(ALL_RACES_KEY, { savedAt: Date.now(), races });
  return races;
}

type CircuitRaces = RaceTableResponse<Race & { Results?: RaceResult[]; QualifyingResults?: QualifyingResult[] }>;

// Winner of every race at a circuit.
export async function getCircuitWinners(circuitId: string) {
  const data = await getJson<CircuitRaces>(`/circuits/${circuitId}/results/1.json?limit=100`);
  return data.MRData.RaceTable.Races;
}

// Pole sitter of every race at a circuit (qualifying data exists from 1994 on).
export async function getCircuitPoles(circuitId: string) {
  const data = await getJson<CircuitRaces>(`/circuits/${circuitId}/qualifying/1.json?limit=100`);
  return data.MRData.RaceTable.Races;
}

// Driver with the fastest race lap at every race at a circuit (lap times from 2004 on).
export async function getCircuitFastestLaps(circuitId: string) {
  const data = await getJson<CircuitRaces>(`/circuits/${circuitId}/fastest/1/results.json?limit=100`);
  return data.MRData.RaceTable.Races;
}
