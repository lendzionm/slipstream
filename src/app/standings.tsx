// STANDINGS screen (second tab).
// Drivers: championship table with points, gap to the leader and wins.
// Teams:   constructors' championship.
// Races:   every finished race of the season; tap one for full results.
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getConstructorStandings, getDriverStandings, getSchedule } from "@/api/jolpica";
import { LoadState } from "@/components/LoadState";
import { Screen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { openRaceResults } from "@/lib/openRace";
import { driverName } from "@/lib/raceStats";
import { isRaceFinished } from "@/lib/sessions";
import { useAsync } from "@/lib/useAsync";
import { useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

type Tab = "drivers" | "teams" | "races";

export default function StandingsScreen() {
  const { t, locale } = useLang();
  const [tab, setTab] = useState<Tab>("drivers");

  const { data, error, retry } = useAsync(async () => {
    const [drivers, teams, schedule] = await Promise.all([
      getDriverStandings(),
      getConstructorStandings(),
      getSchedule("current"),
    ]);
    return { drivers, teams, schedule };
  }, []);

  if (!data) {
    return (
      <Screen title={t("tabStandings")}>
        <LoadState error={error} onRetry={retry} />
      </Screen>
    );
  }

  const now = Date.now();
  const finished = data.schedule.filter((r) => isRaceFinished(r, now)).reverse();
  const driverLeader = Number(data.drivers.list[0]?.points ?? 0);
  const teamLeader = Number(data.teams.list[0]?.points ?? 0);

  return (
    <Screen title={`${t("tabStandings")} ${data.drivers.season}`}>
      <Segmented
        options={[
          { key: "drivers", label: t("drivers") },
          { key: "teams", label: t("teams") },
          { key: "races", label: t("races") },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "drivers" && (
        <View style={styles.table}>
          {data.drivers.list.length === 0 && <Text style={styles.message}>{t("noStandings")}</Text>}
          {data.drivers.list.map((s) => (
            <StandingRow
              key={s.Driver.driverId}
              position={s.positionText}
              name={driverName(s.Driver)}
              sub={`${s.Constructors[s.Constructors.length - 1]?.name ?? ""} · ${s.wins} ${t("wins")}`}
              points={Number(s.points)}
              leaderPoints={driverLeader}
            />
          ))}
        </View>
      )}

      {tab === "teams" && (
        <View style={styles.table}>
          {data.teams.list.length === 0 && <Text style={styles.message}>{t("noStandings")}</Text>}
          {data.teams.list.map((s) => (
            <StandingRow
              key={s.Constructor.constructorId}
              position={s.positionText}
              name={s.Constructor.name}
              sub={`${s.wins} ${t("wins")}`}
              points={Number(s.points)}
              leaderPoints={teamLeader}
            />
          ))}
        </View>
      )}

      {tab === "races" && (
        <View style={styles.table}>
          {finished.length === 0 && <Text style={styles.message}>{t("noResults")}</Text>}
          {finished.map((race) => (
            <Pressable
              key={race.round}
              style={styles.row}
              onPress={() => openRaceResults(race.season, race.round)}
            >
              <Text style={styles.pos}>R{race.round}</Text>
              <View style={styles.rowMain}>
                <Text style={styles.name}>{race.raceName}</Text>
                <Text style={styles.sub}>
                  {new Date(race.date).toLocaleDateString(locale, { day: "numeric", month: "long" })} ·{" "}
                  {race.Circuit.Location.locality}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

// One line in a championship table, with a bar showing points compared to the leader.
function StandingRow(props: {
  position: string;
  name: string;
  sub: string;
  points: number;
  leaderPoints: number;
}) {
  const { t } = useLang();
  const gap = props.leaderPoints - props.points;
  const share = props.leaderPoints > 0 ? props.points / props.leaderPoints : 0;
  return (
    <View style={styles.row}>
      <Text style={styles.pos}>{props.position}</Text>
      <View style={styles.rowMain}>
        <Text style={styles.name}>{props.name}</Text>
        <Text style={styles.sub}>{props.sub}</Text>
        <View style={styles.barTrack}>
          <View style={[styles.bar, { width: `${Math.round(share * 100)}%` }]} />
        </View>
      </View>
      <View style={styles.right}>
        <Text style={styles.points}>
          {props.points} <Text style={styles.ptsLabel}>{t("pts")}</Text>
        </Text>
        <Text style={styles.gap}>{gap > 0 ? `−${gap}` : "—"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  message: { color: colors.muted, fontSize: 15, textAlign: "center", padding: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pos: { width: 32, color: colors.text, fontSize: 16, fontWeight: "700", fontFamily: fonts.mono, textAlign: "right" },
  rowMain: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 15, fontWeight: "600" },
  sub: { color: colors.muted, fontSize: 12 },
  barTrack: { height: 3, backgroundColor: colors.border, borderRadius: 2, marginTop: 4, overflow: "hidden" },
  bar: { height: 3, backgroundColor: colors.accent },
  right: { alignItems: "flex-end" },
  points: { color: colors.text, fontSize: 16, fontWeight: "700", fontFamily: fonts.mono },
  ptsLabel: { color: colors.muted, fontSize: 11, fontWeight: "400" },
  gap: { color: colors.muted, fontSize: 12, fontFamily: fonts.mono, marginTop: 2 },
  chevron: { color: colors.muted, fontSize: 22 },
});
