// CIRCUIT GUIDE, e.g. /circuit/monza
// History and records from Jolpica, plus a track map and "track character"
// measured from a real fast lap (OpenF1 car data, tracks raced since 2023).
import { router, useLocalSearchParams } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import {
  getAllRaces,
  getCircuitFastestLaps,
  getCircuitPoles,
  getCircuits,
  getCircuitWinners,
  RaceSummary,
} from "@/api/jolpica";
import { getCarData, getDrivers, getLaps, getLocation, getSessionResult, getSessions } from "@/api/openf1";
import { LoadState } from "@/components/LoadState";
import { Screen } from "@/components/Screen";
import { TrackMap } from "@/components/TelemetryCharts";
import { circuitStats, speedColor, trackProfile } from "@/lib/circuits";
import { bestLap, formatLap, parseDate, singleTrace, STEP_M, trackPoints } from "@/lib/telemetry";
import { useAsync } from "@/lib/useAsync";
import { TextKey, useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

export default function CircuitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLang();

  const { data, error, retry } = useAsync(async () => {
    const circuits = await getCircuits();
    const circuit = circuits.find((c) => c.circuitId === id);
    const races = (await getAllRaces()).filter((r) => r.circuitId === id);
    const winners = await getCircuitWinners(id);
    const poles = await getCircuitPoles(id);
    const fastest = await getCircuitFastestLaps(id);
    return { circuit, races, stats: circuitStats(winners, poles, fastest) };
  }, [id]);

  if (!data) {
    return (
      <Screen title={t("circuitGuide")} showBack>
        <LoadState error={error} onRetry={retry} />
      </Screen>
    );
  }
  const { circuit, races, stats } = data;
  const held = races.filter((r) => Date.parse(r.date) <= Date.now());
  const years = held.map((r) => Number(r.season));
  const upcoming = races.find((r) => Date.parse(r.date) > Date.now());
  const roundOf = (season: string) => races.find((r) => r.season === season)?.round;

  return (
    <Screen
      title={circuit?.circuitName ?? id}
      subtitle={circuit ? `${circuit.Location.locality}, ${circuit.Location.country}` : undefined}
      showBack
    >
      {/* Headline numbers */}
      <View style={styles.grid}>
        <Stat label={t("grandsPrix")} value={String(held.length)} />
        <Stat label={t("firstRace")} value={years.length ? String(Math.min(...years)) : "–"} />
        <Stat label={t("lastRace")} value={years.length ? String(Math.max(...years)) : "–"} />
        <Stat label={t("nextRace")} value={upcoming ? upcoming.season : "–"} />
      </View>

      <TrackSection races={held} />

      {/* Records */}
      <View style={styles.card}>
        <Text style={styles.label}>{t("circuitRecords").toUpperCase()}</Text>
        <Row
          label={t("poleToWin")}
          value={stats.poleWinRate === null ? "–" : `${Math.round(stats.poleWinRate * 100)}%`}
          note={stats.poleWinRate === null ? undefined : t("poleToWinNote", { n: stats.poleSample })}
        />
        <Row label={t("avgWinGrid")} value={stats.avgWinnerGrid === null ? "–" : `P${stats.avgWinnerGrid.toFixed(1)}`} note={t("avgWinGridNote")} />
        {stats.lowestWin && (
          <Row label={t("lowestWin")} value={`P${stats.lowestWin.grid}`} note={`${stats.lowestWin.name}, ${stats.lowestWin.season}`} />
        )}
        {stats.lapRecord && (
          <Row label={t("fastestRaceLap")} value={stats.lapRecord.time} note={`${stats.lapRecord.name}, ${stats.lapRecord.season} · ${t("lapRecordNote")}`} />
        )}
      </View>

      <Leaderboard title={t("mostWins")} rows={stats.topDrivers} />
      <Leaderboard title={t("mostTeamWins")} rows={stats.topTeams} />
      {stats.topPoles.length > 0 && <Leaderboard title={t("mostPoles")} rows={stats.topPoles} note={t("polesNote")} />}

      {/* Recent winners */}
      {stats.recent.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>{t("recentWinners").toUpperCase()}</Text>
          {stats.recent.map((w) => {
            const round = roundOf(w.season);
            return (
              <Pressable
                key={w.season}
                style={styles.winRow}
                disabled={!round}
                onPress={() => round && router.push({ pathname: "/race/[season]/[round]", params: { season: w.season, round } })}
              >
                <Text style={styles.year}>{w.season}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.body}>{w.name}</Text>
                  <Text style={styles.hint}>
                    {w.team}
                    {w.fromPole ? ` · ${t("fromPole")}` : ""}
                  </Text>
                </View>
                {round && <Text style={styles.chevron}>›</Text>}
              </Pressable>
            );
          })}
        </View>
      )}

      {circuit?.url ? (
        <Pressable onPress={() => Linking.openURL(circuit.url)}>
          <Text style={styles.link}>{t("readWikipedia")} ›</Text>
        </Pressable>
      ) : null}
      <Text style={styles.hint}>{t("circuitSource")}</Text>
    </Screen>
  );
}

// Track map coloured by speed + numbers measured from the winner's fastest lap
// in the latest race here since 2023.
function TrackSection({ races }: { races: RaceSummary[] }) {
  const { t } = useLang();
  const latest = [...races].reverse().find((r) => Number(r.season) >= 2023);
  const { data, error, retry } = useAsync(async () => {
    if (!latest) return "none" as const;
    const sessions = await getSessions(Number(latest.season));
    const raceDay = Date.parse(latest.date);
    const session = sessions.find(
      (s) => s.session_name === "Race" && Math.abs(parseDate(s.date_start) - raceDay) < 2 * 24 * 3600 * 1000,
    );
    if (!session) return "none" as const;
    const result = await getSessionResult(session.session_key);
    const winner = result.find((r) => r.position === 1)?.driver_number ?? result[0]?.driver_number;
    if (!winner) return "none" as const;
    const lap = bestLap(await getLaps(session.session_key, winner));
    if (!lap) return "none" as const;
    const end = new Date(parseDate(lap.date_start as string) + (lap.lap_duration as number) * 1000 + 500).toISOString();
    const car = await getCarData(session.session_key, winner, lap.date_start as string, end);
    const loc = await getLocation(session.session_key, winner, lap.date_start as string, end);
    const drivers = await getDrivers(session.session_key).catch(() => []);
    const trace = singleTrace(lap, car);
    if (!trace) return "none" as const;
    return {
      trace,
      points: trackPoints(loc, lap, trace),
      profile: trackProfile(trace),
      driver: drivers.find((d) => d.driver_number === winner)?.name_acronym ?? `#${winner}`,
      season: latest.season,
    };
  }, [latest?.season, latest?.round]);

  if (!latest || data === "none") {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>{t("trackCharacter").toUpperCase()}</Text>
        <Text style={styles.hint}>{t("noTrackData")}</Text>
      </View>
    );
  }
  if (!data) return <LoadState error={error} onRetry={retry} message={t("trackLoading")} />;

  const { trace, points, profile } = data;
  const min = Math.min(...trace.speed), max = Math.max(...trace.speed);
  const colorAt = (d: number) => speedColor(trace.speed[Math.min(Math.round(d / STEP_M), trace.speed.length - 1)], min, max);
  const characterKey: Record<string, TextKey> = { power: "charPower", downforce: "charDownforce", balanced: "charBalanced" };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t("trackCharacter").toUpperCase()}</Text>
      <Text style={styles.verdict}>{t(characterKey[profile.character])}</Text>
      {points.length > 10 && <TrackMap points={points} sectorColor={colorAt} cursorDistance={null} height={230} />}
      <View style={styles.legend}>
        <Text style={styles.hint}>{Math.round(min)} km/h</Text>
        <View style={styles.legendBar}>
          {["#FF3B3B", "#FF6A3D", "#FF9A3F", "#FFC24A", "#F5DFA0", "#F0EEE8"].map((c) => (
            <View key={c} style={{ flex: 1, backgroundColor: c }} />
          ))}
        </View>
        <Text style={styles.hint}>{Math.round(max)} km/h</Text>
      </View>
      <View style={styles.grid}>
        <Stat label={t("lapLength")} value={`${profile.lengthKm.toFixed(2)} km`} />
        <Stat label={t("tdTop")} value={`${Math.round(profile.topSpeed)} km/h`} />
        <Stat label={t("tdAvg")} value={`${Math.round(profile.avgSpeed)} km/h`} />
        <Stat label={t("slowestCorner")} value={`${Math.round(profile.minSpeed)} km/h`} />
        <Stat label={t("tdFull")} value={`${Math.round(profile.fullThrottle)}%`} />
        <Stat label={t("brakingZones")} value={String(profile.zones)} />
        <Stat label={t("gearChanges")} value={String(profile.gearChanges)} />
        <Stat label={t("refLap")} value={formatLap(profile.lapTime)} />
      </View>
      <Text style={styles.hint}>{t("trackProfileNote", { driver: data.driver, year: data.season })}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.body}>{label}</Text>
        {note ? <Text style={styles.hint}>{note}</Text> : null}
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Leaderboard({ title, rows, note }: { title: string; rows: { name: string; count: number }[]; note?: string }) {
  if (!rows.length) return null;
  const max = rows[0].count;
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{title.toUpperCase()}</Text>
      {rows.map((r, i) => (
        <View key={r.name} style={styles.barRow}>
          <Text style={styles.barName} numberOfLines={1}>
            {r.name}
          </Text>
          <View style={styles.barTrack}>
            <View style={[styles.bar, { width: `${(r.count / max) * 100}%`, opacity: i === 0 ? 1 : 0.6 }]} />
          </View>
          <Text style={styles.barCount}>{r.count}</Text>
        </View>
      ))}
      {note ? <Text style={styles.hint}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  body: { color: colors.text, fontSize: 14 },
  verdict: { color: colors.text, fontSize: 17, fontWeight: "800", fontStyle: "italic" },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: {
    flexGrow: 1,
    flexBasis: "22%",
    minWidth: 120,
    backgroundColor: colors.cardActive,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: "800", fontFamily: fonts.mono },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  legend: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendBar: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden", flexDirection: "row" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border },
  rowValue: { color: colors.text, fontSize: 18, fontWeight: "800", fontFamily: fonts.mono },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barName: { width: 130, color: colors.text, fontSize: 13 },
  barTrack: { flex: 1, height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: "hidden" },
  bar: { height: "100%", backgroundColor: colors.accent, borderRadius: 5 },
  barCount: { width: 26, textAlign: "right", color: colors.text, fontFamily: fonts.mono, fontWeight: "700" },
  winRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  year: { width: 44, color: colors.accent, fontFamily: fonts.mono, fontWeight: "800" },
  chevron: { color: colors.muted, fontSize: 20 },
  link: { color: colors.accent, fontSize: 14, fontWeight: "700" },
});
