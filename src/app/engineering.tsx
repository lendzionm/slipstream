// ENGINEERING screen (fourth tab): list of explainers and engineering problems.
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { topics } from "@/content/engineering";
import { TextKey, useLang } from "@/i18n";
import { colors } from "@/theme";

export default function EngineeringScreen() {
  const { t, lang } = useLang();

  return (
    <Screen title={t("tabEngineering")}>
      <Text style={styles.intro}>{t("engineeringIntro")}</Text>

      <Pressable style={[styles.card, styles.carCard]} onPress={() => router.push("/car")}>
        <Text style={styles.symbol}>◆</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("car3dTitle")}</Text>
          <Text style={styles.desc}>{t("car3dDesc")}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Text style={styles.section}>{t("explainers").toUpperCase()}</Text>
      {topics.map((topic) => (
        <Pressable
          key={topic.id}
          style={styles.card}
          onPress={() => router.push({ pathname: "/topic/[id]", params: { id: topic.id } })}
        >
          <Text style={styles.symbol}>{topic.symbol}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{topic.title[lang]}</Text>
            <Text style={styles.desc}>{topic.summary[lang]}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}

      <Text style={styles.section}>{t("problems").toUpperCase()}</Text>
      <ProblemCard title="telemetryDuel" desc="telemetryDuelDesc" symbol="⌁" onPress={() => router.push("/telemetry")} />
      <ProblemCard title="replayTitle" desc="replayDesc" symbol="▶" onPress={() => router.push("/replay")} />
      <ProblemCard title="tyresTitle" desc="tyresDesc" symbol="◎" onPress={() => router.push("/tyres")} />
      <ProblemCard title="strategyProblem" desc="strategyProblemDesc" symbol="⇄" onPress={() => router.push("/strategy")} />
      <ProblemCard title="whatIfLab" desc="whatIfDesc" symbol="⚗" onPress={() => router.push("/lab")} />
      <ProblemCard title="bannedTech" desc="bannedDesc" symbol="✕" onPress={() => router.push("/banned")} />
    </Screen>
  );
}

function ProblemCard(props: { title: TextKey; desc: TextKey; symbol: string; onPress?: () => void }) {
  const { t } = useLang();
  const soon = !props.onPress;
  return (
    <Pressable style={[styles.card, soon && styles.cardSoon]} onPress={props.onPress} disabled={soon}>
      <Text style={styles.symbol}>{props.symbol}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{t(props.title)}</Text>
        <Text style={styles.desc}>{t(props.desc)}</Text>
        {soon && <Text style={styles.soon}>{t("comingSoon").toUpperCase()}</Text>}
      </View>
      {!soon && <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  section: { color: colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 2, marginTop: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardSoon: { opacity: 0.6 },
  carCard: { borderColor: colors.accent, backgroundColor: colors.cardActive },
  symbol: { width: 34, color: colors.accent, fontSize: 24, textAlign: "center" },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  desc: { color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  soon: { color: colors.amber, fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginTop: 6 },
  chevron: { color: colors.muted, fontSize: 22 },
});
