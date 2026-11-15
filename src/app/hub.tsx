// RACE-WEEKEND HUB: this weekend's sessions with status, and for each finished
// session: results, weather, tyre strategy (with compounds) and key race-control
// messages. Data from OpenF1 (free data appears ~30 min after a session ends).
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  getDrivers,
  getRaceControl,
  getSessionResult,
  getSessions,
  getStints,
  getWeather,
  OF1Driver,
  OF1Session,
} from "@/api/openf1";
import { Countdown } from "@/components/Countdown";
import { LoadState } from "@/components/LoadState";
import { Screen } from "@/components/Screen";
import { TYRE_COLORS } from "@/content/engineering";
import { useAsync } from "@/lib/useAsync";
import {
  defaultSession,
  keyMessages,
  pickWeekend,
  resultLabel,
  sessionStatus,
  SessionStatus,
  weatherSummary,
} from "@/lib/weekend";
import { TextKey, useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: TYRE_COLORS.S,
  MEDIUM: TYRE_COLORS.M,
  HARD: TYRE_COLORS.H,
  INTERMEDIATE: "#34D399",
  WET: "#60A5FA",
};

const SESSION_KEYS: Record<string, TextKey> = {
  "Practice 1": "fp1",
  "Practice 2": "fp2",
  "Practice 3": "fp3",
  "Sprint Qualifying": "sprintQuali",
  "Sprint Shootout": "sprintQuali",
  Sprint: "sprint",
  Qualifying: "quali",
  Race: "race",
};

const STATUS_SYMBOL: Record<SessionStatus, string> = { upcoming: "◷", live: "●", processing: "…", done: "✓" };

function useSessionName() {
  const { t } = useLang();
  return (s: OF1Session) => (SESSION_KEYS[s.session_name] ? t(SESSION_KEYS[s.session_name]) : s.session_name);
}

export default function HubScreen() {
  const { t } = useLang();
  const sessionName = useSessionName();
  const year = new Date().getFullYear();
  const { data: sessions, error, retry } = useAsync(async () => {
    const thisYear = await getSessions(year);
    return thisYear.length ? thisYear : getSessions(year - 1);
  }, [year]);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!sessions) {
    return (
      <Screen title={t("hubTitle")} showBack>
        <LoadState error={error} onRetry={retry} />
      </Screen>
    );
  }

  const weekend = pickWeekend(sessions, now);
  const selected = weekend.find((s) => s.session_key === selectedKey) ?? defaultSession(weekend, now);

  return (
    <Screen
      title={t("hubTitle")}
      subtitle={weekend[0] ? `${weekend[0].location} · ${weekend[0].country_name}` : undefined}
      showBack
    >
      {weekend.length === 0 && <Text style={styles.hint}>{t("noWeekend")}</Text>}

      <View style={styles.chips}>
        {weekend.map((s) => {
          const on = s.session_key === selected?.session_key;
          const status = sessionStatus(s, now);
          return (
            <Pressable key={s.session_key} onPress={() => setSelectedKey(s.session_key)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn, status === "live" && !on && { color: colors.live }]}>
                {STATUS_SYMBOL[status]} {sessionName(s)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selected && <SessionPanel key={selected.session_key} session={selected} now={now} />}
      <Text style={styles.hint}>{t("hubDataNote")}</Text>
    </Screen>
  );
}

function SessionPanel({ session, now }: { session: OF1Session; now: number }) {
  const { t, locale } = useLang();
  const sessionName = useSessionName();
  const status = sessionStatus(session, now);
  const start = new Date(session.date_start);
  const isRace = session.session_type === "Race";

  return (
    <>
      <View style={styles.card}>
        <Text style={[styles.label, status === "live" && { color: colors.live }]}>
          {t(`status_${status}` as TextKey).toUpperCase()}
        </Text>
        <Text style={styles.title}>{sessionName(session)}</Text>
        <Text style={styles.hint}>
          {start.toLocaleString(locale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
        </Text>
        {status === "upcoming" && (
          <>
            <Countdown target={start} />
            <Text style={styles.hint}>{t("resultsLater")}</Text>
          </>
        )}
        {(status === "live" || status === "processing") && <Text style={styles.body}>{t("liveRestricted")}</Text>}
      </View>

      {status === "done" && (
        <>
          <ResultsSection sessionKey={session.session_key} />
          <WeatherSection sessionKey={session.session_key} />
          {isRace && <StintsSection sessionKey={session.session_key} />}
          <RaceControlSection sessionKey={session.session_key} />
        </>
      )}
    </>
  );
}

function driverMap(drivers: OF1Driver[]) {
  const map = new Map<number, OF1Driver>();
  for (const d of drivers) map.set(d.driver_number, d);
  return map;
}

function ResultsSection({ sessionKey }: { sessionKey: number }) {
  const { t } = useLang();
  const { data, error, retry } = useAsync(async () => {
    const [results, drivers] = [await getSessionResult(sessionKey), await getDrivers(sessionKey)];
    return { results, drivers: driverMap(drivers) };
  }, [sessionKey]);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t("sessionResults").toUpperCase()}</Text>
      {!data ? (
        <LoadState error={error} onRetry={retry} />
      ) : data.results.length === 0 ? (
        <Text style={styles.hint}>{t("noResults")}</Text>
      ) : (
        [...data.results]
          .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
          .map((r) => {
            const d = data.drivers.get(r.driver_number);
            return (
              <View key={r.driver_number} style={styles.row}>
                <Text style={styles.pos}>{r.position ?? "–"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{d ? `${d.first_name} ${d.last_name}` : `#${r.driver_number}`}</Text>
                  <Text style={styles.hint}>{d?.team_name ?? ""}</Text>
                </View>
                <Text style={styles.time}>{resultLabel(r)}</Text>
              </View>
            );
          })
      )}
    </View>
  );
}

function WeatherSection({ sessionKey }: { sessionKey: number }) {
  const { t } = useLang();
  const { data, error, retry } = useAsync(() => getWeather(sessionKey), [sessionKey]);
  const w = data ? weatherSummary(data) : null;
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t("weather").toUpperCase()}</Text>
      {!data ? (
        <LoadState error={error} onRetry={retry} />
      ) : !w ? (
        <Text style={styles.hint}>{t("noResults")}</Text>
      ) : (
        <View style={styles.weatherGrid}>
          <WeatherBox label={t("airTemp")} value={`${w.air.toFixed(0)}°C`} />
          <WeatherBox label={t("trackTemp")} value={`${w.track.toFixed(0)}°C`} />
          <WeatherBox label={t("humidity")} value={`${w.humidity.toFixed(0)}%`} />
          <WeatherBox label={t("maxWind")} value={`${w.wind.toFixed(1)} m/s`} />
          <WeatherBox label={t("rain")} value={w.rain ? t("yes") : t("no")} highlight={w.rain} />
        </View>
      )}
    </View>
  );
}

function WeatherBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.weatherBox}>
      <Text style={styles.hint}>{label}</Text>
      <Text style={[styles.weatherValue, highlight && { color: colors.amber }]}>{value}</Text>
    </View>
  );
}

function StintsSection({ sessionKey }: { sessionKey: number }) {
  const { t } = useLang();
  const { data, error, retry } = useAsync(async () => {
    const [stints, results, drivers] = [
      await getStints(sessionKey),
      await getSessionResult(sessionKey),
      await getDrivers(sessionKey),
    ];
    return { stints, results, drivers: driverMap(drivers) };
  }, [sessionKey]);

  if (!data) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>{t("tyreStrategy").toUpperCase()}</Text>
        <LoadState error={error} onRetry={retry} />
      </View>
    );
  }

  const top10 = [...data.results]
    .filter((r) => r.position !== null)
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
    .slice(0, 10);
  const totalLaps = Math.max(...data.stints.map((s) => s.lap_end ?? 0), 1);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t("tyreStrategy").toUpperCase()}</Text>
      {top10.map((r) => {
        const stints = data.stints
          .filter((s) => s.driver_number === r.driver_number)
          .sort((a, b) => a.stint_number - b.stint_number);
        return (
          <View key={r.driver_number} style={styles.stintRow}>
            <Text style={styles.stintName}>
              P{r.position} {data.drivers.get(r.driver_number)?.name_acronym ?? r.driver_number}
            </Text>
            <View style={[styles.stintTrack, { width: `${(r.number_of_laps / totalLaps) * 72}%` }]}>
              {stints.map((s) => (
                <View
                  key={s.stint_number}
                  style={[styles.stint, { flex: Math.max(1, (s.lap_end ?? s.lap_start) - s.lap_start + 1), backgroundColor: COMPOUND_COLORS[s.compound] ?? colors.muted }]}
                >
                  <Text style={styles.stintText}>{s.compound?.[0] ?? "?"}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
      <Text style={styles.hint}>{t("tyreLegend")}</Text>
    </View>
  );
}

function RaceControlSection({ sessionKey }: { sessionKey: number }) {
  const { t, locale } = useLang();
  const { data, error, retry } = useAsync(() => getRaceControl(sessionKey), [sessionKey]);
  const messages = data ? keyMessages(data) : [];
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t("raceControl").toUpperCase()}</Text>
      {!data ? (
        <LoadState error={error} onRetry={retry} />
      ) : messages.length === 0 ? (
        <Text style={styles.hint}>{t("noKeyMessages")}</Text>
      ) : (
        messages.slice(0, 15).map((m, i) => (
          <View key={i} style={styles.msgRow}>
            <Text style={styles.msgTime}>
              {m.lap_number ? `L${m.lap_number}` : new Date(m.date).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
            </Text>
            <Text style={[styles.msg, (m.flag === "RED" || m.category === "SafetyCar") && { color: colors.amber }]}>{m.message}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  label: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  chipText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  chipTextOn: { color: colors.onAccent },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pos: { width: 24, color: colors.text, fontSize: 15, fontWeight: "700", fontFamily: fonts.mono, textAlign: "right" },
  name: { color: colors.text, fontSize: 14, fontWeight: "600" },
  time: { color: colors.text, fontSize: 13, fontFamily: fonts.mono },
  weatherGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  weatherBox: { flexGrow: 1, flexBasis: 90, backgroundColor: colors.bg, borderRadius: 10, padding: 10 },
  weatherValue: { color: colors.text, fontSize: 18, fontWeight: "700", fontFamily: fonts.mono, marginTop: 2 },
  stintRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stintName: { width: 70, color: colors.text, fontSize: 12, fontFamily: fonts.mono },
  stintTrack: { flexDirection: "row", gap: 2, height: 20 },
  stint: { justifyContent: "center", alignItems: "center", borderRadius: 3 },
  stintText: { color: colors.bg, fontSize: 10, fontWeight: "800", fontFamily: fonts.mono },
  msgRow: { flexDirection: "row", gap: 10, paddingVertical: 4 },
  msgTime: { width: 44, color: colors.muted, fontSize: 12, fontFamily: fonts.mono },
  msg: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18 },
});
