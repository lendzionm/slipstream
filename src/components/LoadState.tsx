// Shows a spinner while loading, or an error message with a "Try again" button.
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLang } from "@/i18n";
import { colors } from "@/theme";

export function LoadState({ error, onRetry, message }: { error: boolean; onRetry: () => void; message?: string }) {
  const { t } = useLang();
  if (error) {
    return (
      <View style={styles.box}>
        <Text style={styles.message}>{t("error")}</Text>
        <Pressable style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>{t("retry")}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.message}>{message ?? t("loading")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", gap: 12, marginTop: 32 },
  message: { color: colors.muted, fontSize: 15, textAlign: "center" },
  button: { backgroundColor: colors.accentFill, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  buttonText: { color: colors.onAccent, fontWeight: "700" },
});
