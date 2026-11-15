// Talks to the free OpenF1 API (data from 2023 onwards, including tyre compounds and weather).
// Limits on the free tier:
//   - max 3 requests per second and about 30 per minute, so we space requests out and cache answers;
//   - during a session (from 30 min before to 30 min after) data is only for paid users,
//     so the app shows a session's data once it has been over for ~30 minutes.

const BASE_URL = "https://api.openf1.org/v1";
const CACHE_TIME_MS = 10 * 60 * 1000; // 10 minutes
const PER_MINUTE = 28; // stay a little under the limit
const MIN_GAP_MS = 500; // OpenF1 allows max 3 requests per second: keep well under it

export type OF1Session = {
  session_key: number;
  meeting_key: number;
  session_name: string; // "Practice 1", "Qualifying", "Sprint", "Race"…
  session_type: string; // "Practice", "Qualifying", "Race"
  date_start: string;
  date_end: string;
  location: string;
  country_name: string;
  circuit_short_name: string;
  year: number;
};

export type OF1Driver = {
  driver_number: number;
  name_acronym: string;
  first_name: string;
  last_name: string;
  team_name: string;
  team_colour?: string; // hex without "#", e.g. "F47600"
};

export type OF1Result = {
  position: number | null;
  driver_number: number;
  number_of_laps: number;
  dnf?: boolean;
  dns?: boolean;
  dsq?: boolean;
  duration?: number | (number | null)[] | null; // seconds; qualifying gives [Q1, Q2, Q3]
  gap_to_leader?: number | string | (number | string | null)[] | null;
};

export type OF1Weather = {
  date: string;
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  rainfall: number;
  wind_speed: number;
};

export type OF1Stint = {
  driver_number: number;
  stint_number: number;
  lap_start: number;
  lap_end: number;
  compound: string; // SOFT, MEDIUM, HARD, INTERMEDIATE, WET
  tyre_age_at_start: number;
};

export type OF1RaceControl = {
  date: string;
  category: string; // "Flag", "SafetyCar", "Other"…
  flag?: string | null; // "RED", "YELLOW", "CHEQUERED"…
  message: string;
  lap_number?: number | null;
};

export type OF1Lap = {
  driver_number: number;
  lap_number: number;
  date_start: string | null;
  lap_duration: number | null; // seconds
  is_pit_out_lap: boolean;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  st_speed: number | null; // speed trap, km/h
};

export type OF1CarData = {
  date: string;
  speed: number; // km/h
  throttle: number; // 0–100
  brake: number; // 0 or 100
  n_gear: number;
  rpm: number;
  drs: number;
};

export type OF1Location = { date: string; x: number; y: number; z: number };

// ---------- Rate-limited, cached downloading ----------

const cache = new Map<string, { savedAt: number; data: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();
const recent: number[] = []; // times of requests in the last minute
let lastRequest = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForTurn() {
  for (;;) {
    const now = Date.now();
    while (recent.length && now - recent[0] > 60_000) recent.shift();
    const gapWait = lastRequest + MIN_GAP_MS - now;
    const minuteWait = recent.length >= PER_MINUTE ? recent[0] + 60_000 - now : 0;
    const wait = Math.max(gapWait, minuteWait, 0);
    if (wait === 0) break;
    await sleep(wait);
  }
  lastRequest = Date.now();
  recent.push(lastRequest);
}

async function download(path: string, triesLeft = 2): Promise<unknown> {
  await waitForTurn();
  const response = await fetch(BASE_URL + path);
  if (response.status === 429 && triesLeft > 0) {
    await sleep(5000);
    return download(path, triesLeft - 1);
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("live-restricted"); // a session is running: free data is paused
  }
  if (!response.ok) throw new Error(`OpenF1 error ${response.status}`);
  return response.json();
}

async function getJson<T>(path: string): Promise<T> {
  const saved = cache.get(path);
  if (saved && Date.now() - saved.savedAt < CACHE_TIME_MS) return saved.data as T;
  let request = inFlight.get(path);
  if (!request) {
    request = download(path).finally(() => inFlight.delete(path));
    inFlight.set(path, request);
  }
  const data = await request;
  cache.set(path, { savedAt: Date.now(), data });
  return data as T;
}

// ---------- Functions screens use ----------

export const getSessions = (year: number) => getJson<OF1Session[]>(`/sessions?year=${year}`);
export const getDrivers = (sessionKey: number) => getJson<OF1Driver[]>(`/drivers?session_key=${sessionKey}`);
export const getSessionResult = (sessionKey: number) =>
  getJson<OF1Result[]>(`/session_result?session_key=${sessionKey}`);
export const getWeather = (sessionKey: number) => getJson<OF1Weather[]>(`/weather?session_key=${sessionKey}`);
export const getStints = (sessionKey: number) => getJson<OF1Stint[]>(`/stints?session_key=${sessionKey}`);
export const getRaceControl = (sessionKey: number) =>
  getJson<OF1RaceControl[]>(`/race_control?session_key=${sessionKey}`);
// All laps of a session, or one driver's laps.
export const getLaps = (sessionKey: number, driver?: number) =>
  getJson<OF1Lap[]>(`/laps?session_key=${sessionKey}${driver ? `&driver_number=${driver}` : ""}`);

// Car data / positions for one driver between two moments (e.g. one lap).
const range = (from: string, to: string) => `&date>=${encodeURIComponent(from)}&date<=${encodeURIComponent(to)}`;
export const getCarData = (sessionKey: number, driver: number, from: string, to: string) =>
  getJson<OF1CarData[]>(`/car_data?session_key=${sessionKey}&driver_number=${driver}${range(from, to)}`);
export const getLocation = (sessionKey: number, driver: number, from: string, to: string) =>
  getJson<OF1Location[]>(`/location?session_key=${sessionKey}&driver_number=${driver}${range(from, to)}`);
