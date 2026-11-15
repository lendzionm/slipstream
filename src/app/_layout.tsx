// The app's "skeleton": language support + a stack of pages.
// The 4 main screens (Calendar, Standings, Predictions, Engineering) show our own
// tab bar (src/components/TabBar.tsx). Detail pages (race results, explainers,
// strategy, lab, hub…) open on top of them and have a Back button.
// Before showing anything, we load saved data (your picks) from storage.
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { LanguageProvider } from "@/i18n";
import { initStorage } from "@/lib/storage";
import { colors } from "@/theme";

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initStorage().finally(() => setReady(true));
  }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <LanguageProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </LanguageProvider>
  );
}
