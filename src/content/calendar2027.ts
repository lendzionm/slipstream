// 2027 CALENDAR (provisional): announced by Formula 1 and the FIA on
// 16 September 2026 after approval by the World Motor Sport Council.
// Only race dates are known so far; session times are published later.
// As soon as the Jolpica API has the 2027 schedule, the app uses that instead
// (see getSchedule in src/api/jolpica.ts), so this file can then be deleted.
// Sources: formula1.com, ESPN (Turkey is subject to FIA track approval).

export type ProvisionalRace = {
  round: number;
  raceName: string;
  circuitId: string; // Jolpica circuit id
  raceDate: string; // race day (YYYY-MM-DD)
  sprint: boolean;
  note?: "homologation";
};

export const PRESEASON_TEST_2027 = { from: "2027-02-24", to: "2027-02-27", circuitId: "bahrain" };

export const CALENDAR_2027: ProvisionalRace[] = [
  { round: 1, raceName: "Bahrain Grand Prix", circuitId: "bahrain", raceDate: "2027-03-14", sprint: true },
  { round: 2, raceName: "Saudi Arabian Grand Prix", circuitId: "jeddah", raceDate: "2027-03-21", sprint: false },
  { round: 3, raceName: "Australian Grand Prix", circuitId: "albert_park", raceDate: "2027-04-04", sprint: true },
  { round: 4, raceName: "Japanese Grand Prix", circuitId: "suzuka", raceDate: "2027-04-11", sprint: true },
  { round: 5, raceName: "Chinese Grand Prix", circuitId: "shanghai", raceDate: "2027-04-18", sprint: false },
  { round: 6, raceName: "Miami Grand Prix", circuitId: "miami", raceDate: "2027-05-02", sprint: false },
  { round: 7, raceName: "Canadian Grand Prix", circuitId: "villeneuve", raceDate: "2027-05-23", sprint: true },
  { round: 8, raceName: "Monaco Grand Prix", circuitId: "monaco", raceDate: "2027-06-06", sprint: true },
  { round: 9, raceName: "Portuguese Grand Prix", circuitId: "portimao", raceDate: "2027-06-20", sprint: false },
  { round: 10, raceName: "British Grand Prix", circuitId: "silverstone", raceDate: "2027-07-04", sprint: true },
  { round: 11, raceName: "Austrian Grand Prix", circuitId: "red_bull_ring", raceDate: "2027-07-11", sprint: false },
  { round: 12, raceName: "Belgian Grand Prix", circuitId: "spa", raceDate: "2027-07-25", sprint: false },
  { round: 13, raceName: "Hungarian Grand Prix", circuitId: "hungaroring", raceDate: "2027-08-01", sprint: false },
  { round: 14, raceName: "Italian Grand Prix", circuitId: "monza", raceDate: "2027-09-05", sprint: true },
  { round: 15, raceName: "Spanish Grand Prix", circuitId: "madring", raceDate: "2027-09-12", sprint: false },
  { round: 16, raceName: "Azerbaijan Grand Prix", circuitId: "baku", raceDate: "2027-09-26", sprint: false },
  { round: 17, raceName: "Turkish Grand Prix", circuitId: "istanbul", raceDate: "2027-10-03", sprint: false, note: "homologation" },
  { round: 18, raceName: "Singapore Grand Prix", circuitId: "marina_bay", raceDate: "2027-10-10", sprint: false },
  { round: 19, raceName: "United States Grand Prix", circuitId: "americas", raceDate: "2027-10-24", sprint: false },
  { round: 20, raceName: "Mexico City Grand Prix", circuitId: "rodriguez", raceDate: "2027-10-31", sprint: false },
  { round: 21, raceName: "São Paulo Grand Prix", circuitId: "interlagos", raceDate: "2027-11-07", sprint: true },
  { round: 22, raceName: "Las Vegas Grand Prix", circuitId: "vegas", raceDate: "2027-11-20", sprint: false },
  { round: 23, raceName: "Qatar Grand Prix", circuitId: "losail", raceDate: "2027-12-05", sprint: true },
  { round: 24, raceName: "Abu Dhabi Grand Prix", circuitId: "yas_marina", raceDate: "2027-12-12", sprint: true },
];
