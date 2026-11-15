// Your picks (P1, P2, P3 and pole) and how they're scored.
// Scoring: 3 pts for the right driver in the right podium spot,
//          1 pt for a podium driver in the wrong spot,
//          2 pts for the right pole sitter.   Maximum: 11 pts per race.
import { loadJSON, saveJSON } from "@/lib/storage";

export type Slot = "p1" | "p2" | "p3" | "pole";
export const SLOTS: Slot[] = ["p1", "p2", "p3", "pole"];
export type PickSet = Partial<Record<Slot, string>>; // slot -> driverId

export type SavedPick = {
  season: string;
  round: string;
  raceName: string;
  user: PickSet;
  model: PickSet; // the model's picks at the moment you saved
  names: Record<string, string>; // driverId -> short code, for display later
  savedAt: number;
};

const STORAGE_KEY = "slipstream.picks.v1";

export const pickId = (season: string, round: string) => `${season}-${round}`;

export function loadAllPicks(): Record<string, SavedPick> {
  return loadJSON<Record<string, SavedPick>>(STORAGE_KEY, {});
}

export function savePick(pick: SavedPick) {
  const all = loadAllPicks();
  all[pickId(pick.season, pick.round)] = pick;
  saveJSON(STORAGE_KEY, all);
}

// podium = driverIds of the real P1, P2, P3; pole = driverId of the real pole sitter
export function scorePicks(picks: PickSet, podium: string[], pole?: string): number {
  let points = 0;
  (["p1", "p2", "p3"] as const).forEach((slot, i) => {
    const id = picks[slot];
    if (!id) return;
    if (podium[i] === id) points += 3;
    else if (podium.includes(id)) points += 1;
  });
  if (picks.pole && picks.pole === pole) points += 2;
  return points;
}
