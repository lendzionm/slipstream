// ENGINEERING PROBLEM: "Tyre degradation & pit window".
// Learns tyre wear from a real race, then finds the fastest strategy and the
// pit window. The maths is in src/lib/tyres.ts.
import { useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { getDrivers, getLaps, getRaceControl, getSessionResult, getStints, OF1Session } from "@/api/openf1";
import { LoadState } from "@/components/LoadState";
import { Screen } from "@/components/Screen";
import { SessionPicker } from "@/components/SessionPicker";
import { neutralPeriods, TYRE_COLOR, TYRE_LETTER } from "@/lib/replay";
import { parseDate } from "@/lib/telemetry";
import {
  actualStrategy,
  bestPlans,
  cleanLaps,
  CompoundModel,
  FUEL_EFFECT,
  fitCompounds,
  pitLoss,
  strategyTime,
  wearCurve,
} from "@/lib/tyres";
import { useAsync } from "@/lib/useAsync";
import { useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

const FONT = "Arial, Helvetica, sans-serif";

export default function TyresScreen() {
  const { t } = useLang();
  return (
    <Screen title={t("tyresTitle")} showBack>
      <Text style={styles.intro}>{t("tyresDesc")}</Text>
      <SessionPicker sessionNames={["Race"]} preferred="Race">
        {(session) => <Analysis key={session.session_key} session={session} />}
      </SessionPicker>
      <Text style={styles.hint}>{t("tyresSource", { fuel: FUEL_EFFECT })}</Text>
    </Screen>
  );
}

function Analysis({ session }: { session: OF1Session }) {
  const { t } = useLang();
  const { data, error, retry } = useAsync(async () => {
    const key = session.session_key;
    const laps = await getLaps(key);
    const stints = await getStints(key);
    const control = await getRaceControl(key).catch(() => []);
    const result = await getSessionResult(key).catch(() => []);
    const drivers = await getDrivers(key).catch(() => []);
    return { laps, stints, control, result, drivers };
  }, [session.session_key]);

  const model = useMemo(() => {
    if (!data) return null;
    const neutral = neutralPeriods(data.control, parseDate(session.date_end));
    const clean = cleanLaps(data.laps, data.stints, neutral);
    const models = fitCompounds(clean);
    const loss = pitLoss(data.laps, data.stints, neutral);
    const raceLaps = Math.max(0, ...data.laps.map((l) => l.lap_number));
    const plans = models.length >= 2 && loss ? bestPlans(models, raceLaps, loss) : null;
    const winner = data.result.find((r) => r.position === 1)?.driver_number;
    const winnerName = data.drivers.find((d) => d.driver_number === winner)?.name_acronym ?? "";
    const winnerPlan = winner ? actualStrategy(data.stints, winner) : [];
    const winnerTime = loss ? strategyTime(models, winnerPlan, loss) : null;
    return { clean, models, loss, raceLaps, plans, winnerName, winnerPlan, winnerTime };
  }, [data, session.date_end]);

  if (!data || !model) return <LoadState error={error} onRetry={retry} message={t("tyresLoading")} />;
  const { models, loss, plans } = model;

  if (models.length === 0) return <Text style={styles.body}>{t("tyresNoData")}</Text>;
  const best = plans && plans.oneStop && plans.twoStop ? (plans.oneStop.total <= plans.twoStop.total ? plans.oneStop : plans.twoStop) : plans?.oneStop ?? plans?.twoStop ?? null;
  const goodWindow = plans?.window.filter((w) => w.delta !== null && w.delta <= 1) ?? [];

  return (
    <>
      {/* Wear per compound */}
      <View style={styles.card}>
        <Text style={styles.label}>{t("tyreWear").toUpperCase()}</Text>
        {models.map((m) => (
          <View key={m.compound} style={styles.compRow}>
            <Tyre compound={m.compound} />
            <View style={{ flex: 1 }}>
              <Text style={styles.body}>
                <Text style={styles.strong}>+{m.slope.toFixed(3)} s</Text> {t("perLap")}
                {m.offset > 0.005 ? ` · ${t("newTyrePace", { s: m.offset.toFixed(2) })}` : ` · ${t("fastestNew")}`}
              </Text>
              <Text style={styles.hint}>{t("evidence", { laps: m.laps, stints: m.stints })}</Text>
            </View>
          </View>
        ))}
        <WearChart clean={model.clean} models={models} slow={t("chartSlow")} fast={t("chartFast")} />
        <Text style={styles.hint}>{t("wearChartNote")}</Text>
      </View>

      {/* Pit loss */}
      <View style={[styles.card, styles.row]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{t("pitLossLabel").toUpperCase()}</Text>
          <Text style={styles.hint}>{t("pitLossNote")}</Text>
        </View>
        <Text style={styles.big}>{loss ? `${loss.toFixed(1)} s` : "–"}</Text>
      </View>

      {/* Best strategy */}
      {best && plans ? (
        <View style={[styles.card, { borderColor: colors.accent }]}>
          <Text style={styles.label}>{t("bestStrategy").toUpperCase()}</Text>
          <Text style={styles.verdict}>
            {t(best.stopLaps.length === 1 ? "oneStopBest" : "twoStopBest", { laps: best.stopLaps.join(" & ") })}
          </Text>
          <PlanBar stints={best.stints} total={model.raceLaps} />
          {plans.oneStop && plans.twoStop && (
            <>
              <Text style={styles.hint}>{t(best === plans.oneStop ? "alternativeTwo" : "alternativeOne", { s: Math.abs(plans.twoStop.total - plans.oneStop.total).toFixed(1) })}</Text>
              <PlanBar stints={(best === plans.oneStop ? plans.twoStop : plans.oneStop).stints} total={model.raceLaps} faded />
            </>
          )}
        </View>
      ) : (
        <Text style={styles.body}>{t("tyresNoStrategy")}</Text>
      )}

      {/* Pit window */}
      {plans?.oneStop && goodWindow.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>{t("pitWindow").toUpperCase()}</Text>
          <Text style={styles.body}>
            {t("pitWindowText", {
              a: TYRE_LETTER[plans.oneStop.stints[0].compound],
              b: TYRE_LETTER[plans.oneStop.stints[1].compound],
              from: goodWindow[0].lap,
              to: goodWindow[goodWindow.length - 1].lap,
            })}
          </Text>
          <WindowChart window={plans.window} best={plans.oneStop.stopLaps[0]} />
          <Text style={styles.hint}>{t("pitWindowNote")}</Text>
        </View>
      )}

      {/* Winner comparison */}
      {model.winnerPlan.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>{t("winnerDid", { name: model.winnerName }).toUpperCase()}</Text>
          <PlanBar stints={model.winnerPlan} total={model.raceLaps} />
          <Text style={styles.body}>
            {model.winnerTime !== null && best
              ? model.winnerTime - best.total < 0.5
                ? t("winnerOptimal")
                : t("winnerSlower", { s: (model.winnerTime - best.total).toFixed(1) })
              : t("winnerUnknown")}
          </Text>
          <Text style={styles.hint}>{t("winnerNote")}</Text>
        </View>
      )}
    </>
  );
}

function Tyre({ compound, size = 26 }: { compound: string; size?: number }) {
  const c = TYRE_COLOR[compound] ?? colors.muted;
  return (
    <View style={[styles.tyre, { width: size, height: size, borderRadius: size / 2, borderColor: c }]}>
      <Text style={[styles.tyreText, { color: c, fontSize: size * 0.42 }]}>{TYRE_LETTER[compound] ?? "?"}</Text>
    </View>
  );
}

function PlanBar({ stints, total, faded }: { stints: { compound: string; laps: number }[]; total: number; faded?: boolean }) {
  let lap = 0;
  return (
    <View style={[styles.planBar, faded && { opacity: 0.55 }]}>
      {stints.map((s, i) => {
        const from = lap + 1;
        lap += s.laps;
        return (
          <View key={i} style={[styles.planStint, { flex: s.laps / total, backgroundColor: TYRE_COLOR[s.compound] ?? colors.muted }]}>
            <Text style={styles.planText} numberOfLines={1}>
              {TYRE_LETTER[s.compound] ?? "?"} {from}–{lap}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function useWidth() {
  const [w, setW] = useState(0);
  return { w, onLayout: (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width) };
}

function WearChart({ clean, models, slow, fast }: { clean: ReturnType<typeof cleanLaps>; models: CompoundModel[]; slow: string; fast: string }) {
  const { w, onLayout } = useWidth();
  const h = 170;
  const curves = models.map((m) => {
    const pts = wearCurve(clean, m.compound).filter((p) => p.age <= m.maxStint);
    const sorted = pts.map((p) => p.delta - m.slope * p.age).sort((a, b) => a - b);
    const intercept = sorted.length ? sorted[sorted.length >> 1] : 0;
    return { m, pts, intercept };
  });
  const all = curves.flatMap((c) => c.pts);
  if (all.length < 3) return null;
  const maxAge = Math.max(...all.map((p) => p.age));
  const lo = Math.min(...all.map((p) => p.delta)) - 0.2;
  const hi = Math.max(...all.map((p) => p.delta)) + 0.2;
  const L = 30, B = 18;
  const x = (age: number) => L + (age / maxAge) * (w - L - 6);
  const y = (d: number) => 6 + (1 - (d - lo) / (hi - lo)) * (h - B - 6);
  return (
    <View onLayout={onLayout} style={{ height: h }}>
      {w > 0 && (
        <Svg width={w} height={h}>
          <Line x1={L} x2={w} y1={h - B} y2={h - B} stroke={colors.border} />
          {[0, Math.round(maxAge / 2), maxAge].map((a) => (
            <SvgText key={a} x={x(a)} y={h - 4} fill={colors.muted} fontSize={10} textAnchor="middle" fontFamily={FONT}>
              {a}
            </SvgText>
          ))}
          <SvgText x={2} y={y(hi - 0.2) + 4} fill={colors.muted} fontSize={10} fontFamily={FONT}>{slow}</SvgText>
          <SvgText x={2} y={y(lo + 0.2)} fill={colors.muted} fontSize={10} fontFamily={FONT}>{fast}</SvgText>
          {curves.map(({ m, pts, intercept }) => {
            const c = TYRE_COLOR[m.compound];
            const last = Math.max(...pts.map((p) => p.age), 1);
            return (
              <Polyline
                key={`l${m.compound}`}
                points={`${x(1)},${y(intercept + m.slope)} ${x(last)},${y(intercept + m.slope * last)}`}
                stroke={c}
                strokeWidth={2}
                fill="none"
              />
            );
          })}
          {curves.flatMap(({ m, pts }) =>
            pts.map((p) => <Circle key={`${m.compound}${p.age}`} cx={x(p.age)} cy={y(p.delta)} r={2.5} fill={TYRE_COLOR[m.compound]} opacity={0.7} />),
          )}
        </Svg>
      )}
    </View>
  );
}

function WindowChart({ window, best }: { window: { lap: number; delta: number | null }[]; best: number }) {
  const { w, onLayout } = useWidth();
  const h = 120;
  const valid = window.filter((p) => p.delta !== null) as { lap: number; delta: number }[];
  if (valid.length < 3) return null;
  const cap = 10; // show up to 10 s slower
  const first = window[0].lap, last = window[window.length - 1].lap;
  const B = 16;
  const x = (lap: number) => ((lap - first) / (last - first)) * w;
  const y = (d: number) => h - B - 4 - (Math.min(d, cap) / cap) * (h - B - 8); // 0 s lost at the bottom
  const good = valid.filter((p) => p.delta <= 1);
  return (
    <View onLayout={onLayout} style={{ height: h }}>
      {w > 0 && (
        <Svg width={w} height={h}>
          {good.length > 0 && (
            <Rect x={x(good[0].lap)} y={0} width={Math.max(x(good[good.length - 1].lap) - x(good[0].lap), 2)} height={h - B} fill={colors.live} opacity={0.15} />
          )}
          <Polyline points={valid.map((p) => `${x(p.lap).toFixed(1)},${y(p.delta).toFixed(1)}`).join(" ")} stroke={colors.accent} strokeWidth={2} fill="none" />
          <Circle cx={x(best)} cy={y(0)} r={5} fill={colors.live} />
          {[first, best, last].map((l) => (
            <SvgText key={l} x={Math.min(Math.max(x(l), 8), w - 8)} y={h - 3} fill={colors.muted} fontSize={10} textAnchor="middle" fontFamily={FONT}>
              {l}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  label: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  strong: { fontWeight: "800", fontFamily: fonts.mono },
  big: { color: colors.text, fontSize: 24, fontWeight: "800", fontFamily: fonts.mono },
  verdict: { color: colors.text, fontSize: 17, fontWeight: "800", fontStyle: "italic", lineHeight: 23 },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  compRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  tyre: { borderWidth: 3, alignItems: "center", justifyContent: "center" },
  tyreText: { fontWeight: "900" },
  planBar: { flexDirection: "row", gap: 3, height: 26 },
  planStint: { borderRadius: 5, justifyContent: "center", paddingHorizontal: 6, minWidth: 34 },
  planText: { color: colors.bg, fontWeight: "800", fontSize: 11, fontFamily: fonts.mono },
});
