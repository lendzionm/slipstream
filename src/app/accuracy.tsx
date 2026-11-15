// MODEL ACCURACY (backtest): replays the model on the last 10 races, using only
// the data it would have had before each race, and compares it with reality.
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { RaceCheck, runBacktest, summarise } from "@/lib/backtest";
import { useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

const RACES_TO_TEST = 10;
const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function AccuracyScreen() {
  const { t } = useLang();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [checks, setChecks] = useState<RaceCheck[] | null>(null);
  const [failed, setFailed] = useState(false);

  const run = async () => {
    setFailed(false);
    setChecks(null);
    setProgress({ done: 0, total: RACES_TO_TEST });
    try {
      const result = await runBacktest(RACES_TO_TEST, (done, total) => setProgress({ done, total }));
      setChecks(result);
    } catch {
      setFailed(true);
    }
    setProgress(null);
  };

  const s = checks ? summarise(checks) : null;

  return (
    <Screen title={t("accuracyTitle")} showBack>
      <Text style={styles.intro}>{t("accuracyIntro")}</Text>

      {!checks && !progress && (
        <Pressable style={styles.button} onPress={run}>
          <Text style={styles.buttonText}>{t("runTest")}</Text>
        </Pressable>
      )}
      {failed && <Text style={styles.hint}>{t("error")}</Text>}

      {progress && (
        <View style={styles.progress}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.hint}>
            {t("runningTest", { x: Math.min(progress.done + 1, progress.total), n: progress.total })}
          </Text>
        </View>
      )}

      {s && checks && (
        <>
          <View style={styles.card}>
            <Text style={styles.label}>{t("winnerCorrect").toUpperCase()}</Text>
            <Compare model={pct(s.modelWinnerRate)} baseline={pct(s.baselineWinnerRate)}
              better={s.modelWinnerRate >= s.baselineWinnerRate} />
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>{t("podiumCorrect").toUpperCase()}</Text>
            <Compare model={s.modelPodiumAvg.toFixed(1)} baseline={s.baselinePodiumAvg.toFixed(1)}
              better={s.modelPodiumAvg >= s.baselinePodiumAvg} />
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>{t("winnerChance").toUpperCase()}</Text>
            <Text style={styles.big}>{pct(s.avgWinnerProbability)}</Text>
            <Text style={styles.hint}>{t("randomGuess", { x: Math.round(s.randomGuess * 100) })}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{t("perRace").toUpperCase()}</Text>
            {checks.map((c) => {
              const hit = c.modelTop3[0] === c.winnerId;
              const podium = c.modelTop3.filter((x) => c.actualTop3.includes(x)).length;
              return (
                <View key={`${c.season}-${c.round}`} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.raceName}>{c.raceName}</Text>
                    <Text style={styles.hint}>
                      {t("modelPick")}: {c.names[c.modelTop3[0]] ?? "?"} · {t("actualWinner")}: {c.names[c.winnerId] ?? "?"}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.mark, { color: hit ? colors.live : colors.amber }]}>{hit ? "✓" : "✕"}</Text>
                    <Text style={styles.hint}>
                      {podium}/3 {t("podiumShort")}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={styles.hint}>{t("backtestNote")}</Text>
          <Pressable onPress={run}>
            <Text style={styles.link}>↺ {t("runTest")}</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

function Compare({ model, baseline, better }: { model: string; baseline: string; better: boolean }) {
  const { t } = useLang();
  return (
    <View style={styles.compare}>
      <View style={styles.compareBox}>
        <Text style={[styles.big, { color: better ? colors.live : colors.text }]}>{model}</Text>
        <Text style={styles.hint}>{t("modelName")}</Text>
      </View>
      <View style={styles.compareBox}>
        <Text style={[styles.big, { color: colors.muted }]}>{baseline}</Text>
        <Text style={styles.hint}>{t("baselineName")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  label: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  link: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  button: { backgroundColor: colors.accentFill, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  buttonText: { color: colors.onAccent, fontWeight: "800" },
  progress: { alignItems: "center", gap: 8, marginTop: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  big: { color: colors.text, fontSize: 28, fontWeight: "800", fontFamily: fonts.mono },
  compare: { flexDirection: "row", gap: 12 },
  compareBox: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  raceName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  mark: { fontSize: 18, fontWeight: "800" },
});
