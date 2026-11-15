// Shows "days : hours : minutes : seconds" until a date and updates every second.
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

export function Countdown({ target }: { target: Date }) {
  const { t } = useLang();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer); // stop the timer when the screen closes
  }, []);

  const left = Math.max(0, target.getTime() - now);
  const parts = [
    { value: Math.floor(left / 86_400_000), label: t("days") },
    { value: Math.floor(left / 3_600_000) % 24, label: t("hours") },
    { value: Math.floor(left / 60_000) % 60, label: t("minutes") },
    { value: Math.floor(left / 1000) % 60, label: t("seconds") },
  ];

  return (
    <View style={styles.row}>
      {parts.map((p) => (
        <View key={p.label} style={styles.box}>
          <Text style={styles.value}>{String(p.value).padStart(2, "0")}</Text>
          <Text style={styles.label}>{p.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  box: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: { color: colors.text, fontSize: 28, fontWeight: "700", fontFamily: fonts.mono },
  label: { color: colors.muted, fontSize: 11, marginTop: 2, textTransform: "uppercase" },
});
