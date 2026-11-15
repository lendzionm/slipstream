// CALENDAR screen (the first tab).
// 1. Downloads the season schedule from Jolpica-F1.
// 2. Shows the next session with a live countdown.
// 3. Lists upcoming races first; finished races are folded away below
//    (tap one to see its results).
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getSchedule, Race } from "@/api/jolpica";
import { Checkered } from "@/components/Checkered";
import { Countdown } from "@/components/Countdown";
import { LoadState } from "@/components/LoadState";
import { RaceCard } from "@/components/RaceCard";
import { Chips } from "@/components/SessionPicker";
import { PRESEASON_TEST_2027 } from "@/content/calendar2027";
import { Screen } from "@/components/Screen";
import { findNextSession, isRaceFinished } from "@/lib/sessions";
import { useAsync } from "@/lib/useAsync";
import { useLang } from "@/i18n";
import { colors } from "@/theme";

// Load this season. If it's already over, try next year's calendar.
async function loadSeason(): Promise<Race[]> {
  const current = await getSchedule("current");
  if (findNextSession(current, Date.now())) return current;
  const nextYear = String(Number(current[0]?.season ?? new Date().getFullYear()) + 1);
  try {
    const next = await getSchedule(nextYear);
    if (next.length > 0) return next;
  } catch {
    // next year's calendar isn't published yet: just show this season
  }
  return current;
}

const THIS_YEAR = new Date().getFullYear();

export default function CalendarScreen() {
  const { t, locale } = useLang();
  const [season, setSeason] = useState<"current" | "next">("current");
  const { data: races, error, retry } = useAsync(
    () => (season === "current" ? loadSeason() : getSchedule(String(THIS_YEAR + 1))),
    [season],
  );
  const seasonChips = (
    <Chips
      items={[
        { key: "current", label: String(THIS_YEAR) },
        { key: "next", label: String(THIS_YEAR + 1) },
      ]}
      value={season}
      onPick={(k) => setSeason(k as "current" | "next")}
    />
  );
  const [now, setNow] = useState(Date.now());
  const [showFinished, setShowFinished] = useState(false);

  // Re-check every 30 s which session is next (so it moves on after a session ends).
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!races) {
    return (
      <Screen title={t("tabCalendar")}>
        {seasonChips}
        <LoadState error={error} onRetry={retry} />
      </Screen>
    );
  }

  // Next season with only dates announced (no session times yet).
  if (races.length > 0 && races[0].provisional) {
    const first = races[0];
    const daysToGo = Math.ceil((Date.parse(`${first.date}T12:00:00Z`) - now) / (24 * 3600 * 1000));
    const sprints = races.filter((r) => r.provisional?.sprint).length;
    const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "long", timeZone: "UTC" });
    return (
      <Screen title={`${t("tabCalendar")} ${first.season}`}>
        {seasonChips}
        <View style={styles.hero}>
          <Checkered rows={2} size={7} />
          <View style={styles.heroBody}>
            <Text style={styles.heroLabel}>{t("provisionalLabel").toUpperCase()}</Text>
            <Text style={styles.heroTitle}>{t("seasonStartsIn", { n: daysToGo })}</Text>
            <Text style={styles.heroSub}>
              {t("seasonFacts", { races: races.length, sprints, first: first.raceName, last: races[races.length - 1].raceName })}
            </Text>
            <Text style={styles.heroSub}>
              {t("preseasonTest", { from: day(PRESEASON_TEST_2027.from), to: day(PRESEASON_TEST_2027.to) })}
            </Text>
            <Text style={styles.zone}>{t("provisionalNote")}</Text>
          </View>
        </View>
        {races.map((race) => (
          <RaceCard key={race.round} race={race} now={now} isNext={false} isFinished={false} />
        ))}
      </Screen>
    );
  }

  const next = findNextSession(races, now);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const upcoming = races.filter((r) => !isRaceFinished(r, now));
  const finished = races.filter((r) => isRaceFinished(r, now)).reverse(); // newest first

  return (
    <Screen title={`${t("tabCalendar")} ${races[0]?.season ?? ""}`}>
      {seasonChips}
      {next ? (
        <View style={styles.hero}>
          <Checkered rows={2} size={7} />
          <View style={styles.heroBody}>
          <Text style={[styles.heroLabel, next.isLive && { color: colors.live }]}>
            {next.isLive ? `● ${t("liveNow")}` : t("nextSession").toUpperCase()}
          </Text>
          <Text style={styles.heroTitle}>{t(next.session.key)}</Text>
          <Text style={styles.heroSub}>
            {next.race.raceName} ·{" "}
            {next.session.start.toLocaleString(locale, {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          {!next.isLive && <Countdown target={next.session.start} />}
          <Pressable onPress={() => router.push("/hub")}>
            <Text style={styles.hubLink}>{t("hubLink")} ›</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/replay")}>
            <Text style={styles.hubLink}>{t("replayTitle")} ›</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/circuits")}>
            <Text style={styles.hubLink}>{t("allCircuitsLink")} ›</Text>
          </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.message}>{t("seasonOver")}</Text>
      )}

      {upcoming.length > 0 && (
        <>
          <Text style={styles.section}>{t("upcoming").toUpperCase()}</Text>
          <Text style={styles.zone}>
            {t("timesIn")} {timeZone}
          </Text>
          {upcoming.map((race) => (
            <RaceCard
              key={race.round}
              race={race}
              now={now}
              isNext={next?.race.round === race.round}
              isFinished={false}
            />
          ))}
        </>
      )}

      {finished.length > 0 && (
        <>
          <Pressable style={styles.foldButton} onPress={() => setShowFinished(!showFinished)}>
            <Text style={styles.section}>
              {t("finishedRaces").toUpperCase()} ({finished.length})
            </Text>
            <Text style={styles.chevron}>{showFinished ? "▴" : "▾"}</Text>
          </Pressable>
          {showFinished &&
            finished.map((race) => (
              <RaceCard key={race.round} race={race} now={now} isNext={false} isFinished />
            ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    overflow: "hidden",
  },
  heroBody: { padding: 16, gap: 6 },
  heroLabel: { color: colors.accent, fontSize: 12, fontWeight: "900", fontStyle: "italic", letterSpacing: 2 },
  heroTitle: { color: colors.text, fontSize: 30, fontWeight: "900", fontStyle: "italic", letterSpacing: -0.5 },
  heroSub: { color: colors.muted, fontSize: 14, marginBottom: 8 },
  hubLink: { color: colors.accent, fontSize: 14, fontWeight: "700", marginTop: 8 },
  section: { color: colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 2, marginTop: 8 },
  zone: { color: colors.muted, fontSize: 12 },
  message: { color: colors.muted, fontSize: 15, textAlign: "center", marginTop: 16 },
  foldButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
  chevron: { color: colors.muted, fontSize: 16, marginTop: 8 },
});
