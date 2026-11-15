// Our own bottom tab bar, shown on the 4 main screens.
// (Detail pages like race results open on top of these and show a Back button instead.)
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Checkered } from "@/components/Checkered";
import { TextKey, useLang } from "@/i18n";
import { colors } from "@/theme";

const TABS: { href: "/" | "/standings" | "/predictions" | "/engineering"; label: TextKey; symbol: string }[] = [
  { href: "/", label: "tabCalendar", symbol: "◷" },
  { href: "/standings", label: "tabStandings", symbol: "≡" },
  { href: "/predictions", label: "tabPredictions", symbol: "%" },
  { href: "/engineering", label: "tabEngineering", symbol: "⚙︎" },
];

export function TabBar() {
  const { t } = useLang();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View>
      <Checkered rows={1} size={6} style={{ opacity: 0.85 }} />
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        const color = active ? colors.accent : colors.muted;
        return (
          <Pressable
            key={tab.href}
            style={styles.item}
            onPress={() => !active && router.replace(tab.href)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.symbol, { color }]}>{tab.symbol}</Text>
            <Text style={[styles.label, { color }]}>{t(tab.label)}</Text>
          </Pressable>
        );
      })}
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.card,
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: "center", gap: 2 },
  symbol: { fontSize: 18 },
  label: { fontSize: 11, fontWeight: "700", fontStyle: "italic" },
});
