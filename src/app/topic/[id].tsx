// One engineering explainer, e.g. /topic/aero
import { router, useLocalSearchParams } from "expo-router";
import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Diagram } from "@/components/Diagram";
import { Screen } from "@/components/Screen";
import { topics } from "@/content/engineering";
import { useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

export default function TopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useLang();
  const index = topics.findIndex((x) => x.id === id);
  const topic = topics[index];

  if (!topic) {
    return (
      <Screen title={t("tabEngineering")} showBack>
        <Text style={styles.body}>?</Text>
      </Screen>
    );
  }

  const next = topics[(index + 1) % topics.length];

  return (
    <Screen title={topic.title[lang]} showBack>
      <Text style={styles.summary}>{topic.summary[lang]}</Text>

      <View style={styles.numbers}>
        {topic.keyNumbers.map((k) => (
          <View key={k.value} style={styles.numberBox}>
            <Text style={styles.numberValue}>{k.value}</Text>
            <Text style={styles.numberLabel}>{k.label[lang]}</Text>
          </View>
        ))}
      </View>

      {topic.sections.map((s, i) => (
        <Fragment key={s.heading.en}>
          <View style={styles.section}>
            <Text style={styles.heading}>{s.heading[lang]}</Text>
            <Text style={styles.body}>{s.body[lang]}</Text>
          </View>
          {/* The diagram goes after the first section */}
          {i === 0 && <Diagram spec={topic.diagram} />}
        </Fragment>
      ))}

      <Pressable
        style={styles.next}
        onPress={() => router.replace({ pathname: "/topic/[id]", params: { id: next.id } })}
      >
        <Text style={styles.nextLabel}>{t("nextTopic").toUpperCase()}</Text>
        <Text style={styles.nextTitle}>
          {next.symbol} {next.title[lang]} ›
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { color: colors.text, fontSize: 17, lineHeight: 25, fontWeight: "600" },
  numbers: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  numberBox: {
    flexGrow: 1,
    flexBasis: 140,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  numberValue: { color: colors.accent, fontSize: 22, fontWeight: "800", fontFamily: fonts.mono },
  numberLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  section: { gap: 6, marginTop: 4 },
  heading: { color: colors.text, fontSize: 17, fontWeight: "700" },
  body: { color: colors.text, fontSize: 15, lineHeight: 23, opacity: 0.9 },
  next: {
    marginTop: 8,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 14,
    gap: 4,
  },
  nextLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  nextTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
});
