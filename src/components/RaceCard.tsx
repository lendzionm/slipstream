// One race in the calendar list.
// Upcoming race: tap to show all sessions in your local time.
// Finished race: tap to open its results and stats.
import { router } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { Race } from "@/api/jolpica";
import { openRaceResults } from "@/lib/openRace";
import { getSessions, sessionEnd } from "@/lib/sessions";
import { useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

type Props = { race: Race; isNext: boolean; isFinished: boolean; now: number };

export function RaceCard(props: Props) {
  return props.race.provisional ? <ProvisionalCard race={props.race} /> : <ScheduledCard {...props} />;
}

// Next season's race: only the dates are announced. Tap to open the circuit guide.
function ProvisionalCard({ race }: { race: Race }) {
  const { t, locale } = useLang();
  const raceDay = new Date(`${race.date}T12:00:00Z`);
  const friday = new Date(raceDay.getTime() - 2 * 24 * 3600 * 1000);
  const day = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: "/circuit/[id]", params: { id: race.Circuit.circuitId } })}
    >
      <View style={styles.topRow}>
        <Text style={styles.round}>
          {t("round").toUpperCase()} {race.round}
        </Text>
        <Text style={styles.dates}>
          {day(friday)} – {day(raceDay)}
        </Text>
      </View>
      <Text style={styles.name}>{race.raceName}</Text>
      <Text style={styles.place}>
        {race.Circuit.circuitName} · {race.Circuit.Location.locality}, {race.Circuit.Location.country}
      </Text>
      <View style={styles.tagRow}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {race.provisional?.sprint && <Text style={styles.sprintTag}>{t("sprintWeekend").toUpperCase()}</Text>}
          <Text style={styles.tbcTag}>{t("timesTbc").toUpperCase()}</Text>
        </View>
        <Text style={styles.resultsLink}>{t("circuitGuide")} ›</Text>
      </View>
      {race.provisional?.note === "homologation" && <Text style={styles.note}>{t("homologationNote")}</Text>}
    </Pressable>
  );
}

function ScheduledCard({ race, isNext, isFinished, now }: Props) {
  const { t, locale } = useLang();
  const [open, setOpen] = useState(isNext); // the next race starts opened
  const sessions = getSessions(race);
  const first = sessions[0]?.start;
  const last = sessions[sessions.length - 1]?.start;
  const isSprint = sessions.some((s) => s.key === "sprint");

  const day = (d?: Date) => (d ? d.toLocaleDateString(locale, { day: "numeric", month: "short" }) : "");

  const onPress = () => {
    if (isFinished) openRaceResults(race.season, race.round);
    else setOpen(!open);
  };

  return (
    <Pressable onPress={onPress} style={[styles.card, isNext && styles.cardNext]}>
      <View style={styles.topRow}>
        <Text style={styles.round}>
          {t("round").toUpperCase()} {race.round}
        </Text>
        <Text style={styles.dates}>
          {day(first)} – {day(last)}
        </Text>
      </View>

      <Text style={styles.name}>{race.raceName}</Text>
      <Text style={styles.place}>
        {race.Circuit.circuitName} · {race.Circuit.Location.locality}, {race.Circuit.Location.country}
      </Text>

      <View style={styles.tagRow}>
        {isSprint ? <Text style={styles.sprintTag}>{t("sprintWeekend").toUpperCase()}</Text> : <View />}
        {isFinished && <Text style={styles.resultsLink}>{t("results")} ›</Text>}
      </View>

      {open && !isFinished && (
        <View style={styles.sessions}>
          {sessions.map((s) => {
            const live = s.start.getTime() <= now && sessionEnd(s) > now;
            const done = sessionEnd(s) <= now;
            return (
              <View key={s.key} style={styles.sessionRow}>
                <Text style={[styles.sessionName, done && styles.dim, live && styles.live]}>
                  {live ? "● " : done ? "✓ " : ""}
                  {t(s.key)}
                </Text>
                <Text style={[styles.sessionTime, done && styles.dim]}>
                  {s.start.toLocaleString(locale, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            );
          })}
          <Pressable onPress={() => Linking.openURL(race.Circuit.url)}>
            <Text style={styles.link}>{t("trackInfo")} ↗</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardNext: { borderColor: colors.amber, backgroundColor: colors.cardActive },
  topRow: { flexDirection: "row", justifyContent: "space-between" },
  round: { color: colors.accent, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  dates: { color: colors.muted, fontSize: 12, fontFamily: fonts.mono },
  name: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 6 },
  place: { color: colors.muted, fontSize: 13, marginTop: 2 },
  tagRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  sprintTag: { color: colors.amber, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  resultsLink: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  sessions: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  sessionRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  sessionName: { color: colors.text, fontSize: 14 },
  sessionTime: { color: colors.text, fontSize: 13, fontFamily: fonts.mono },
  dim: { color: colors.muted },
  live: { color: colors.live, fontWeight: "700" },
  link: { color: colors.accent, fontSize: 13, marginTop: 6 },
  tbcTag: { color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  note: { color: colors.muted, fontSize: 12, marginTop: 6 },
});
