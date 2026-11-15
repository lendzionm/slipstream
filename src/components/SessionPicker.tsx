// Season → weekend → session picker for screens that use OpenF1 data
// (telemetry duel, race replay). Only finished sessions are offered: OpenF1's
// free data appears about 30 minutes after a session ends.
import { ReactNode, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getSessions, OF1Session } from "@/api/openf1";
import { LoadState } from "@/components/LoadState";
import { parseDate } from "@/lib/telemetry";
import { useAsync } from "@/lib/useAsync";
import { TextKey, useLang } from "@/i18n";
import { colors } from "@/theme";

const FIRST_YEAR = 2023; // OpenF1 has detailed data from 2023

const SESSION_KEYS: Record<string, TextKey> = {
  "Practice 1": "fp1",
  "Practice 2": "fp2",
  "Practice 3": "fp3",
  "Sprint Qualifying": "sprintQuali",
  "Sprint Shootout": "sprintQuali",
  Sprint: "sprint",
  Qualifying: "quali",
  Race: "race",
};

export function SessionPicker(props: {
  sessionNames?: string[]; // only offer these sessions, e.g. ["Race", "Sprint"]
  preferred: string; // session chosen first, e.g. "Qualifying"
  children: (session: OF1Session) => ReactNode;
}) {
  const { t } = useLang();
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => thisYear - i);
  const [year, setYear] = useState(thisYear);
  const [meeting, setMeeting] = useState<number | null>(null);
  const [sessionKey, setSessionKey] = useState<number | null>(null);
  const sessions = useAsync(() => getSessions(year), [year]);

  // Finished sessions grouped by weekend, newest first. Pre-season testing has
  // no qualifying or race, so it is left out.
  const meetings = useMemo(() => {
    const done = (sessions.data ?? []).filter(
      (s) =>
        parseDate(s.date_end) + 40 * 60_000 < Date.now() &&
        (!props.sessionNames || props.sessionNames.includes(s.session_name)),
    );
    const map = new Map<number, OF1Session[]>();
    for (const s of done) map.set(s.meeting_key, [...(map.get(s.meeting_key) ?? []), s]);
    return [...map.values()]
      .filter((m) => m.some((s) => s.session_type === "Race" || s.session_type === "Qualifying"))
      .reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.data]);

  // Two weekends in the same country (e.g. Miami and Austin) are labelled by city.
  const label = (m: OF1Session[]) => {
    const twins = meetings.filter((x) => x[0].country_name === m[0].country_name).length > 1;
    return twins ? m[0].location : m[0].country_name || m[0].location;
  };

  const chosenMeeting = meetings.find((m) => m[0].meeting_key === meeting) ?? meetings[0];
  const chosenSession =
    chosenMeeting?.find((s) => s.session_key === sessionKey) ??
    chosenMeeting?.find((s) => s.session_name === props.preferred) ??
    chosenMeeting?.[chosenMeeting.length - 1];

  return (
    <>
      <Text style={styles.label}>{t("tdYear").toUpperCase()}</Text>
      <Chips
        items={years.map((y) => ({ key: String(y), label: String(y) }))}
        value={String(year)}
        onPick={(k) => {
          setYear(Number(k));
          setMeeting(null);
          setSessionKey(null);
        }}
      />
      {!sessions.data ? (
        <LoadState error={sessions.error} onRetry={sessions.retry} />
      ) : !chosenMeeting || !chosenSession ? (
        <Text style={styles.body}>{t("tdNoSessions")}</Text>
      ) : (
        <>
          <Text style={styles.label}>{t("tdEvent").toUpperCase()}</Text>
          <Chips
            scroll
            items={meetings.map((m) => ({ key: String(m[0].meeting_key), label: label(m) }))}
            value={String(chosenMeeting[0].meeting_key)}
            onPick={(k) => {
              setMeeting(Number(k));
              setSessionKey(null);
            }}
          />
          {chosenMeeting.length > 1 && (
            <>
              <Text style={styles.label}>{t("tdSession").toUpperCase()}</Text>
              <Chips
                items={chosenMeeting.map((s) => ({
                  key: String(s.session_key),
                  label: SESSION_KEYS[s.session_name] ? t(SESSION_KEYS[s.session_name]) : s.session_name,
                }))}
                value={String(chosenSession.session_key)}
                onPick={(k) => setSessionKey(Number(k))}
              />
            </>
          )}
          {props.children(chosenSession)}
        </>
      )}
    </>
  );
}

export function Chips(props: {
  items: { key: string; label: string }[];
  value: string;
  onPick: (k: string) => void;
  scroll?: boolean;
}) {
  const content = props.items.map((it) => {
    const on = it.key === props.value;
    return (
      <Pressable key={it.key} onPress={() => props.onPick(it.key)} style={[styles.chip, on && styles.chipOn]}>
        <Text style={[styles.chipText, on && styles.chipTextOn]}>{it.label}</Text>
      </Pressable>
    );
  });
  return props.scroll ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {content}
    </ScrollView>
  ) : (
    <View style={styles.chips}>{content}</View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  chipText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  chipTextOn: { color: colors.onAccent },
});
