// ENGINEERING PROBLEM: "Which strategy worked best?"
// Uses real pit-stop data from a finished race: groups drivers by number of
// stops, compares places gained, shows the winner's strategy, the fastest
// stop and a stint timeline for the top 10.
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getPitStops, getRaceResults, getSchedule } from "@/api/jolpica";
import { LoadState } from "@/components/LoadState";
import { Screen } from "@/components/Screen";
import { driverName } from "@/lib/raceStats";
import { isRaceFinished } from "@/lib/sessions";
import { analyseStrategy, stintLengths } from "@/lib/strategy";
import { useAsync } from "@/lib/useAsync";
import { useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

const STINT_COLORS = ["#FF3B3B", "#E9E9EE", "#FFB020", "#9C9CA7", "#5B8DEF"];

export default function StrategyScreen() {
  const { t } = useLang();
  const schedule = useAsync(() => getSchedule("current"), []);
  const [round, setRound] = useState<string | null>(null);

  if (!schedule.data) {
    return (
      <Screen title={t("strategyProblem")} showBack>
        <LoadState error={schedule.error} onRetry={schedule.retry} />
      </Screen>
    );
  }

  const finished = schedule.data.filter((r) => isRaceFinished(r, Date.now())).reverse().slice(0, 6);
  const selected = finished.find((r) => r.round === round) ?? finished[0];

  return (
    <Screen title={t("strategyProblem")} showBack>
      <Text style={styles.label}>{t("chooseRace").toUpperCase()}</Text>
      <View style={styles.chips}>
        {finished.map((r) => {
          const on = r.round === selected?.round;
          return (
            <Pressable key={r.round} onPress={() => setRound(r.round)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{r.raceName.replace(" Grand Prix", " GP")}</Text>
            </Pressable>
          );
        })}
      </View>
      {selected ? <Analysis season={selected.season} round={selected.round} /> : <Text style={styles.body}>{t("noResults")}</Text>}
    </Screen>
  );
}

function Analysis({ season, round }: { season: string; round: string }) {
  const { t } = useLang();
  const { data, error, retry } = useAsync(async () => {
    const race = await getRaceResults(season, round);
    const pitStops = await getPitStops(season, round);
    return { results: race?.Results ?? [], pitStops };
  }, [season, round]);

  if (!data) return <LoadState error={error} onRetry={retry} />;
  if (data.results.length === 0) return <Text style={styles.body}>{t("noResults")}</Text>;
  if (data.pitStops.length === 0) return <Text style={styles.body}>{t("noPitData")}</Text>;

  const a = analyseStrategy(data.results, data.pitStops);
  const nameOf = (id: string) => {
    const d = data.results.find((r) => r.Driver.driverId === id)?.Driver;
    return d ? driverName(d) : id;
  };
  const top10 = a.finishers.slice(0, 10);

  return (
    <>
      {/* Verdict */}
      <View style={[styles.card, { borderColor: colors.accent }]}>
        <Text style={styles.label}>{t("verdict").toUpperCase()}</Text>
        <Text style={styles.verdict}>
          {a.best
            ? t("verdictText", { n: a.best.stops, x: (a.best.avgGained as number).toFixed(1) })
            : t("verdictNone")}
        </Text>
        <Text style={styles.hint}>{t("caveat")}</Text>
      </View>

      {/* Strategy groups */}
      <View style={styles.card}>
        <Text style={styles.label}>{t("strategies").toUpperCase()}</Text>
        {a.groups.map((g) => (
          <View key={g.stops} style={[styles.groupRow, a.best?.stops === g.stops && styles.groupBest]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.groupTitle}>{t("stopsN", { n: g.stops })}</Text>
              <Text style={styles.hint}>
                {t("driversN", { n: g.drivers.length })} · {t("bestFinish")} P{g.bestFinish}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.big, { color: (g.avgGained ?? 0) >= 0 ? colors.live : colors.amber }]}>
                {g.avgGained === null ? "–" : `${g.avgGained >= 0 ? "+" : ""}${g.avgGained.toFixed(1)}`}
              </Text>
              <Text style={styles.hint}>{t("avgGained")}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Winner + fastest stop */}
      <View style={styles.twoCol}>
        <View style={[styles.card, styles.half]}>
          <Text style={styles.label}>{t("winnerStrategy").toUpperCase()}</Text>
          <Text style={styles.body}>
            {a.winner
              ? a.winner.stopLaps.length
                ? t("stoppedOnLaps", { name: driverName(a.winner.result.Driver), laps: a.winner.stopLaps.join(", ") })
                : t("noStops", { name: driverName(a.winner.result.Driver) })
              : "–"}
          </Text>
        </View>
        <View style={[styles.card, styles.half]}>
          <Text style={styles.label}>{t("fastestStop").toUpperCase()}</Text>
          {a.fastest ? (
            <>
              <Text style={styles.big}>{a.fastest.seconds.toFixed(1)} s</Text>
              <Text style={styles.body}>{nameOf(a.fastest.stop.driverId)}</Text>
              <Text style={styles.hint}>{t("pitLaneTime", { lap: a.fastest.stop.lap })}</Text>
            </>
          ) : (
            <Text style={styles.body}>–</Text>
          )}
        </View>
      </View>

      {/* Stint timeline */}
      <View style={styles.card}>
        <Text style={styles.label}>{t("stintsTop10").toUpperCase()}</Text>
        {top10.map((d) => {
          const laps = Number(d.result.laps) || a.totalLaps;
          const stints = stintLengths(d.stopLaps, laps);
          return (
            <View key={d.result.Driver.driverId} style={styles.stintRow}>
              <Text style={styles.stintName}>
                P{d.result.position} {d.result.Driver.code ?? d.result.Driver.familyName}
              </Text>
              <View style={[styles.stintTrack, { width: `${(laps / (a.totalLaps || laps)) * 75}%` }]}>
                {stints.map((len, i) => (
                  <View key={i} style={[styles.stint, { flex: len, backgroundColor: STINT_COLORS[i % STINT_COLORS.length] }]}>
                    <Text style={styles.stintText}>{len}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
        <Text style={styles.hint}>{t("stintNote")}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  hint: { color: colors.muted, fontSize: 12 },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  big: { color: colors.text, fontSize: 24, fontWeight: "800", fontFamily: fonts.mono },
  verdict: { color: colors.text, fontSize: 17, fontWeight: "700", lineHeight: 24 },
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
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  groupBest: { borderColor: colors.live },
  groupTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  twoCol: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  half: { flexGrow: 1, flexBasis: 220 },
  stintRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stintName: { width: 70, color: colors.text, fontSize: 12, fontFamily: fonts.mono },
  stintTrack: { flexDirection: "row", gap: 2, height: 20 },
  stint: { justifyContent: "center", alignItems: "center", borderRadius: 3 },
  stintText: { color: colors.bg, fontSize: 10, fontWeight: "700", fontFamily: fonts.mono },
});
