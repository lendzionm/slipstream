// BANNED TECH: famous F1 ideas that were outlawed. Tap a card to read more.
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { bannedTech } from "@/content/bannedTech";
import { useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

export default function BannedScreen() {
  const { t, lang } = useLang();
  const [openId, setOpenId] = useState<string | null>(bannedTech[0]?.id ?? null);

  return (
    <Screen title={t("bannedTech")} showBack>
      <Text style={styles.intro}>{t("bannedIntro")}</Text>
      {bannedTech.map((item) => {
        const open = openId === item.id;
        return (
          <Pressable key={item.id} style={styles.card} onPress={() => setOpenId(open ? null : item.id)}>
            <View style={styles.top}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name[lang]}</Text>
                <Text style={styles.car}>{item.car}</Text>
              </View>
              <View style={styles.years}>
                <Text style={styles.yearUsed}>{item.used}</Text>
                <Text style={styles.yearBanned}>✕ {item.banned}</Text>
              </View>
            </View>
            {open && (
              <View style={styles.body}>
                <Text style={styles.heading}>{t("howItWorked").toUpperCase()}</Text>
                <Text style={styles.text}>{item.how[lang]}</Text>
                <Text style={[styles.heading, { color: colors.amber }]}>{t("whyBanned").toUpperCase()}</Text>
                <Text style={styles.text}>{item.why[lang]}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { color: colors.text, fontSize: 16, fontWeight: "700" },
  car: { color: colors.muted, fontSize: 12, marginTop: 2 },
  years: { alignItems: "flex-end" },
  yearUsed: { color: colors.text, fontSize: 12, fontFamily: fonts.mono },
  yearBanned: { color: colors.amber, fontSize: 12, fontFamily: fonts.mono, marginTop: 2 },
  body: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 6 },
  heading: { color: colors.accent, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  text: { color: colors.text, fontSize: 14, lineHeight: 21 },
});
