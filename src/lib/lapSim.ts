// SLIPSTREAM LAP-TIME SIMULATOR (simplified "point-mass" model)
//
// The track is a list of straights and corners, cut into 5 m steps.
// For each step we know the fastest the car could possibly go:
//   - in a corner: limited by grip. Grip = tyre friction × (weight + downforce).
//     Downforce grows with speed², so more wing = faster corners.
//   - on a straight: limited by power and drag (air resistance also grows with speed²).
// Then:
//   1. Forward pass: accelerate as hard as power and grip allow.
//   2. Backward pass: make sure the car can brake in time for every corner.
// Lap time = sum of (step length ÷ speed). Real teams use far more detailed
// simulators, but the trade-offs (wing vs top speed, weight, grip) behave the same.

export type Car = {
  massKg: number; // car + driver + average fuel
  powerKw: number; // usable power
  liftArea: number; // ClA in m²: downforce = ½·ρ·ClA·v²
  dragArea: number; // CdA in m²: drag = ½·ρ·CdA·v²
  grip: number; // tyre friction coefficient (μ)
};

export type Segment = { kind: "straight"; length: number } | { kind: "corner"; radius: number; angleDeg: number };

export type Track = { id: string; segments: Segment[] };

export type LapResult = {
  lapTime: number; // seconds
  cornerTime: number; // seconds spent in corners
  straightTime: number; // seconds spent on straights
  topSpeed: number; // km/h
  minSpeed: number; // km/h (slowest corner)
  lengthM: number;
};

const RHO = 1.2; // air density kg/m³
const G = 9.81;
const STEP = 5; // metres
const MAX_SPEED = 110; // m/s safety cap (396 km/h)
const MAX_BRAKE_G = 5.5;

// Fastest speed (m/s) through a corner of radius r, from: m·v²/r = μ·(m·g + ½ρ·ClA·v²)
export function cornerSpeed(car: Car, radius: number): number {
  const denominator = car.massKg / radius - 0.5 * car.grip * RHO * car.liftArea;
  if (denominator <= 0) return MAX_SPEED; // downforce so big the corner is flat out
  return Math.min(MAX_SPEED, Math.sqrt((car.grip * car.massKg * G) / denominator));
}

function accel(car: Car, v: number): number {
  const speed = Math.max(v, 1);
  const downforce = 0.5 * RHO * car.liftArea * speed * speed;
  const drag = 0.5 * RHO * car.dragArea * speed * speed;
  const traction = Math.min((car.powerKw * 1000) / speed, car.grip * (car.massKg * G + downforce) * 0.7);
  return (traction - drag) / car.massKg; // 0.7: only the rear tyres drive the car
}

function brake(car: Car, v: number): number {
  const downforce = 0.5 * RHO * car.liftArea * v * v;
  const drag = 0.5 * RHO * car.dragArea * v * v;
  // Brakes and tyres can't stop the car harder than about 5.5 g in real life.
  return Math.min(MAX_BRAKE_G * G, (car.grip * (car.massKg * G + downforce) + drag) / car.massKg);
}

export function simulateLap(car: Car, track: Track): LapResult {
  // 1. Cut the track into steps, each with a speed limit.
  const limits: number[] = [];
  const isCorner: boolean[] = [];
  for (const seg of track.segments) {
    const length = seg.kind === "straight" ? seg.length : (seg.radius * seg.angleDeg * Math.PI) / 180;
    const limit = seg.kind === "straight" ? MAX_SPEED : cornerSpeed(car, seg.radius);
    const steps = Math.max(1, Math.round(length / STEP));
    for (let i = 0; i < steps; i++) {
      limits.push(limit);
      isCorner.push(seg.kind === "corner");
    }
  }
  const n = limits.length;

  // 2. Forward pass (two laps, so the start speed matches the end of the lap).
  const v = new Array<number>(n).fill(0);
  let speed = Math.min(...limits);
  for (let lap = 0; lap < 2; lap++) {
    for (let i = 0; i < n; i++) {
      speed = Math.min(limits[i], Math.sqrt(Math.max(0, speed * speed + 2 * accel(car, speed) * STEP)));
      v[i] = speed;
    }
  }

  // 3. Backward pass for braking (also twice around, to handle the wrap).
  for (let lap = 0; lap < 2; lap++) {
    for (let i = n - 1; i >= 0; i--) {
      const next = v[(i + 1) % n];
      const canReach = Math.sqrt(next * next + 2 * brake(car, next) * STEP);
      if (v[i] > canReach) v[i] = canReach;
    }
  }

  // 4. Add up the time.
  let cornerTime = 0;
  let straightTime = 0;
  for (let i = 0; i < n; i++) {
    const dt = STEP / Math.max(v[i], 1);
    if (isCorner[i]) cornerTime += dt;
    else straightTime += dt;
  }

  return {
    lapTime: cornerTime + straightTime,
    cornerTime,
    straightTime,
    topSpeed: Math.max(...v) * 3.6,
    minSpeed: Math.min(...v) * 3.6,
    lengthM: n * STEP,
  };
}

// ---------- The baseline car and the "what if" changes ----------

export type Compound = "S" | "M" | "H";
export const TYRE_GRIP: Record<Compound, number> = { S: 1.75, M: 1.68, H: 1.62 };

export const BASE_CAR: Car = {
  massKg: 800,
  powerKw: 700,
  liftArea: 4.5,
  dragArea: 1.35,
  grip: TYRE_GRIP.M,
};

export type Changes = {
  downforcePct: number; // e.g. +10 = 10% more wing
  powerPct: number;
  weightKg: number; // + or − kg
  compound: Compound;
};

export const NO_CHANGES: Changes = { downforcePct: 0, powerPct: 0, weightKg: 0, compound: "M" };

export function applyChanges(changes: Changes): Car {
  const wing = changes.downforcePct / 100;
  return {
    massKg: BASE_CAR.massKg + changes.weightKg,
    powerKw: BASE_CAR.powerKw * (1 + changes.powerPct / 100),
    liftArea: BASE_CAR.liftArea * (1 + wing),
    // More wing also means more drag (same % change: wings add drag as fast as downforce).
    dragArea: BASE_CAR.dragArea * (1 + wing * 1.0),
    grip: TYRE_GRIP[changes.compound],
  };
}

// ---------- Three made-up tracks of different types ----------

const S = (length: number): Segment => ({ kind: "straight", length });
const C = (radius: number, angleDeg: number): Segment => ({ kind: "corner", radius, angleDeg });

export const TRACKS: Track[] = [
  {
    id: "fast", // long straights and slow chicanes, like Monza or Las Vegas
    segments: [
      S(1150), C(15, 90), C(15, 90), S(650), C(45, 100), S(250), C(45, 80), S(950),
      C(18, 90), C(18, 90), S(1050), C(16, 90), C(16, 90), S(500), C(60, 180),
    ],
  },
  {
    id: "balanced", // a mix of fast sweepers and slow corners, like Silverstone
    segments: [
      S(700), C(85, 70), S(300), C(30, 120), S(450), C(110, 60), C(95, 60), C(105, 50),
      S(600), C(40, 110), S(350), C(120, 40), S(500), C(25, 150), S(400), C(70, 90),
    ],
  },
  {
    id: "street", // tight and slow, like Monaco
    segments: [
      S(450), C(20, 90), S(200), C(35, 60), S(250), C(12, 180), S(180), C(18, 90),
      S(500), C(40, 50), S(150), C(15, 90), C(15, 90), S(220), C(25, 90), S(160), C(20, 100), S(120),
    ],
  },
];
