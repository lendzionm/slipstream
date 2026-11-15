// The frame used by every screen: title + PL/EN switch at the top,
// scrollable content in the middle, the fan-app disclaimer at the bottom.
// Pass showBack to get a "‹ Back" button (used on the race results page).
import { router } from "expo-router";
import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Checkered } from "@/components/Checkered";
import { TabBar } from "@/components/TabBar";
import { useLang } from "@/i18n";
import { colors } from "@/theme";

type Props = { title: string; subtitle?: string; showBack?: boolean; children: ReactNode };

export function Screen({ title, subtitle, showBack, children }: Props) {
  const { t } = useLang();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.titleBox}>
          {showBack ? (
            <Pressable onPress={goBack} hitSlop={10}>
              <Text style={styles.back}>‹ {t("back")}</Text>
            </Pressable>
          ) : (
            <View style={styles.brandRow}>
              <View style={styles.brandMark} />
              <Text style={styles.brand}>{t("appName").toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <LanguageSwitch />
      </View>
      <Checkered rows={2} size={6} style={styles.headerFlag} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {children}
        <Text style={styles.disclaimer}>{t("disclaimer")}</Text>
      </ScrollView>
      {/* Main screens get the tab bar; detail pages have the Back button instead. */}
      {!showBack && <TabBar />}
    </SafeAreaView>
  );
}

function LanguageSwitch() {
  const { lang, setLang } = useLang();
  return (
    <View style={styles.switch}>
      {(["en", "pl"] as const).map((code) => (
        <Pressable
          key={code}
          onPress={() => setLang(code)}
          style={[styles.switchButton, lang === code && styles.switchButtonActive]}
        >
          <Text style={[styles.switchText, lang === code && styles.switchTextActive]}>
            {code.toUpperCase()}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerFlag: { opacity: 0.85 },
  titleBox: { flex: 1 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandMark: { width: 14, height: 4, backgroundColor: colors.accent, transform: [{ skewX: "-20deg" }] },
  brand: { color: colors.accent, fontSize: 11, fontWeight: "900", fontStyle: "italic", letterSpacing: 3 },
  back: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  title: { color: colors.text, fontSize: 26, fontWeight: "900", fontStyle: "italic", letterSpacing: -0.5, marginTop: 2 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  content: { padding: 16, gap: 12, width: "100%", maxWidth: 720, alignSelf: "center" },
  disclaimer: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 24, marginBottom: 8 },
  switch: { flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: "hidden" },
  switchButton: { paddingHorizontal: 10, paddingVertical: 6 },
  switchButtonActive: { backgroundColor: colors.accentFill },
  switchText: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  switchTextActive: { color: colors.onAccent },
});
