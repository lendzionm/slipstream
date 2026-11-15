// RACE REPLAY: watch any race since 2023 on a live track map with a running
// order, gaps, tyres and safety-car periods. See src/lib/replay.ts for how
// cars are placed on the map.
import { useEffect, useMemo, useState } from "react";
import { GestureResponderEvent, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Polyline, Rect, Text as SvgText } from "react-native-svg";
import {
  getDrivers,
  getLaps,
  getLocation,
  getRaceControl,
  getSessionResult,
  getStints,
  OF1Driver,
  OF1Session,
  OF1Stint,
} from "@/api/openf1";
import { LoadState } from "@/components/LoadState";
import { Screen } from "@/components/Screen";
import { Chips, SessionPicker } from "@/components/SessionPicker";
import {
  buildTimelines,
  DriverTimeline,
  Neutral,
  neutralPeriods,
  PathPoint,
  pointAt,
  progressAt,
  referencePath,
  standingsAt,
  TYRE_COLOR,
  TYRE_LETTER,
  tyreAt,
} from "@/lib/replay";
import { bestLap, parseDate } from "@/lib/telemetry";
import { useAsync } from "@/lib/useAsync";
import { useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

const SPEEDS = [10, 30, 60, 120];
const TICK_MS = 100;

export default function ReplayScreen() {
  const { t } = useLang();
  return (
    <Screen title={t("replayTitle")} showBack>
      <Text style={styles.intro}>{t("replayDesc")}</Text>
      <SessionPicker sessionNames={["Race", "Sprint"]} preferred="Race">
        {(session) => <Replay key={session.session_key} session={session} />}
      </SessionPicker>
      <Text style={styles.hint}>{t("replaySource")}</Text>
    </Screen>
  );
}

type ReplayData = {
  timelines: DriverTimeline[];
  path: PathPoint[];
  start: number; // ms, lights out
  finish: number; // ms, last car over the line
  retired: Set<number>;
  totalLaps: number;
  drivers: Map<number, OF1Driver>;
  stints: OF1Stint[];
  neutral: Neutral[];
};

function Replay({ session }: { session: OF1Session }) {
  const { t } = useLang();
  const { data, error, retry } = useAsync(async (): Promise<ReplayData | "missing"> => {
    const key = session.session_key;
    const drivers = await getDrivers(key);
    const laps = await getLaps(key);
    const result = await getSessionResult(key).catch(() => []);
    const stints = await getStints(key).catch(() => []);
    const control = await getRaceControl(key).catch(() => []);
    const timelines = buildTimelines(laps);
    if (timelines.length < 2) return "missing";

    // Reference lap for the map: the winner's fastest lap (or anyone's).
    const winner = result.find((r) => r.position === 1)?.driver_number;
    const ref = bestLap(laps.filter((l) => l.driver_number === winner)) ?? bestLap(laps);
    if (!ref) return "missing";
    const end = new Date(parseDate(ref.date_start as string) + (ref.lap_duration as number) * 1000 + 500).toISOString();
    const loc = await getLocation(key, ref.driver_number, ref.date_start as string, end);
    const path = referencePath(loc, ref.date_start as string, ref.lap_duration as number);
    if (path.length < 20) return "missing";

    const start = Math.min(...timelines.map((d) => d.starts[0]));
    const finish = Math.max(...timelines.map((d) => d.end));
    const retired = new Set(result.filter((r) => r.dnf || r.dns || r.dsq).map((r) => r.driver_number));
    const totalLaps = Math.max(...timelines.map((d) => d.laps));
    const uniqueDrivers = new Map<number, OF1Driver>(drivers.map((d) => [d.driver_number, d]));
    return { timelines, path, start, finish, retired, totalLaps, drivers: uniqueDrivers, stints, neutral: neutralPeriods(control, finish) };
  }, [session.session_key]);

  if (!data) return <LoadState error={error} onRetry={retry} message={t("replayLoading")} />;
  if (data === "missing") return <Text style={styles.hint}>{t("replayMissing")}</Text>;
  return <Player {...data} />;
}

function Player(p: ReplayData) {
  const { t } = useLang();
  const [T, setT] = useState(p.start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(30);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setT((now) => {
        const next = now + TICK_MS * speed;
        if (next >= p.finish) {
          setPlaying(false);
          return p.finish;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, speed, p.finish]);

  const order = standingsAt(p.timelines, T, p.retired);
  const leaderLap = Math.min(Math.floor(order[0]?.progress ?? 0) + 1, p.totalLaps);
  const neutral = p.neutral.find((n) => T >= n.from && T < n.to);
  const colorOf = (n: number) => {
    const c = p.drivers.get(n)?.team_colour;
    return c ? `#${c}` : colors.muted;
  };
  const code = (n: number) => p.drivers.get(n)?.name_acronym ?? String(n);

  return (
    <>
      <View style={[styles.card, neutral && { borderColor: neutral.kind === "RED" ? colors.accent : colors.amber }]}>
        <View style={styles.topRow}>
          <Text style={styles.lap}>
            {t("lapWord").toUpperCase()} {leaderLap}/{p.totalLaps}
          </Text>
          {neutral && (
            <View style={[styles.flag, { backgroundColor: neutral.kind === "RED" ? colors.accentFill : colors.amber }]}>
              <Text style={styles.flagText}>{t(neutral.kind === "SC" ? "scFlag" : neutral.kind === "VSC" ? "vscFlag" : "redFlag")}</Text>
            </View>
          )}
        </View>
        <ReplayMap
          path={p.path}
          cars={order
            .filter((r) => !r.out)
            .map((r) => {
              const tl = p.timelines.find((d) => d.number === r.number)!;
              return {
                number: r.number,
                label: code(r.number),
                color: colorOf(r.number),
                pos: pointAt(p.path, progressAt(tl, T)),
                showLabel: r.position <= 3 || r.number === selected,
                big: r.number === selected,
              };
            })}
        />
        <Scrubber value={(T - p.start) / (p.finish - p.start)} onChange={(f) => setT(p.start + f * (p.finish - p.start))} marks={p.neutral.map((n) => ({ from: (n.from - p.start) / (p.finish - p.start), to: (n.to - p.start) / (p.finish - p.start), red: n.kind === "RED" }))} />
        <View style={styles.controls}>
          <Pressable
            style={styles.play}
            onPress={() => {
              if (T >= p.finish) setT(p.start);
              setPlaying(!playing);
            }}
          >
            <Text style={styles.playText}>{playing ? "❚❚" : "▶"}</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Chips items={SPEEDS.map((s) => ({ key: String(s), label: `${s}×` }))} value={String(speed)} onPick={(k) => setSpeed(Number(k))} />
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t("runningOrder").toUpperCase()}</Text>
        {order.map((r) => {
          const tyre = tyreAt(p.stints, r.number, Math.max(1, Math.ceil(r.progress)));
          const on = r.number === selected;
          return (
            <Pressable key={r.number} onPress={() => setSelected(on ? null : r.number)} style={[styles.row, on && styles.rowOn, r.out && { opacity: 0.45 }]}>
              <Text style={styles.pos}>{r.position}</Text>
              <View style={[styles.teamBar, { backgroundColor: colorOf(r.number) }]} />
              <Text style={styles.code}>{code(r.number)}</Text>
              {tyre ? (
                <View style={[styles.tyre, { borderColor: TYRE_COLOR[tyre] ?? colors.muted }]}>
                  <Text style={[styles.tyreText, { color: TYRE_COLOR[tyre] ?? colors.muted }]}>{TYRE_LETTER[tyre] ?? "?"}</Text>
                </View>
              ) : (
                <View style={styles.tyre} />
              )}
              <Text style={styles.gap}>{r.gap === "LEADER" ? t("leader") : r.gap === "OUT" ? t("out") : r.gap}</Text>
            </Pressable>
          );
        })}
        <Text style={styles.hint}>{t("replayTapHint")}</Text>
      </View>
    </>
  );
}

function ReplayMap(props: {
  path: { x: number; y: number }[];
  cars: { number: number; label: string; color: string; pos: { x: number; y: number }; showLabel: boolean; big: boolean }[];
}) {
  const [width, setWidth] = useState(0);
  const height = 280;
  const view = useMemo(() => {
    const xs = props.path.map((q) => q.x), ys = props.path.map((q) => q.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }, [props.path]);
  const pad = 18;
  const scale = Math.min((width - pad * 2) / (view.maxX - view.minX || 1), (height - pad * 2) / (view.maxY - view.minY || 1));
  const offX = (width - (view.maxX - view.minX) * scale) / 2;
  const offY = (height - (view.maxY - view.minY) * scale) / 2;
  const px = (v: number) => offX + (v - view.minX) * scale;
  const py = (v: number) => offY + (view.maxY - v) * scale;
  const outline = useMemo(
    () => (width ? props.path.map((q) => `${px(q.x).toFixed(1)},${py(q.y).toFixed(1)}`).join(" ") : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, props.path],
  );
  const start = props.path[0];
  // draw the leader last so it sits on top
  const cars = [...props.cars].reverse();

  return (
    <View style={{ height }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Polyline points={outline} fill="none" stroke={colors.border} strokeWidth={10} strokeLinejoin="round" />
          <Polyline points={outline} fill="none" stroke={colors.cardActive} strokeWidth={6} strokeLinejoin="round" />
          <Rect x={px(start.x) - 5} y={py(start.y) - 5} width={10} height={10} fill={colors.checkerLight} />
          {cars.map((c) => (
            <G key={c.number}>
              <Circle cx={px(c.pos.x)} cy={py(c.pos.y)} r={c.big ? 8 : 5.5} fill={c.color} stroke={c.big ? colors.text : colors.bg} strokeWidth={c.big ? 2 : 1.5} />
              {c.showLabel && (
                <SvgText x={px(c.pos.x) + 9} y={py(c.pos.y) - 7} fill={colors.text} fontSize={11} fontWeight="bold" fontFamily="Arial, Helvetica, sans-serif">
                  {c.label}
                </SvgText>
              )}
            </G>
          ))}
        </Svg>
      )}
    </View>
  );
}

function Scrubber(props: { value: number; onChange: (f: number) => void; marks: { from: number; to: number; red: boolean }[] }) {
  const [width, setWidth] = useState(0);
  const move = (e: GestureResponderEvent) => width && props.onChange(Math.min(Math.max(e.nativeEvent.locationX / width, 0), 1));
  return (
    <View
      style={styles.scrub}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={move}
      onResponderMove={move}
    >
      <View style={styles.scrubTrack} pointerEvents="none">
        {props.marks.map((m, i) => (
          <View key={i} style={[styles.scrubMark, { left: `${m.from * 100}%`, width: `${Math.max((m.to - m.from) * 100, 0.6)}%`, backgroundColor: m.red ? colors.accent : colors.amber }]} />
        ))}
        <View style={[styles.scrubFill, { width: `${props.value * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[styles.scrubKnob, { left: `${props.value * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  label: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  hint: { color: colors.muted, fontSize: 12 },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lap: { color: colors.text, fontSize: 18, fontWeight: "900", fontStyle: "italic", fontFamily: fonts.mono },
  flag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  flagText: { color: colors.bg, fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  controls: { flexDirection: "row", alignItems: "center", gap: 10 },
  play: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentFill, alignItems: "center", justifyContent: "center" },
  playText: { color: colors.onAccent, fontSize: 16, fontWeight: "900" },
  scrub: { height: 28, justifyContent: "center" },
  scrubTrack: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" },
  scrubFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: colors.accent, opacity: 0.85 },
  scrubMark: { position: "absolute", top: 0, bottom: 0, opacity: 0.9 },
  scrubKnob: { position: "absolute", width: 16, height: 16, marginLeft: -8, borderRadius: 8, backgroundColor: colors.text, borderWidth: 3, borderColor: colors.accentFill },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 8 },
  rowOn: { backgroundColor: colors.cardActive, borderWidth: 1, borderColor: colors.accent },
  pos: { width: 22, color: colors.muted, fontFamily: fonts.mono, fontSize: 13, textAlign: "right" },
  teamBar: { width: 4, height: 18, borderRadius: 2 },
  code: { width: 44, color: colors.text, fontWeight: "800", fontSize: 14 },
  tyre: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  tyreText: { fontSize: 10, fontWeight: "900" },
  gap: { flex: 1, textAlign: "right", color: colors.text, fontFamily: fonts.mono, fontSize: 13 },
});
