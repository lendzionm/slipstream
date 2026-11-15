# Slipstream: an unofficial F1 companion and engineering lab

> **Unofficial fan app.** Not affiliated with, endorsed by or connected to Formula 1, the FIA or any team. No official logos, trademarks or footage are used; all design and graphics are my own.

**▶ Live demo: [lendzionm.github.io/slipstream](https://lendzionm.github.io/slipstream/)** (web version, works on phone and desktop)

Slipstream is a cross-platform app (web, Android and iOS from one codebase) that turns free, public Formula 1 data into a race companion and a hands-on engineering lab. It is available in **English and Polish**.

## Features

**Race weekend**
- Race calendar with every session in your local time and a live countdown; next season's calendar (2027) is already included from the official announcement and switches to live data once it's in the API
- Weekend hub: session status, results, weather, tyre stints and race-control messages
- Standings, race results, qualifying and sprint results
- **Circuit guide for all 78 tracks since 1950:** races held, most wins (drivers and teams), most poles, how often the pole sitter wins, average winning grid slot, lowest grid slot to win and the fastest race lap in the data. Tracks raced on since 2023 also get a speed-coloured map and a "track character" profile (lap length, top speed, full-throttle %, braking zones, gear changes) measured from a real lap

**Data and engineering**
- **Telemetry duel:** pick any session since 2023 and two drivers; their fastest laps are compared metre by metre (speed, throttle, brake, gear and the time gap), the track map is coloured by who is faster in each of 25 mini-sectors, and the biggest gains are explained automatically (later braking, more corner speed, higher top speed or better traction)
- **Race replay:** re-watch any race since 2023 on a live track map with running order, gaps, tyres and safety-car periods, at up to 120× speed. Cars are placed by interpolating official lap timings along a reference lap, so a whole race needs only 5 small downloads instead of ~40 MB of GPS data
- **Tyre wear & pit window:** learns each compound's degradation from a real race (fuel-corrected, within-stint regression, safety-car laps removed), measures the real pit-stop time loss, then searches every 1- and 2-stop strategy for the fastest one and shows the pit window. Example: for Abu Dhabi 2025 it picked Medium → Hard with a stop around lap 21 (window laps 18–24); the winner stopped on lap 23
- **Race prediction model:** a four-factor model (recent form, qualifying, team pace, track history) with a Plackett-Luce Monte Carlo simulation (4,000 runs) that gives win and podium probabilities with a plain-language "why"
- **Backtested honestly:** tuned on 29 races and checked on 10 races it had never seen. Average probability given to the real winner rose from 15.6% to 19.4%; podium drivers correctly predicted: 1.69 per race against 1.59 for the "last race repeats" baseline
- **What-if lab:** a point-mass lap-time simulator (forward/backward passes with grip, brake and power limits) to test wing level, power and weight on different track types
- **Strategy analysis:** which pit strategy actually worked in a real race
- **Interactive 3D car:** rotate, zoom, explode the car into parts, switch the 2026 active-aero wing modes and tyre compounds
- Engineering explainers and a page on famous banned technology
- Your own predictions, saved on the device and scored against the model

## Tech stack

| Area | Choice |
|---|---|
| App | Expo SDK 58, React Native 0.88, React 19, TypeScript, Expo Router |
| Graphics | react-native-svg (charts, track maps), three.js + React Three Fiber (3D) |
| Storage | localStorage (web), AsyncStorage (phone) |
| Data | Jolpica-F1 API, OpenF1 API |

## Data sources and limits

| Source | Used for | Limits |
|---|---|---|
| [Jolpica-F1](https://github.com/jolpica/jolpica-f1) | Calendar, results, standings, pit stops | 4 requests/s, about 500/hour; commercial use needs their supporter tier |
| [OpenF1](https://openf1.org) | Telemetry, positions, laps, weather, stints | Free historical data from 2023; 3 requests/s; live data during sessions needs a paid tier |

The app caches answers, spaces out requests and retries politely so it stays inside these limits.

## Run it yourself

You need [Node.js](https://nodejs.org) (LTS).

```bash
npm install
npx expo start
```

Then press **w** for the web version, or scan the QR code with the Expo Go app on your phone.

## Project structure

```
src/app/         screens (one file per page)
src/components/  shared UI: charts, 3D viewer, tab bar
src/lib/         logic: prediction model, backtest, lap simulator, telemetry maths
src/api/         API clients with caching and rate limiting
src/content/     explainer texts (EN + PL)
```

## Credits

- 3D model: "f1 2026" by **MattDoesBlender** on [Sketchfab](https://sketchfab.com/3d-models/f1-2026-1c9f3477345c403ebb70a248d58a94ba), licensed [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Modified: recoloured, steering wheel, belts and decals removed, geometry reduced. See `assets/models/README.md`.
- Data: Jolpica-F1 and OpenF1 communities.

## Licence

The code is released under the MIT licence (see `LICENSE`). The 3D model keeps its own CC BY-NC-SA 4.0 licence, so this project as a whole is non-commercial.
