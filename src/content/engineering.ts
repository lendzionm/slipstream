// ENGINEERING EXPLAINERS: all the text and diagram data, in English and Polish.
// To add a topic, copy one block and change it. Diagrams are drawn by
// src/components/Diagram.tsx from the numbers below (no images needed).

export type L = { en: string; pl: string };

export type DiagramSpec =
  | { kind: "bars"; title: L; note?: L; unit: string; rows: { label: L; value: number; color?: string }[] }
  | {
      kind: "stacked";
      title: L;
      note?: L;
      unit: string;
      legend: { label: L; color: string }[];
      rows: { label: L; parts: number[] }[];
    }
  | {
      kind: "stints";
      title: L;
      note?: L;
      totalLaps: number;
      rows: { label: L; stints: { compound: "S" | "M" | "H"; laps: number }[] }[];
    }
  | { kind: "compare"; title: L; before: L; after: L; rows: { label: L; before: L; after: L }[] };

export type Topic = {
  id: string;
  symbol: string;
  title: L;
  summary: L;
  keyNumbers: { value: string; label: L }[];
  sections: { heading: L; body: L }[];
  diagram: DiagramSpec;
};

export const TYRE_COLORS = { S: "#F87171", M: "#FACC15", H: "#E5E7EB" };

export const topics: Topic[] = [
  {
    id: "aero",
    symbol: "≋",
    title: { en: "Aerodynamics", pl: "Aerodynamika" },
    summary: {
      en: "How air pushes the car into the track, and why that costs speed on the straights.",
      pl: "Jak powietrze dociska bolid do toru i dlaczego to kosztuje prędkość na prostych.",
    },
    keyNumbers: [
      { value: "~30%", label: { en: "less downforce in 2026", pl: "mniej docisku w 2026" } },
      { value: "2", label: { en: "wing modes: corner & straight", pl: "tryby skrzydeł: zakręt i prosta" } },
    ],
    sections: [
      {
        heading: { en: "Downforce: an upside-down aeroplane wing", pl: "Docisk: odwrócone skrzydło samolotu" },
        body: {
          en: "An aeroplane wing creates lift. An F1 wing is the same shape turned upside down, so it pushes the car down instead. More push on the tyres means more grip, so the car can take corners much faster than its weight alone would allow.",
          pl: "Skrzydło samolotu wytwarza siłę nośną. Skrzydło F1 ma ten sam kształt, tylko odwrócony, więc dociska bolid do ziemi. Większy docisk opon to większa przyczepność, dzięki czemu auto pokonuje zakręty dużo szybciej, niż pozwoliłaby sama jego masa.",
        },
      },
      {
        heading: { en: "Drag: the price you pay", pl: "Opór: cena, którą płacisz" },
        body: {
          en: "Downforce isn't free. The same air that pushes the car down also slows it down (drag). Teams pick a balance for each track: lots of wing for slow, twisty tracks like Monaco, and thin wings for fast tracks like Monza or Las Vegas.",
          pl: "Docisk nie jest za darmo. To samo powietrze, które dociska auto, również je hamuje (opór). Zespoły dobierają kompromis do toru: dużo skrzydła na wolne, kręte tory jak Monako i cienkie skrzydła na szybkie tory jak Monza czy Las Vegas.",
        },
      },
      {
        heading: { en: "The floor does most of the work", pl: "Większość roboty robi podłoga" },
        body: {
          en: "The car's floor speeds up the air flowing underneath it. Faster air means lower pressure, which sucks the car towards the track. This 'ground effect' produces a lot of downforce with relatively little drag.",
          pl: "Podłoga bolidu przyspiesza powietrze płynące pod spodem. Szybsze powietrze to niższe ciśnienie, które zasysa auto do toru. Ten „efekt przypowierzchniowy” daje dużo docisku przy stosunkowo małym oporze.",
        },
      },
      {
        heading: { en: "2026: wings that move", pl: "2026: ruchome skrzydła" },
        body: {
          en: "Since 2026 the front and rear wings change angle during the lap. In corners they stay steep for grip; on straights they flatten to cut drag. This active aero replaced DRS, and a following car now gets extra electric power in 'overtake mode' instead.",
          pl: "Od 2026 przednie i tylne skrzydło zmieniają kąt w trakcie okrążenia. W zakrętach są ustawione stromo dla przyczepności, a na prostych się spłaszczają, żeby zmniejszyć opór. Ta aktywna aerodynamika zastąpiła DRS, a auto jadące z tyłu dostaje teraz dodatkową moc elektryczną w „trybie wyprzedzania”.",
        },
      },
    ],
    diagram: {
      kind: "bars",
      title: { en: "Wing level by track type", pl: "Poziom skrzydeł a typ toru" },
      note: { en: "Illustrative values, not team data.", pl: "Wartości poglądowe, nie dane zespołów." },
      unit: "%",
      rows: [
        { label: { en: "Monaco (slow, twisty)", pl: "Monako (wolny, kręty)" }, value: 100, color: "#FF3B3B" },
        { label: { en: "Hungary", pl: "Węgry" }, value: 90, color: "#FF3B3B" },
        { label: { en: "Silverstone", pl: "Silverstone" }, value: 70, color: "#FF3B3B" },
        { label: { en: "Las Vegas", pl: "Las Vegas" }, value: 45, color: "#E9E9EE" },
        { label: { en: "Monza (fast)", pl: "Monza (szybki)" }, value: 35, color: "#E9E9EE" },
      ],
    },
  },
  {
    id: "tyres",
    symbol: "◎",
    title: { en: "Tyres", pl: "Opony" },
    summary: {
      en: "Soft is fast but wears out quickly. Hard lasts longer but is slower. Races are won in between.",
      pl: "Miękkie są szybkie, ale szybko się zużywają. Twarde wytrzymują dłużej, ale są wolniejsze. Wyścigi wygrywa się pomiędzy.",
    },
    keyNumbers: [
      { value: "2", label: { en: "dry compounds needed per race", pl: "mieszanki obowiązkowe w wyścigu" } },
      { value: "~100°C", label: { en: "ideal operating temperature", pl: "idealna temperatura pracy" } },
    ],
    sections: [
      {
        heading: { en: "Three compounds each weekend", pl: "Trzy mieszanki na weekend" },
        body: {
          en: "For every race the tyre supplier brings three dry compounds, called Soft, Medium and Hard. Softer rubber grips better, so each lap is faster, but it wears and overheats sooner. In a dry race every driver must use at least two different compounds, so everyone stops at least once.",
          pl: "Na każdy wyścig dostawca opon przywozi trzy mieszanki na suchą nawierzchnię: miękką, pośrednią i twardą. Bardziej miękka guma lepiej trzyma, więc każde okrążenie jest szybsze, ale szybciej się zużywa i przegrzewa. W suchym wyścigu każdy kierowca musi użyć co najmniej dwóch różnych mieszanek, więc każdy zjeżdża do boksu przynajmniej raz.",
        },
      },
      {
        heading: { en: "Degradation and 'the cliff'", pl: "Degradacja i „klif”" },
        body: {
          en: "Tyres lose a little grip every lap; engineers call this degradation. At some point grip suddenly collapses and lap times drop by seconds. That's 'the cliff'. A good strategy pits just before it.",
          pl: "Opony z każdym okrążeniem tracą trochę przyczepności. Inżynierowie nazywają to degradacją. W pewnym momencie przyczepność nagle się załamuje, a czas okrążenia spada o kilka sekund. To jest „klif”. Dobra strategia to zjazd tuż przed nim.",
        },
      },
      {
        heading: { en: "The temperature window", pl: "Okno temperatury" },
        body: {
          en: "Tyres only work well in a narrow temperature range. Too cold and they slide; too hot and they blister and wear out. Cold tracks like Las Vegas at night make it hard to warm the tyres, which is why some teams struggle there.",
          pl: "Opony dobrze działają tylko w wąskim zakresie temperatur. Za zimne się ślizgają, a za gorące pęcherzą się i zużywają. Zimne tory, jak nocne Las Vegas, utrudniają rozgrzanie opon i dlatego niektóre zespoły mają tam problemy.",
        },
      },
    ],
    diagram: {
      kind: "bars",
      title: { en: "How long each compound lasts (typical stint)", pl: "Ile wytrzymuje mieszanka (typowy przejazd)" },
      note: { en: "Illustrative: it depends a lot on the track.", pl: "Wartości poglądowe: bardzo zależą od toru." },
      unit: " laps",
      rows: [
        { label: { en: "Soft", pl: "Miękka" }, value: 18, color: TYRE_COLORS.S },
        { label: { en: "Medium", pl: "Pośrednia" }, value: 28, color: TYRE_COLORS.M },
        { label: { en: "Hard", pl: "Twarda" }, value: 40, color: TYRE_COLORS.H },
      ],
    },
  },
  {
    id: "power",
    symbol: "ϟ",
    title: { en: "Power unit", pl: "Jednostka napędowa" },
    summary: {
      en: "A small V6 engine plus a huge electric motor. Since 2026 they share the work about 50/50.",
      pl: "Mały silnik V6 i ogromny silnik elektryczny. Od 2026 dzielą się pracą mniej więcej po połowie.",
    },
    keyNumbers: [
      { value: "350 kW", label: { en: "electric motor (MGU-K)", pl: "silnik elektryczny (MGU-K)" } },
      { value: "1.6 L", label: { en: "V6 turbo engine", pl: "silnik V6 turbo" } },
      { value: "100%", label: { en: "sustainable fuel", pl: "paliwo zrównoważone" } },
    ],
    sections: [
      {
        heading: { en: "What's inside", pl: "Co jest w środku" },
        body: {
          en: "The power unit is a 1.6-litre turbocharged V6 engine (the ICE), an electric motor-generator connected to the crankshaft (the MGU-K), a battery and the electronics that control them.",
          pl: "Jednostka napędowa to turbodoładowany silnik V6 o pojemności 1,6 litra (ICE), elektryczny silnik-generator połączony z wałem korbowym (MGU-K), bateria i elektronika, która tym wszystkim steruje.",
        },
      },
      {
        heading: { en: "Harvesting energy under braking", pl: "Odzyskiwanie energii przy hamowaniu" },
        body: {
          en: "When the driver brakes, the MGU-K works as a generator and turns the car's motion into electricity for the battery. On the next straight it works as a motor and gives that energy back. Energy management (when to harvest and when to deploy) is now a huge part of driving fast.",
          pl: "Gdy kierowca hamuje, MGU-K działa jak generator i zamienia ruch auta na prąd dla baterii. Na następnej prostej działa jak silnik i oddaje tę energię. Zarządzanie energią, czyli decyzje kiedy ładować, a kiedy oddawać moc, to teraz ogromna część szybkiej jazdy.",
        },
      },
      {
        heading: { en: "What changed in 2026", pl: "Co się zmieniło w 2026" },
        body: {
          en: "The MGU-H (which recovered energy from the turbo) was removed to make engines simpler and cheaper for new manufacturers. To compensate, the MGU-K got almost three times stronger (120 → 350 kW), while the combustion engine makes less power. Fuel is now 100% sustainable.",
          pl: "Usunięto MGU-H (odzyskujące energię z turbosprężarki), żeby silniki były prostsze i tańsze dla nowych producentów. W zamian MGU-K stało się prawie trzy razy mocniejsze (120 → 350 kW), a silnik spalinowy daje mniej mocy. Paliwo jest teraz w 100% zrównoważone.",
        },
      },
    ],
    diagram: {
      kind: "stacked",
      title: { en: "Where the power comes from (kW)", pl: "Skąd pochodzi moc (kW)" },
      note: { en: "Approximate peak figures.", pl: "Przybliżone wartości maksymalne." },
      unit: " kW",
      legend: [
        { label: { en: "Combustion engine", pl: "Silnik spalinowy" }, color: "#FFB020" },
        { label: { en: "Electric (MGU-K)", pl: "Elektryczny (MGU-K)" }, color: "#FF3B3B" },
      ],
      rows: [
        { label: { en: "2025", pl: "2025" }, parts: [550, 120] },
        { label: { en: "2026", pl: "2026" }, parts: [400, 350] },
      ],
    },
  },
  {
    id: "strategy",
    symbol: "⇄",
    title: { en: "Race strategy", pl: "Strategia wyścigu" },
    summary: {
      en: "When to pit, which tyres to fit, and how to beat a faster car without overtaking it on track.",
      pl: "Kiedy zjechać, jakie opony założyć i jak pokonać szybsze auto bez wyprzedzania na torze.",
    },
    keyNumbers: [
      { value: "~20–25 s", label: { en: "time lost per pit stop", pl: "strata na jeden pit stop" } },
      { value: "~2 s", label: { en: "a good stationary stop", pl: "dobry postój w boksie" } },
    ],
    sections: [
      {
        heading: { en: "The basic trade-off", pl: "Podstawowy kompromis" },
        body: {
          en: "Every pit stop costs around 20–25 seconds: driving slowly down the pit lane plus the stop itself. Fresh tyres are faster, though. Strategy means working out whether the time you gain on new tyres is bigger than the time you lose in the pits.",
          pl: "Każdy pit stop kosztuje około 20–25 sekund: wolny przejazd aleją serwisową plus sam postój. Za to świeże opony są szybsze. Strategia polega na policzeniu, czy czas zyskany na nowych oponach jest większy niż czas stracony w boksie.",
        },
      },
      {
        heading: { en: "Undercut and overcut", pl: "Undercut i overcut" },
        body: {
          en: "Undercut: you pit before your rival and use your fresh tyres to set fast laps. When they pit a lap later, you're ahead. Overcut is the opposite: you stay out longer, which works when new tyres are slow to warm up or when the track ahead is clear.",
          pl: "Undercut: zjeżdżasz przed rywalem i na świeżych oponach robisz szybkie okrążenia. Gdy on zjedzie okrążenie później, jesteś przed nim. Overcut to odwrotność: zostajesz dłużej na torze. Działa, gdy nowe opony długo się rozgrzewają albo gdy masz przed sobą pusty tor.",
        },
      },
      {
        heading: { en: "Safety cars change everything", pl: "Samochód bezpieczeństwa zmienia wszystko" },
        body: {
          en: "Behind a safety car the whole field drives slowly, so a pit stop costs only about half as much time. Teams constantly recalculate: 'if a safety car comes now, do we pit?'",
          pl: "Za samochodem bezpieczeństwa cała stawka jedzie wolno, więc pit stop kosztuje mniej więcej o połowę mniej czasu. Zespoły cały czas przeliczają: „jeśli teraz wyjedzie samochód bezpieczeństwa, zjeżdżamy?”",
        },
      },
    ],
    diagram: {
      kind: "stints",
      title: { en: "Two ways to do a 57-lap race", pl: "Dwa sposoby na wyścig na 57 okrążeń" },
      note: {
        en: "One stop = less time in the pits. Two stops = faster tyres more often.",
        pl: "Jeden postój = mniej czasu w boksie. Dwa postoje = częściej szybkie opony.",
      },
      totalLaps: 57,
      rows: [
        {
          label: { en: "1 stop", pl: "1 postój" },
          stints: [
            { compound: "M", laps: 24 },
            { compound: "H", laps: 33 },
          ],
        },
        {
          label: { en: "2 stops", pl: "2 postoje" },
          stints: [
            { compound: "S", laps: 15 },
            { compound: "M", laps: 22 },
            { compound: "S", laps: 20 },
          ],
        },
      ],
    },
  },
  {
    id: "regs",
    symbol: "§",
    title: { en: "2026 rules", pl: "Przepisy 2026" },
    summary: {
      en: "The biggest rule change in over a decade: smaller, lighter cars, moving wings and much more electric power.",
      pl: "Największa zmiana przepisów od ponad dekady: mniejsze i lżejsze auta, ruchome skrzydła i dużo więcej mocy elektrycznej.",
    },
    keyNumbers: [
      { value: "768 kg", label: { en: "minimum weight (−30 kg)", pl: "minimalna masa (−30 kg)" } },
      { value: "−200 mm", label: { en: "shorter wheelbase", pl: "krótszy rozstaw osi" } },
    ],
    sections: [
      {
        heading: { en: "Why change the rules?", pl: "Po co zmieniać przepisy?" },
        body: {
          en: "The goals were closer racing, cars that are easier to follow, engines closer to road-car technology, and simpler, cheaper power units so new manufacturers would join.",
          pl: "Cele to bliższa rywalizacja, auta, za którymi łatwiej jechać, silniki bliższe technologii samochodów drogowych oraz prostsze i tańsze jednostki napędowe, żeby do F1 dołączyli nowi producenci.",
        },
      },
      {
        heading: { en: "Smaller and lighter", pl: "Mniejsze i lżejsze" },
        body: {
          en: "Cars are 10 cm narrower, have a 20 cm shorter wheelbase and run slightly narrower tyres. The minimum weight dropped by about 30 kg. A lighter car brakes, turns and accelerates better and wears its tyres less.",
          pl: "Auta są o 10 cm węższe, mają o 20 cm krótszy rozstaw osi i nieco węższe opony. Minimalna masa spadła o około 30 kg. Lżejsze auto lepiej hamuje, skręca i przyspiesza oraz mniej zużywa opony.",
        },
      },
      {
        heading: { en: "Overtaking without DRS", pl: "Wyprzedzanie bez DRS" },
        body: {
          en: "DRS is gone. All cars now open their wings on straights, and a driver within about one second of the car ahead can use extra electric power to attack.",
          pl: "Nie ma już DRS. Wszystkie auta otwierają skrzydła na prostych, a kierowca, który jest mniej więcej sekundę za rywalem, może użyć dodatkowej mocy elektrycznej do ataku.",
        },
      },
    ],
    diagram: {
      kind: "compare",
      title: { en: "2025 vs 2026", pl: "2025 kontra 2026" },
      before: { en: "2025", pl: "2025" },
      after: { en: "2026", pl: "2026" },
      rows: [
        { label: { en: "Minimum weight", pl: "Minimalna masa" }, before: { en: "800 kg", pl: "800 kg" }, after: { en: "768 kg", pl: "768 kg" } },
        { label: { en: "Wheelbase", pl: "Rozstaw osi" }, before: { en: "3600 mm", pl: "3600 mm" }, after: { en: "3400 mm", pl: "3400 mm" } },
        { label: { en: "Width", pl: "Szerokość" }, before: { en: "2000 mm", pl: "2000 mm" }, after: { en: "1900 mm", pl: "1900 mm" } },
        { label: { en: "Electric power", pl: "Moc elektryczna" }, before: { en: "120 kW", pl: "120 kW" }, after: { en: "350 kW", pl: "350 kW" } },
        { label: { en: "MGU-H", pl: "MGU-H" }, before: { en: "Yes", pl: "Tak" }, after: { en: "Removed", pl: "Usunięte" } },
        { label: { en: "Overtaking aid", pl: "Pomoc przy wyprzedzaniu" }, before: { en: "DRS", pl: "DRS" }, after: { en: "Overtake mode", pl: "Tryb wyprzedzania" } },
        { label: { en: "Wings", pl: "Skrzydła" }, before: { en: "Fixed (+DRS)", pl: "Stałe (+DRS)" }, after: { en: "Active", pl: "Aktywne" } },
        { label: { en: "Fuel", pl: "Paliwo" }, before: { en: "Partly sustainable", pl: "Częściowo zrównoważone" }, after: { en: "100% sustainable", pl: "100% zrównoważone" } },
      ],
    },
  },
];
