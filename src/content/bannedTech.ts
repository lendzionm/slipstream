// BANNED TECH: famous F1 ideas that were outlawed, in English and Polish.
import type { L } from "@/content/engineering";

export type BannedItem = {
  id: string;
  name: L;
  car: string; // team and car / years (no logos, just text)
  used: string;
  banned: string;
  how: L;
  why: L;
};

export const bannedTech: BannedItem[] = [
  {
    id: "skirts",
    name: { en: "Ground-effect skirts", pl: "Fartuchy efektu przypowierzchniowego" },
    car: "Lotus 78 / 79",
    used: "1977–1980",
    banned: "1981",
    how: {
      en: "The underside of the car was shaped like an upside-down wing, and sliding 'skirts' along the sides sealed the gap to the track. The air underneath was sucked through fast, gluing the car to the road.",
      pl: "Spód auta miał kształt odwróconego skrzydła, a ślizgające się „fartuchy” po bokach uszczelniały szczelinę przy torze. Powietrze pod spodem było szybko zasysane, przyklejając auto do drogi.",
    },
    why: {
      en: "Cornering speeds became dangerously high, and if a skirt broke the car suddenly lost almost all its grip. Sliding skirts were banned and flat bottoms followed in 1983.",
      pl: "Prędkości w zakrętach stały się niebezpiecznie wysokie, a gdy fartuch pękł, auto nagle traciło prawie całą przyczepność. Zakazano ruchomych fartuchów, a od 1983 wprowadzono płaskie dna.",
    },
  },
  {
    id: "fan",
    name: { en: "The fan car", pl: "Bolid z wentylatorem" },
    car: "Brabham BT46B",
    used: "1978",
    banned: "1978",
    how: {
      en: "A big fan at the back was officially there 'for engine cooling', but it also sucked air from under the car, creating huge downforce even at low speed.",
      pl: "Duży wentylator z tyłu oficjalnie służył „do chłodzenia silnika”, ale też wysysał powietrze spod auta, tworząc ogromny docisk nawet przy małej prędkości.",
    },
    why: {
      en: "It won its only race, the 1978 Swedish GP. Rivals protested that it was a movable aerodynamic device (and it threw dirt at cars behind), so the team withdrew it straight away.",
      pl: "Wygrał swój jedyny wyścig, GP Szwecji 1978. Rywale protestowali, że to ruchomy element aerodynamiczny (i rzucał brudem w auta z tyłu), więc zespół od razu go wycofał.",
    },
  },
  {
    id: "sixwheels",
    name: { en: "Six wheels", pl: "Sześć kół" },
    car: "Tyrrell P34",
    used: "1976–1977",
    banned: "1983",
    how: {
      en: "Four small front wheels instead of two big ones. They hid behind the front wing to cut drag and gave more rubber on the road for braking and grip.",
      pl: "Cztery małe przednie koła zamiast dwóch dużych. Chowały się za przednim skrzydłem, zmniejszając opór, i dawały więcej gumy na torze do hamowania i trzymania się drogi.",
    },
    why: {
      en: "It won a race (Sweden 1976), but small tyres were hard to develop. Other teams tested six-wheelers too, so from 1983 the rules said every car must have exactly four wheels.",
      pl: "Wygrał wyścig (Szwecja 1976), ale małe opony trudno było rozwijać. Inne zespoły też testowały auta z sześcioma kołami, więc od 1983 przepisy mówią: dokładnie cztery koła.",
    },
  },
  {
    id: "active",
    name: { en: "Active suspension", pl: "Aktywne zawieszenie" },
    car: "Williams FW14B / FW15C",
    used: "1992–1993",
    banned: "1994",
    how: {
      en: "Computer-controlled hydraulics adjusted the suspension instantly, keeping the car at the perfect height and angle for the aerodynamics in every corner.",
      pl: "Sterowana komputerowo hydraulika natychmiast dopasowywała zawieszenie, utrzymując auto na idealnej wysokości i pod idealnym kątem dla aerodynamiki w każdym zakręcie.",
    },
    why: {
      en: "The cars were so dominant and so computer-driven that the governing body banned it, along with other driver aids, to put more skill back in the driver's hands.",
      pl: "Auta były tak dominujące i tak sterowane komputerem, że władze sportu zakazały tego, razem z innymi systemami wspomagania, żeby więcej zależało od umiejętności kierowcy.",
    },
  },
  {
    id: "massdamper",
    name: { en: "Mass damper", pl: "Tłumik masowy" },
    car: "Renault R25 / R26",
    used: "2005–2006",
    banned: "2006",
    how: {
      en: "A weight on springs hidden in the nose bounced against the car's own movements, calming the front end over bumps and kerbs and keeping the front wing working.",
      pl: "Ciężarek na sprężynach ukryty w nosie poruszał się przeciwnie do ruchów auta, uspokajając przód na nierównościach i krawężnikach oraz utrzymując pracę przedniego skrzydła.",
    },
    why: {
      en: "Mid-season it was ruled a movable device that affected aerodynamics, which the rules don't allow.",
      pl: "W trakcie sezonu uznano go za ruchomy element wpływający na aerodynamikę, a tego przepisy nie pozwalają.",
    },
  },
  {
    id: "doublediffuser",
    name: { en: "Double diffuser", pl: "Podwójny dyfuzor" },
    car: "Brawn BGP 001 (and others)",
    used: "2009–2010",
    banned: "2011",
    how: {
      en: "A clever reading of the rules allowed a second, upper diffuser channel at the back, giving much more downforce from the floor.",
      pl: "Sprytna interpretacja przepisów pozwoliła na drugi, górny kanał dyfuzora z tyłu, co dawało dużo więcej docisku z podłogi.",
    },
    why: {
      en: "It was legal, and it helped a brand-new team win both titles in 2009. Everyone copied it, so the rules were rewritten to close the loophole from 2011.",
      pl: "Był legalny i pomógł zupełnie nowemu zespołowi wygrać oba tytuły w 2009. Wszyscy go skopiowali, więc od 2011 przepisy przepisano, żeby zamknąć lukę.",
    },
  },
  {
    id: "fduct",
    name: { en: "F-duct", pl: "F-duct" },
    car: "McLaren MP4-25",
    used: "2010",
    banned: "2011",
    how: {
      en: "On the straights the driver covered a small hole in the cockpit with a knee or hand. That sent air to the rear wing and 'stalled' it, cutting drag and adding top speed.",
      pl: "Na prostych kierowca zasłaniał kolanem lub ręką mały otwór w kokpicie. Kierowało to powietrze do tylnego skrzydła i „przeciągało” je, zmniejszając opór i dodając prędkości.",
    },
    why: {
      en: "Drivers steering with one hand at 300 km/h wasn't safe, and teams spent fortunes copying it. It was banned and replaced by DRS, a simpler moving flap.",
      pl: "Kierowanie jedną ręką przy 300 km/h nie było bezpieczne, a zespoły wydawały fortuny na kopiowanie. Zakazano go i zastąpiono DRS, czyli prostszą ruchomą klapą.",
    },
  },
  {
    id: "blown",
    name: { en: "Blown diffuser", pl: "Dmuchany dyfuzor" },
    car: "Red Bull RB6 / RB7 (and others)",
    used: "2010–2011",
    banned: "2012",
    how: {
      en: "Hot exhaust gas was aimed at the diffuser to boost downforce. Engines kept blowing gas even when the driver lifted off the throttle, so the downforce stayed in the corners.",
      pl: "Gorące spaliny kierowano na dyfuzor, żeby zwiększyć docisk. Silniki wydmuchiwały gaz nawet po zdjęciu nogi z gazu, więc docisk zostawał w zakrętach.",
    },
    why: {
      en: "It used the engine as an aerodynamic device and wasted fuel. From 2012 exhaust positions were strictly controlled.",
      pl: "Używał silnika jako elementu aerodynamicznego i marnował paliwo. Od 2012 położenie wydechów jest ściśle określone.",
    },
  },
  {
    id: "das",
    name: { en: "DAS (dual-axis steering)", pl: "DAS (sterowanie w dwóch osiach)" },
    car: "Mercedes W11",
    used: "2020",
    banned: "2021",
    how: {
      en: "The driver could pull or push the steering wheel to change the angle of the front wheels (toe) on the straights, helping to warm the tyres and reduce drag.",
      pl: "Kierowca mógł pociągnąć lub pchnąć kierownicę, żeby zmienić kąt przednich kół (zbieżność) na prostych, co pomagało rozgrzać opony i zmniejszyć opór.",
    },
    why: {
      en: "It was legal in 2020, but the rules for 2021 were changed to say the steering may only steer.",
      pl: "W 2020 był legalny, ale przepisy na 2021 zmieniono: kierownica może służyć tylko do skręcania.",
    },
  },
];
