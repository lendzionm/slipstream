// Saves small bits of data (like your picks). PHONE version (iPhone/Android):
// uses AsyncStorage, the phone's permanent app storage, so picks survive
// closing the app. The browser version is storage.ts.
// Everything lives in one saved object; reads come from memory (instant),
// and every save is written to the phone in the background.
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORE_KEY = "slipstream.store.v1";
let memory: Record<string, string> = {};

// Called once when the app starts (see src/app/_layout.tsx).
export async function initStorage(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    memory = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    memory = {};
  }
}

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = memory[key];
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown) {
  memory[key] = JSON.stringify(value);
  AsyncStorage.setItem(STORE_KEY, JSON.stringify(memory)).catch(() => {
    // If saving fails, the data still works until the app is closed.
  });
}
