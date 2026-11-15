// Opens the results page of one race, e.g. /race/2026/5
import { router } from "expo-router";

export function openRaceResults(season: string, round: string) {
  router.push({ pathname: "/race/[season]/[round]", params: { season, round } });
}
