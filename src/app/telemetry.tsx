// ENGINEERING PROBLEM: "Telemetry duel".
// Pick a session and two drivers: their fastest laps are compared metre by
// metre (speed, throttle, brake, gear, gap) with real OpenF1 car data.
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  getCarData,
  getDrivers,
  getLaps,
  getLocation,
  getSessionResult,
  OF1Driver,
  OF1Session,
} from "@/api/openf1";
import { LoadState } from "@/components/LoadState";
import { Screen } from "@/components/Screen";
import { SessionPicker } from "@/components/SessionPicker";
import { COLOR_A, COLOR_B, LineChart, TrackMap } from "@/components/TelemetryCharts";
import {
  bestLap,
  buildTraces,
  delta,
  explain,
  formatLap,
  MINI_SECTORS,
  miniSectors,
  parseDate,
  STEP_M,
  summarise,
  trackPoints,
} from "@/lib/telemetry";
import { useAsync } from "@/lib/useAsync";
import { useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

export default function TelemetryScreen() {
  const { t } = useLang();
  return (
    <Screen title={t("telemetryDuel")} showBack>
      <Text style={styles.intro}>{t("telemetryDuelDesc")}</Text>
      <SessionPicker preferred="Qualifying">
        {(session) => <DriverPicker key={session.session_key} session={session} />}
      </SessionPicker>
      <Text style={styles.hint}>{t("tdSource")}</Text>
    </Screen>
  );
}

function DriverPicker({ session }: { session: OF1Session }) {
  const { t } = useLang();
  const drivers = useAsync(async () => {
    const list = await getDrivers(session.session_key);
    const unique = [...new Map(list.map((d) => [d.driver_number, d])).values()];
    let order: number[] = [];
    try {
      const result = await getSessionResult(session.session_key);
      order = result
        .filter((r) => r.position)
        .sort((a, b) => (a.position as number) - (b.position as number))
        .map((r) => r.driver_number);
    } catch {
      // no results: keep the list order
    }
    const rank = (n: number) => (order.indexOf(n) < 0 ? 99 : order.indexOf(n));
    return unique.sort((a, b) => rank(a.driver_number) - rank(b.driver_number));
  }, [session.session_key]);

  const [picked, setPicked] = useState<[number | null, number | null]>([null, null]);
  const [slot, setSlot] = useState<0 | 1>(0);

  if (!drivers.data) return <LoadState error={drivers.error} onRetry={drivers.retry} />;
  const list = drivers.data;
  const a = picked[0] ?? list[0]?.driver_number;
  const b = picked[1] ?? list[1]?.driver_number;
  const byNumber = (n: number | undefined) => list.find((d) => d.driver_number === n);

  const pick = (n: number) => {
    const next: [number | null, number | null] = [a, b];
    if (next[1 - slot] === n) return; // same driver on both sides makes no sense
    next[slot] = n;
    setPicked(next);
    setSlot(slot === 0 ? 1 : 0);
  };

  return (
    <>
      <Text style={styles.label}>{t("tdDrivers").toUpperCase()}</Text>
      <View style={styles.slots}>
        {[a, b].map((n, i) => (
          <Pressable
            key={i}
            onPress={() => setSlot(i as 0 | 1)}
            style={[styles.slot, { borderColor: slot === i ? (i === 0 ? COLOR_A : COLOR_B) : colors.border }]}
          >
            <View style={[styles.slotBar, { backgroundColor: i === 0 ? COLOR_A : COLOR_B }]} />
            <Text style={styles.slotName}>{byNumber(n)?.name_acronym ?? "–"}</Text>
            <Text style={styles.hint} numberOfLines={1}>{byNumber(n)?.team_name ?? ""}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.chips}>
        {list.map((d) => {
          const side = d.driver_number === a ? 0 : d.driver_number === b ? 1 : -1;
          return (
            <Pressable
              key={d.driver_number}
              onPress={() => pick(d.driver_number)}
              style={[styles.chip, side === 0 && { backgroundColor: COLOR_A, borderColor: COLOR_A }, side === 1 && { backgroundColor: COLOR_B, borderColor: COLOR_B }]}
            >
              <Text style={[styles.chipText, side === 0 && { color: colors.onAccent }, side === 1 && { color: colors.bg }]}>
                {d.name_acronym}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {a !== undefined && b !== undefined && (
        <Duel session={session} a={byNumber(a) as OF1Driver} b={byNumber(b) as OF1Driver} />
      )}
    </>
  );
}

function Duel({ session, a, b }: { session: OF1Session; a: OF1Driver; b: OF1Driver }) {
  const { t } = useLang();
  const [cursor, setCursor] = useState<number | null>(null);

  const { data, error, retry } = useAsync(async () => {
    const key = session.session_key;
    const lapA = bestLap(await getLaps(key, a.driver_number));
    const lapB = bestLap(await getLaps(key, b.driver_number));
    if (!lapA || !lapB) return { missing: true as const };
    const end = (l: typeof lapA) => new Date(parseDate(l.date_start as string) + (l.lap_duration as number) * 1000 + 500).toISOString();
    const carA = await getCarData(key, a.driver_number, lapA.date_start as string, end(lapA));
    const carB = await getCarData(key, b.driver_number, lapB.date_start as string, end(lapB));
    const locA = await getLocation(key, a.driver_number, lapA.date_start as string, end(lapA));
    const traces = buildTraces({ lap: lapA, data: carA }, { lap: lapB, data: carB });
    if (!traces) return { missing: true as const };
    return { missing: false as const, lapA, lapB, traces, locA };
  }, [session.session_key, a.driver_number, b.driver_number]);

  const analysis = useMemo(() => {
    if (!data || data.missing) return null;
    const [ta, tb] = data.traces;
    const gap = delta(ta, tb);
    const sectors = miniSectors(ta, tb);
    return { ta, tb, gap, sectors, summary: summarise(ta, tb), track: trackPoints(data.locA, data.lapA, ta) };
  }, [data]);

  if (!data) return <LoadState error={error} onRetry={retry} message={t("tdLoading")} />;
  if (data.missing || !analysis) return <Text style={styles.body}>{t("tdNoLap")}</Text>;

  const { ta, tb, gap, sectors, summary, track } = analysis;
  const diff = tb.lapTime - ta.lapTime;
  const faster = diff >= 0 ? a : b;
  const sectorLen = ta.length / MINI_SECTORS;
  const sectorColor = (d: number) => {
    const s = sectors[Math.min(Math.floor(d / sectorLen), MINI_SECTORS - 1)];
    return s.gain >= 0 ? COLOR_A : COLOR_B;
  };
  const top = [...sectors].sort((x, y) => Math.abs(y.gain) - Math.abs(x.gain)).slice(0, 4);
  const reasonText = (s: (typeof sectors)[number]) => {
    const winner = s.gain >= 0 ? "A" : "B";
    const name = (winner === "A" ? a : b).name_acronym;
    const r = explain(s, winner);
    if (r.kind === "lateBraking") return t("tdReason_lateBraking", { name, n: r.metres });
    if (r.kind === "cornerSpeed") return t("tdReason_cornerSpeed", { name, n: r.kmh });
    if (r.kind === "straightSpeed") return t("tdReason_straightSpeed", { name, n: r.kmh });
    return t("tdReason_traction", { name });
  };
  const at = (arr: number[]) => (cursor === null ? "" : Math.round(arr[Math.min(cursor, arr.length - 1)]).toString());
  const pair = (x: string, y: string) => (cursor === null ? undefined : `${a.name_acronym} ${x} · ${b.name_acronym} ${y}`);
  const gapAt = cursor === null ? undefined : `${t("tdAt", { m: cursor * STEP_M })}: ${(gap[Math.min(cursor, gap.length - 1)] >= 0 ? a : b).name_acronym} +${Math.abs(gap[Math.min(cursor, gap.length - 1)]).toFixed(3)} s`;

  return (
    <>
      {/* Headline */}
      <View style={[styles.card, { borderColor: colors.accent }]}>
        <Text style={styles.verdict}>{t("tdFaster", { name: faster.name_acronym, s: Math.abs(diff).toFixed(3) })}</Text>
        <View style={styles.twoCol}>
          {[
            { d: a, lap: data.lapA, c: COLOR_A },
            { d: b, lap: data.lapB, c: COLOR_B },
          ].map(({ d, lap, c }) => (
            <View key={d.driver_number} style={styles.lapBox}>
              <View style={[styles.slotBar, { backgroundColor: c }]} />
              <Text style={styles.slotName}>{d.name_acronym}</Text>
              <Text style={styles.big}>{formatLap(lap.lap_duration as number)}</Text>
              <Text style={styles.hint}>
                {t("lapWord")} {lap.lap_number}
                {lap.st_speed ? ` · ${t("tdTrap")} ${lap.st_speed} km/h` : ""}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.hint}>{t("tdLapNote")}</Text>
      </View>

      {/* Track map */}
      {track.length > 10 && (
        <View style={styles.card}>
          <Text style={styles.label}>{t("tdTrackMap").toUpperCase()}</Text>
          <TrackMap points={track} sectorColor={sectorColor} cursorDistance={cursor === null ? null : cursor * STEP_M} />
          <View style={styles.legend}>
            <Legend color={COLOR_A} text={a.name_acronym} />
            <Legend color={COLOR_B} text={b.name_acronym} />
          </View>
          <Text style={styles.hint}>{t("tdTrackNote")}</Text>
        </View>
      )}

      <Text style={styles.hint}>{t("tdCursorHint")}</Text>
      <LineChart title={t("tdDelta")} series={[{ values: gap, color: colors.amber }]} zeroLine cursor={cursor} onCursor={setCursor} readout={gapAt} height={90} />
      <Text style={styles.hint}>{t("tdDeltaNote", { a: a.name_acronym, b: b.name_acronym })}</Text>
      <LineChart
        title={t("tdSpeed")}
        series={[{ values: tb.speed, color: COLOR_B }, { values: ta.speed, color: COLOR_A }]}
        height={150}
        cursor={cursor}
        onCursor={setCursor}
        readout={pair(at(ta.speed), at(tb.speed))}
      />
      <LineChart
        title={t("tdThrottle")}
        series={[{ values: tb.throttle, color: COLOR_B }, { values: ta.throttle, color: COLOR_A }]}
        min={0}
        max={100}
        height={70}
        cursor={cursor}
        onCursor={setCursor}
        readout={pair(at(ta.throttle), at(tb.throttle))}
      />
      <LineChart
        title={t("tdBrake")}
        series={[{ values: tb.brake.map((v) => v * 0.9), color: COLOR_B }, { values: ta.brake, color: COLOR_A }]}
        min={0}
        max={100}
        step
        height={50}
        cursor={cursor}
        onCursor={setCursor}
      />
      <LineChart
        title={t("tdGear")}
        series={[{ values: tb.gear, color: COLOR_B }, { values: ta.gear, color: COLOR_A }]}
        min={1}
        max={8}
        step
        height={70}
        cursor={cursor}
        onCursor={setCursor}
        readout={pair(at(ta.gear), at(tb.gear))}
      />

      {/* Where the time is won */}
      <View style={styles.card}>
        <Text style={styles.label}>{t("tdWhere").toUpperCase()}</Text>
        {top.map((s) => (
          <Pressable key={s.index} style={styles.reasonRow} onPress={() => setCursor(Math.round((s.from + s.to) / 2 / STEP_M))}>
            <View style={[styles.reasonDot, { backgroundColor: s.gain >= 0 ? COLOR_A : COLOR_B }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.body}>{reasonText(s)}</Text>
              <Text style={styles.hint}>
                {Math.round(s.from)}–{Math.round(s.to)} m · +{Math.abs(s.gain).toFixed(3)} s
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Numbers */}
      <View style={styles.card}>
        <Text style={styles.label}>{t("tdStats").toUpperCase()}</Text>
        <StatRow label={t("tdTop")} a={summary.topSpeed[0]} b={summary.topSpeed[1]} unit=" km/h" />
        <StatRow label={t("tdAvg")} a={summary.avgSpeed[0]} b={summary.avgSpeed[1]} unit=" km/h" />
        <StatRow label={t("tdFull")} a={summary.fullThrottle[0]} b={summary.fullThrottle[1]} unit="%" />
        <StatRow label={t("tdBraking")} a={summary.braking[0]} b={summary.braking[1]} unit="%" />
      </View>
    </>
  );
}

function StatRow({ label, a, b, unit }: { label: string; a: number; b: number; unit: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statVal, { color: COLOR_A }]}>{Math.round(a)}{unit}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statVal, { color: COLOR_B, textAlign: "right" }]}>{Math.round(b)}{unit}</Text>
    </View>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.reasonDot, { backgroundColor: color }]} />
      <Text style={styles.hint}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  label: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  hint: { color: colors.muted, fontSize: 12 },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  big: { color: colors.text, fontSize: 22, fontWeight: "800", fontFamily: fonts.mono },
  verdict: { color: colors.text, fontSize: 18, fontWeight: "800", fontStyle: "italic" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  chipText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  chipTextOn: { color: colors.onAccent },
  slots: { flexDirection: "row", gap: 10 },
  slot: { flex: 1, backgroundColor: colors.card, borderRadius: 12, borderWidth: 2, padding: 10, gap: 2 },
  slotBar: { width: 28, height: 4, borderRadius: 2, transform: [{ skewX: "-20deg" }] },
  slotName: { color: colors.text, fontSize: 20, fontWeight: "900", fontStyle: "italic" },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  twoCol: { flexDirection: "row", gap: 12 },
  lapBox: { flex: 1, gap: 2 },
  legend: { flexDirection: "row", gap: 16, justifyContent: "center" },
  legendItem: { flexDirection: "row", gap: 6, alignItems: "center" },
  reasonRow: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 4 },
  reasonDot: { width: 10, height: 10, borderRadius: 5 },
  statRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border },
  statVal: { width: 90, fontFamily: fonts.mono, fontSize: 14, fontWeight: "700" },
  statLabel: { flex: 1, color: colors.muted, fontSize: 12, textAlign: "center" },
});
