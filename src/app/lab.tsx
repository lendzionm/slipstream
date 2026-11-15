// WHAT-IF LAB: change the car (downforce, power, weight, tyres), pick a track type,
// and see the estimated effect on lap time, from the mini simulator in src/lib/lapSim.ts.
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { applyChanges, Changes, Compound, NO_CHANGES, simulateLap, TRACKS } from "@/lib/lapSim";
import { TextKey, useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

const signed = (x: number, digits = 2) => `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x).toFixed(digits)}`;

const formatLap = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
};

export default function LabScreen() {
  const { t } = useLang();
  const [trackId, setTrackId] = useState("balanced");
  const [changes, setChanges] = useState<Changes>(NO_CHANGES);

  const track = TRACKS.find((x) => x.id === trackId) ?? TRACKS[0];
  const base = simulateLap(applyChanges(NO_CHANGES), track);
  const now = simulateLap(applyChanges(changes), track);
  const delta = now.lapTime - base.lapTime;
  const cornerDelta = now.cornerTime - base.cornerTime;
  const straightDelta = now.straightTime - base.straightTime;
  const changed = JSON.stringify(changes) !== JSON.stringify(NO_CHANGES);

  const set = (patch: Partial<Changes>) => setChanges({ ...changes, ...patch });
  const dir = (x: number) => (x <= 0 ? t("faster") : t("slower"));

  return (
    <Screen title={t("whatIfLab")} showBack>
      <Text style={styles.intro}>{t("labIntro")}</Text>

      {/* Track */}
      <View style={styles.card}>
        <Text style={styles.label}>{t("track").toUpperCase()}</Text>
        <Segmented
          options={TRACKS.map((x) => ({ key: x.id, label: t(`track_${x.id}` as TextKey) }))}
          value={trackId}
          onChange={setTrackId}
        />
        <Text style={styles.hint}>{t(`trackDesc_${track.id}` as TextKey)}</Text>
      </View>

      {/* Car settings */}
      <View style={styles.card}>
        <Stepper label={t("downforce")} value={changes.downforcePct} unit="%" step={5} min={-30} max={30}
          onChange={(v) => set({ downforcePct: v })} />
        <Stepper label={t("power")} value={changes.powerPct} unit="%" step={5} min={-20} max={20}
          onChange={(v) => set({ powerPct: v })} />
        <Stepper label={t("carWeight")} value={changes.weightKg} unit=" kg" step={5} min={-30} max={30}
          onChange={(v) => set({ weightKg: v })} />
        <Text style={styles.stepLabel}>{t("tyres")}</Text>
        <Segmented<Compound>
          options={[
            { key: "S", label: t("soft") },
            { key: "M", label: t("medium") },
            { key: "H", label: t("hard") },
          ]}
          value={changes.compound}
          onChange={(compound) => set({ compound })}
        />
        {changed && (
          <Pressable onPress={() => setChanges(NO_CHANGES)}>
            <Text style={styles.link}>↺ {t("reset")}</Text>
          </Pressable>
        )}
      </View>

      {/* Result */}
      <View style={[styles.card, { borderColor: changed ? (delta <= 0 ? colors.live : colors.amber) : colors.border }]}>
        <Text style={styles.label}>{t("lapTime").toUpperCase()}</Text>
        <View style={styles.resultRow}>
          <Text style={[styles.delta, { color: !changed ? colors.text : delta <= 0 ? colors.live : colors.amber }]}>
            {signed(delta, 3)} s
          </Text>
          <View>
            <Text style={styles.lap}>{formatLap(now.lapTime)}</Text>
            <Text style={styles.hint}>
              {t("baseline")} {formatLap(base.lapTime)}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label={t("topSpeed")} value={`${now.topSpeed.toFixed(0)} km/h`} change={now.topSpeed - base.topSpeed} />
          <Stat label={t("slowestCorner")} value={`${now.minSpeed.toFixed(0)} km/h`} change={now.minSpeed - base.minSpeed} />
        </View>
        <View style={styles.statsRow}>
          <Stat label={t("inCorners")} value={`${signed(cornerDelta)} s`} />
          <Stat label={t("onStraights")} value={`${signed(straightDelta)} s`} />
        </View>

        {!changed ? (
          <Text style={styles.hint}>{t("noChange")}</Text>
        ) : (
          <View style={{ gap: 4 }}>
            {Math.abs(cornerDelta) >= 0.01 && (
              <Text style={styles.insight}>• {t("insightCorners", { x: Math.abs(cornerDelta).toFixed(2), dir: dir(cornerDelta) })}</Text>
            )}
            {Math.abs(straightDelta) >= 0.01 && (
              <Text style={styles.insight}>
                • {t("insightStraights", { x: Math.abs(straightDelta).toFixed(2), dir: dir(straightDelta), speed: now.topSpeed.toFixed(0) })}
              </Text>
            )}
            {changes.downforcePct !== 0 && Math.sign(cornerDelta) !== Math.sign(straightDelta) && (
              <Text style={styles.insight}>• {t("insightTradeoff")}</Text>
            )}
            {changes.weightKg > 0 && <Text style={styles.insight}>• {t("insightWeight")}</Text>}
          </View>
        )}
      </View>

      {/* Same changes on all three tracks */}
      {changed && (
        <View style={styles.card}>
          <Text style={styles.label}>{t("sameSetup").toUpperCase()}</Text>
          {TRACKS.map((tr) => {
            const d = simulateLap(applyChanges(changes), tr).lapTime - simulateLap(applyChanges(NO_CHANGES), tr).lapTime;
            return (
              <View key={tr.id} style={styles.trackRow}>
                <Text style={styles.trackName}>{t(`track_${tr.id}` as TextKey)}</Text>
                <Text style={[styles.trackDelta, { color: d <= 0 ? colors.live : colors.amber }]}>{signed(d)} s</Text>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.hint}>{t("labNote")}</Text>
    </Screen>
  );
}

function Stepper(props: {
  label: string;
  value: number;
  unit: string;
  step: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const { value, step, min, max } = props;
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>{props.label}</Text>
      <View style={styles.stepControls}>
        <Pressable style={styles.stepButton} onPress={() => props.onChange(Math.max(min, value - step))} disabled={value <= min}>
          <Text style={[styles.stepButtonText, value <= min && styles.dim]}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>
          {value > 0 ? "+" : ""}
          {value}
          {props.unit}
        </Text>
        <Pressable style={styles.stepButton} onPress={() => props.onChange(Math.min(max, value + step))} disabled={value >= max}>
          <Text style={[styles.stepButtonText, value >= max && styles.dim]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ label, value, change }: { label: string; value: string; change?: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {change !== undefined && Math.abs(change) >= 0.5 && (
        <Text style={[styles.statChange, { color: change > 0 ? colors.live : colors.amber }]}>
          {change > 0 ? "+" : "−"}
          {Math.abs(change).toFixed(0)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  label: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  link: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
  stepControls: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  stepButtonText: { color: colors.accent, fontSize: 20, fontWeight: "700" },
  dim: { color: colors.border },
  stepValue: { width: 64, textAlign: "center", color: colors.text, fontSize: 15, fontWeight: "700", fontFamily: fonts.mono },
  resultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  delta: { fontSize: 34, fontWeight: "800", fontFamily: fonts.mono },
  lap: { color: colors.text, fontSize: 18, fontWeight: "700", fontFamily: fonts.mono, textAlign: "right" },
  statsRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, backgroundColor: colors.bg, borderRadius: 10, padding: 10 },
  statLabel: { color: colors.muted, fontSize: 11 },
  statValue: { color: colors.text, fontSize: 15, fontWeight: "700", fontFamily: fonts.mono, marginTop: 2 },
  statChange: { fontSize: 11, fontFamily: fonts.mono, marginTop: 1 },
  insight: { color: colors.text, fontSize: 13, lineHeight: 19 },
  trackRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  trackName: { color: colors.text, fontSize: 14 },
  trackDelta: { fontSize: 14, fontWeight: "700", fontFamily: fonts.mono },
});
