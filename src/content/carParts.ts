// The parts of the 3D car, with short explanations (English + Polish).
// topic = which engineering explainer to open for more.
import type { L } from "@/content/engineering";

export type PartId = "frontWing" | "rearWing" | "wheels" | "suspension" | "body" | "cockpit";

export type CarPart = { id: PartId; name: L; what: L; topic: string };

export const carParts: CarPart[] = [
  {
    id: "frontWing",
    name: { en: "Front wing & nose", pl: "Przednie skrzydło i nos" },
    what: {
      en: "The first part to meet the air. It makes downforce on the front tyres and steers the airflow around the wheels and under the car. Since 2026 its flaps move: steep in corners, flatter on straights. The nose behind it is a crash structure that must pass FIA tests.",
      pl: "Pierwsza część, która spotyka powietrze. Daje docisk przednim oponom i kieruje przepływ wokół kół i pod auto. Od 2026 jego klapy się ruszają: stromo w zakrętach, płasko na prostych. Nos za nim to struktura zderzeniowa, która musi przejść testy FIA.",
    },
    topic: "aero",
  },
  {
    id: "rearWing",
    name: { en: "Rear wing", pl: "Tylne skrzydło" },
    what: {
      en: "Gives downforce to the rear tyres for grip and traction. In 2026 its flap opens on straights (straight mode) to cut drag and closes for corners. The red lights below it flash in rain and when the car harvests energy.",
      pl: "Daje docisk tylnym oponom dla przyczepności i trakcji. W 2026 jego klapa otwiera się na prostych (tryb prostej), żeby zmniejszyć opór, i zamyka w zakrętach. Czerwone światła pod nim migają w deszczu i gdy auto odzyskuje energię.",
    },
    topic: "aero",
  },
  {
    id: "wheels",
    name: { en: "Wheels & tyres", pl: "Koła i opony" },
    what: {
      en: "The only part touching the track: 18-inch wheels with the brake discs inside. The tyre sidewall colour shows the compound. Soft grips most but wears fastest. Try changing it below.",
      pl: "Jedyna część, która dotyka toru: felgi 18 cali z tarczami hamulcowymi w środku. Kolor boku opony pokazuje mieszankę. Miękka trzyma najlepiej, ale najszybciej się zużywa. Zmień ją poniżej.",
    },
    topic: "tyres",
  },
  {
    id: "suspension",
    name: { en: "Suspension", pl: "Zawieszenie" },
    what: {
      en: "Carbon wishbones and push/pull rods connect the wheels to the car. They keep the tyres on the road and, just as important, hold the floor at the right height so the aerodynamics work.",
      pl: "Węglowe wahacze i drążki łączą koła z autem. Utrzymują opony na drodze i, co równie ważne, trzymają podłogę na właściwej wysokości, żeby działała aerodynamika.",
    },
    topic: "aero",
  },
  {
    id: "body",
    name: { en: "Bodywork, sidepods & floor", pl: "Nadwozie, sidepody i podłoga" },
    what: {
      en: "The carbon chassis with the sidepods (radiators inside) and the floor, the most important aerodynamic part: air speeds up underneath and sucks the car to the track. The power unit, a V6 turbo plus a 350 kW electric motor, sits under the engine cover.",
      pl: "Węglowe nadwozie z sidepodami (w środku chłodnice) i podłogą, najważniejszą częścią aerodynamiczną: powietrze przyspiesza pod spodem i zasysa auto do toru. Jednostka napędowa, V6 turbo plus silnik elektryczny 350 kW, jest pod pokrywą silnika.",
    },
    topic: "power",
  },
  {
    id: "cockpit",
    name: { en: "Cockpit, halo & mirrors", pl: "Kokpit, halo i lusterka" },
    what: {
      en: "The driver sits in a survival cell with a removable headrest. The titanium halo above protects their head from wheels and debris; it weighs about 7 kg but can take the weight of a London bus.",
      pl: "Kierowca siedzi w komórce bezpieczeństwa z wyjmowanym zagłówkiem. Tytanowe halo nad nim chroni głowę przed kołami i odłamkami; waży około 7 kg, a wytrzymuje ciężar londyńskiego autobusu.",
    },
    topic: "regs",
  },
];
