// RACE RESULTS page, e.g. /race/2026/5
// Top: summary stats (winner, pole, fastest lap, biggest climber, retirements).
// Below: full Race / Qualifying / Sprint classification.
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  getQualifying,
  getRaceResults,
  getSprintResults,
  QualifyingResult,
  RaceResult,
} from "@/api/jolpica";
import { LoadState } from "@/components/LoadState";
import { Screen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import {
  bestQualiTime,
  driverName,
  isClassified,
  positionChange,
  raceStats,
  resultTime,
} from "@/lib/raceStats";
import { useAsync } from "@/lib/useAsync";
import { TextKey, useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

type Tab = "race" | "quali" | "sprint";

export default function RaceResultsScreen() {
  const { season, round } = useLocalSearchParams<{ season: string; round: string }>();
  const { t, locale } = useLang();
  const [tab, setTab] = useState<Tab>("race");

  const { data, error, retry } = useAsync(async () => {
    const [race, quali, sprint] = await Promise.all([
      getRaceResults(season, round),
      getQualifying(season, round),
      getSprintResults(season, round).catch(() => [] as RaceResult[]),
    ]);
    return { race, quali, sprint };
  }, [season, round]);

  if (!data) {
    return (
      <Screen title={t("results")} showBack>
        <LoadState error={error} onRetry={retry} />
      </Screen>
    );
  }

  const results = data.race?.Results ?? [];
  const stats = raceStats(results, data.quali);
  const date = data.race
    ? new Date(data.race.date).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
    : season;

  const tabs: { key: Tab; label: string }[] = [
    { key: "race", label: t("race") },
    { key: "quali", label: t("quali") },
  ];
  if (data.sprint.length > 0) tabs.push({ key: "sprint", label: t("sprint") });

  return (
    <Screen
      title={data.race?.raceName ?? `${t("round")} ${round}`}
      subtitle={`${t("round")} ${round} · ${date}`}
      showBack
    >
      {data.race?.Circuit && (
        <Pressable onPress={() => router.push({ pathname: "/circuit/[id]", params: { id: data.race!.Circuit.circuitId } })}>
          <Text style={styles.circuitLink}>
            {data.race.Circuit.circuitName} · {t("circuitGuide")} ›
          </Text>
        </Pressable>
      )}
      {results.length === 0 ? (
        <Text style={styles.message}>{t("noResults")}</Text>
      ) : (
        <View style={styles.statsGrid}>
          <StatCard
            label="winner"
            value={stats.winner ? driverName(stats.winner.Driver) : "–"}
            detail={stats.winner ? `${stats.winner.Constructor.name} · ${resultTime(stats.winner)}` : ""}
          />
          <StatCard
            label="pole"
            value={stats.pole ? driverName(stats.pole.Driver) : "–"}
            detail={stats.pole ? bestQualiTime(stats.pole) : ""}
          />
          <StatCard
            label="fastestLap"
            value={stats.fastest ? driverName(stats.fastest.Driver) : "–"}
            detail={stats.fastest?.FastestLap?.Time?.time ?? ""}
          />
          <StatCard
            label="mostGained"
            value={stats.climber ? driverName(stats.climber.result.Driver) : "–"}
            detail={
              stats.climber
                ? `▲ ${stats.climber.gained} ${t("places")} (P${stats.climber.result.grid} → P${stats.climber.result.position})`
                : ""
            }
          />
          <StatCard
            label="retirements"
            value={String(stats.retirements.length)}
            detail={stats.retirements.map((r) => r.Driver.code ?? r.Driver.familyName).join(", ")}
            wide
          />
        </View>
      )}

      <Segmented options={tabs} value={tab} onChange={setTab} />

      <View style={styles.table}>
        {tab === "race" && results.map((r) => <ResultRow key={r.Driver.driverId} r={r} leaderLaps={Number(results[0]?.laps)} />)}
        {tab === "sprint" && data.sprint.map((r) => <ResultRow key={r.Driver.driverId} r={r} leaderLaps={Number(data.sprint[0]?.laps)} />)}
        {tab === "quali" && data.quali.map((q) => <QualiRow key={q.Driver.driverId} q={q} />)}
        {tab === "quali" && data.quali.length === 0 && <Text style={styles.message}>{t("noResults")}</Text>}
      </View>
    </Screen>
  );
}

function StatCard({ label, value, detail, wide }: { label: TextKey; value: string; detail: string; wide?: boolean }) {
  const { t } = useLang();
  return (
    <View style={[styles.statCard, wide && styles.statWide]}>
      <Text style={styles.statLabel}>{t(label).toUpperCase()}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      {detail ? <Text style={styles.statDetail}>{detail}</Text> : null}
    </View>
  );
}

function ResultRow({ r, leaderLaps }: { r: RaceResult; leaderLaps?: number }) {
  const { t } = useLang();
  const change = positionChange(r);
  const fastest = r.FastestLap?.rank === "1";
  return (
    <View style={styles.row}>
      <Text style={styles.pos}>{isClassified(r) ? r.positionText : "–"}</Text>
      <View style={styles.rowMain}>
        <Text style={styles.rowName}>
          {driverName(r.Driver)}
          {change ? (
            <Text style={{ color: change > 0 ? colors.live : colors.amber }}>
              {"  "}
              {change > 0 ? "▲" : "▼"}
              {Math.abs(change)}
            </Text>
          ) : null}
        </Text>
        <Text style={styles.rowSub}>
          {r.Constructor.name}
          {fastest ? `  ·  ⏱ ${t("fastestLap")}` : ""}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.time, !isClassified(r) && styles.dnf]}>{resultTime(r, leaderLaps)}</Text>
        {Number(r.points) > 0 && <Text style={styles.points}>+{r.points}</Text>}
      </View>
    </View>
  );
}

function QualiRow({ q }: { q: QualifyingResult }) {
  const sessions = [
    ["Q1", q.Q1],
    ["Q2", q.Q2],
    ["Q3", q.Q3],
  ].filter(([, time]) => time);
  return (
    <View style={styles.row}>
      <Text style={styles.pos}>{q.position}</Text>
      <View style={styles.rowMain}>
        <Text style={styles.rowName}>{driverName(q.Driver)}</Text>
        <Text style={styles.rowSub}>{q.Constructor.name}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.time}>{bestQualiTime(q)}</Text>
        <Text style={styles.qualiParts}>{sessions.map(([name]) => name).join(" · ")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  message: { color: colors.muted, fontSize: 15, textAlign: "center", marginTop: 8 },
  circuitLink: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 3,
  },
  statWide: { flexBasis: "100%" },
  statLabel: { color: colors.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  statValue: { color: colors.text, fontSize: 16, fontWeight: "700" },
  statDetail: { color: colors.muted, fontSize: 12, fontFamily: fonts.mono },
  table: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pos: { width: 26, color: colors.text, fontSize: 16, fontWeight: "700", fontFamily: fonts.mono, textAlign: "right" },
  rowMain: { flex: 1 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  rowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rowRight: { alignItems: "flex-end" },
  time: { color: colors.text, fontSize: 13, fontFamily: fonts.mono },
  dnf: { color: colors.amber },
  points: { color: colors.accent, fontSize: 12, fontWeight: "700", marginTop: 2 },
  qualiParts: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
