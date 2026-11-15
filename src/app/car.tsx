// 3D CAR: spin our own race car, tap its parts to learn what they do,
// switch the 2026 moving wings, change tyres and pull the car apart.
import { router } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { CarViewer } from "@/components/car3d/CarViewer";
import type { View3D } from "@/components/car3d/CarScene";
import { Screen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { carParts, PartId } from "@/content/carParts";
import { TYRE_COLORS } from "@/content/engineering";
import { useLang } from "@/i18n";
import { colors } from "@/theme";

type Compound = "S" | "M" | "H";

export default function CarScreen() {
  const { t, lang } = useLang();
  const { width } = useWindowDimensions();
  const view = useRef<View3D>({ rotationY: 0.7, rotationX: 0, distance: 5.6 });
  const [selected, setSelected] = useState<PartId | null>(null);
  const [exploded, setExploded] = useState(false);
  const [straightMode, setStraightMode] = useState(false);
  const [compound, setCompound] = useState<Compound>("S");
  const [autoRotate, setAutoRotate] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const part = carParts.find((p) => p.id === selected);
  const zoom = (d: number) => {
    view.current.distance = Math.max(4, Math.min(10, view.current.distance + d));
  };

  return (
    <Screen title={t("car3dTitle")} showBack>
      <Text style={styles.hint}>{t("car3dHint")}</Text>

      <View>
        <CarViewer
          height={Math.min(420, Math.max(280, width * 0.75))}
          view={view}
          selected={selected}
          exploded={exploded}
          straightMode={straightMode}
          tyreColor={TYRE_COLORS[compound]}
          autoRotate={autoRotate}
          onSelect={(p) => {
            setSelected(p);
            setAutoRotate(false);
          }}
          onLoaded={() => setLoaded(true)}
          onFailed={() => {
            setFailed(true);
            setLoaded(true);
          }}
        />
        {!loaded && (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.hint}>{t("car3dLoading")}</Text>
          </View>
        )}
        <View style={styles.zoom}>
          <RoundButton label="+" onPress={() => zoom(-0.8)} />
          <RoundButton label="−" onPress={() => zoom(0.8)} />
          <RoundButton label={autoRotate ? "❚❚" : "↻"} onPress={() => setAutoRotate(!autoRotate)} />
        </View>
      </View>

      {/* Selected part */}
      {part ? (
        <View style={styles.card}>
          <Text style={styles.label}>{part.name[lang].toUpperCase()}</Text>
          <Text style={styles.body}>{part.what[lang]}</Text>
          <Pressable onPress={() => router.push({ pathname: "/topic/[id]", params: { id: part.topic } })}>
            <Text style={styles.link}>{t("readExplainer")} ›</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Part chips */}
      <View style={styles.chips}>
        {carParts.map((p) => {
          const on = p.id === selected;
          return (
            <Pressable
              key={p.id}
              onPress={() => {
                setSelected(on ? null : p.id);
                setAutoRotate(false);
              }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.name[lang]}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Controls */}
      <View style={styles.card}>
        <Text style={styles.label}>{t("wingMode").toUpperCase()}</Text>
        <Segmented
          options={[
            { key: "corner", label: t("cornerMode") },
            { key: "straight", label: t("straightModeLabel") },
          ]}
          value={straightMode ? "straight" : "corner"}
          onChange={(k) => setStraightMode(k === "straight")}
        />
        <Text style={styles.hint}>{straightMode ? t("straightModeDesc") : t("cornerModeDesc")}</Text>

        <Text style={[styles.label, { marginTop: 8 }]}>{t("tyres").toUpperCase()}</Text>
        <Segmented<Compound>
          options={[
            { key: "S", label: t("soft") },
            { key: "M", label: t("medium") },
            { key: "H", label: t("hard") },
          ]}
          value={compound}
          onChange={setCompound}
        />

        <Pressable style={[styles.toggle, exploded && styles.toggleOn]} onPress={() => setExploded(!exploded)}>
          <Text style={[styles.toggleText, exploded && styles.toggleTextOn]}>
            {exploded ? "◉" : "○"} {t("explodedView")}
          </Text>
        </Pressable>
      </View>

      {failed && <Text style={styles.hint}>{t("car3dFailed")}</Text>}
      <Pressable
        onPress={() =>
          Linking.openURL("https://sketchfab.com/3d-models/f1-2026-1c9f3477345c403ebb70a248d58a94ba")
        }
      >
        <Text style={styles.hint}>{t("car3dCredit")} ↗</Text>
      </Pressable>
    </Screen>
  );
}

function RoundButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.round}>
      <Text style={styles.roundText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  label: { color: colors.accent, fontSize: 12, fontWeight: "900", fontStyle: "italic", letterSpacing: 2 },
  link: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  zoom: { position: "absolute", right: 10, top: 10, gap: 8 },
  loading: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(21,21,26,0.85)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  roundText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  chipText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  chipTextOn: { color: colors.onAccent },
  toggle: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  toggleOn: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  toggleText: { color: colors.text, fontWeight: "700" },
  toggleTextOn: { color: colors.onAccent },
});
