// Placeholder for tabs we haven't built yet.
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { TextKey, useLang } from "@/i18n";
import { colors } from "@/theme";

export function ComingSoon({ title, description }: { title: TextKey; description: TextKey }) {
  const { t } = useLang();
  return (
    <Screen title={t(title)}>
      <View style={styles.card}>
        <Text style={styles.label}>{t("comingSoon").toUpperCase()}</Text>
        <Text style={styles.text}>{t(description)}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  label: { color: colors.amber, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  text: { color: colors.text, fontSize: 15, lineHeight: 22 },
});
