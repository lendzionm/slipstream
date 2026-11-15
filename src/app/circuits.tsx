// CIRCUITS: every track that has hosted a championship race since 1950,
// with how often and when. Tap one for its full guide.
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getAllRaces, getCircuits } from "@/api/jolpica";
import { LoadState } from "@/components/LoadState";
import { Screen } from "@/components/Screen";
import { Chips } from "@/components/SessionPicker";
import { summariseCircuits } from "@/lib/circuits";
import { useAsync } from "@/lib/useAsync";
import { useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

type Filter = "season" | "all";

export default function CircuitsScreen() {
  const { t } = useLang();
  const season = String(new Date().getFullYear());
  const [filter, setFilter] = useState<Filter>("season");
  const [query, setQuery] = useState("");

  const { data, error, retry } = useAsync(async () => {
    const circuits = await getCircuits();
    const races = await getAllRaces();
    return summariseCircuits(circuits, races, season);
  }, [season]);

  const list = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const matches = data.filter(
      (c) =>
        (filter === "all" || c.onCalendar) &&
        (!q ||
          `${c.circuit.circuitName} ${c.circuit.Location.locality} ${c.circuit.Location.country}`.toLowerCase().includes(q)),
    );
    return filter === "season"
      ? matches.sort((a, b) => (a.round ?? 99) - (b.round ?? 99))
      : matches.sort((a, b) => b.races - a.races || a.circuit.circuitName.localeCompare(b.circuit.circuitName));
  }, [data, filter, query]);

  return (
    <Screen title={t("circuitsTitle")} showBack>
      <Text style={styles.intro}>{t("circuitsIntro")}</Text>
      {!data ? (
        <LoadState error={error} onRetry={retry} message={t("circuitsLoading")} />
      ) : (
        <>
          <Chips
            items={[
              { key: "season", label: t("thisSeason", { year: season }) },
              { key: "all", label: t("allCircuits", { n: data.length }) },
            ]}
            value={filter}
            onPick={(k) => setFilter(k as Filter)}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("searchCircuits")}
            placeholderTextColor={colors.muted}
            style={styles.search}
          />
          {list.map((c) => (
            <Pressable
              key={c.circuit.circuitId}
              style={styles.card}
              onPress={() => router.push({ pathname: "/circuit/[id]", params: { id: c.circuit.circuitId } })}
            >
              <View style={styles.badge}>
                <Text style={styles.badgeBig}>{filter === "season" && c.round ? c.round : c.races}</Text>
                <Text style={styles.badgeSmall}>{filter === "season" && c.round ? t("roundShort") : t("racesShort")}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.circuit.circuitName}</Text>
                <Text style={styles.hint}>
                  {c.circuit.Location.locality}, {c.circuit.Location.country}
                </Text>
                <Text style={styles.hint}>
                  {t("racesHeld", { n: c.races })}
                  {c.first ? ` · ${c.first}${c.last && c.last !== c.first ? `–${c.last}` : ""}` : ""}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
          {list.length === 0 && <Text style={styles.hint}>{t("noCircuits")}</Text>}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  hint: { color: colors.muted, fontSize: 12 },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  badge: { width: 46, alignItems: "center" },
  badgeBig: { color: colors.accent, fontSize: 22, fontWeight: "900", fontStyle: "italic", fontFamily: fonts.mono },
  badgeSmall: { color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: "800" },
  chevron: { color: colors.muted, fontSize: 22 },
});
