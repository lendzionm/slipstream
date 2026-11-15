// Saves small bits of data (like your picks). BROWSER version: uses localStorage,
// so picks survive a refresh. The phone version is storage.native.ts. Expo picks
// the right file automatically (".native" = iPhone/Android).
// Both versions work the same way: everything is kept in memory for instant reads,
// and initStorage() loads the saved data once when the app starts.
import { Platform } from "react-native";

const memory = new Map<string, string>();
const canUseBrowserStorage = () => Platform.OS === "web" && typeof localStorage !== "undefined";

export async function initStorage(): Promise<void> {
  // Nothing to load up front in the browser: localStorage is read directly.
}

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = canUseBrowserStorage() ? localStorage.getItem(key) : memory.get(key) ?? null;
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown) {
  const raw = JSON.stringify(value);
  try {
    if (canUseBrowserStorage()) localStorage.setItem(key, raw);
    else memory.set(key, raw);
  } catch {
    memory.set(key, raw);
  }
}
