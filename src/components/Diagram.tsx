// Draws the simple diagrams used in the engineering explainers,
// using only coloured boxes (no image files or extra libraries).
import { StyleSheet, Text, View } from "react-native";
import { DiagramSpec, L, TYRE_COLORS } from "@/content/engineering";
import { useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

export function Diagram({ spec }: { spec: DiagramSpec }) {
  const { lang } = useLang();
  const tr = (l: L) => l[lang];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{tr(spec.title)}</Text>

      {spec.kind === "bars" && <Bars spec={spec} tr={tr} />}
      {spec.kind === "stacked" && <Stacked spec={spec} tr={tr} />}
      {spec.kind === "stints" && <Stints spec={spec} tr={tr} />}
      {spec.kind === "compare" && <Compare spec={spec} tr={tr} />}

      {"note" in spec && spec.note ? <Text style={styles.note}>{tr(spec.note)}</Text> : null}
    </View>
  );
}

type Tr = (l: L) => string;

function Bars({ spec, tr }: { spec: Extract<DiagramSpec, { kind: "bars" }>; tr: Tr }) {
  const max = Math.max(...spec.rows.map((r) => r.value));
  return (
    <View style={styles.rows}>
      {spec.rows.map((r) => (
        <View key={tr(r.label)}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{tr(r.label)}</Text>
            <Text style={styles.value}>
              {r.value}
              {spec.unit}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(r.value / max) * 100}%`, backgroundColor: r.color ?? colors.accent }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function Stacked({ spec, tr }: { spec: Extract<DiagramSpec, { kind: "stacked" }>; tr: Tr }) {
  const max = Math.max(...spec.rows.map((r) => r.parts.reduce((a, b) => a + b, 0)));
  return (
    <View style={styles.rows}>
      <View style={styles.legend}>
        {spec.legend.map((l) => (
          <View key={l.color} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: l.color }]} />
            <Text style={styles.label}>{tr(l.label)}</Text>
          </View>
        ))}
      </View>
      {spec.rows.map((r) => {
        const total = r.parts.reduce((a, b) => a + b, 0);
        return (
          <View key={tr(r.label)}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{tr(r.label)}</Text>
              <Text style={styles.value}>
                {r.parts.join(" + ")} = {total}
                {spec.unit}
              </Text>
            </View>
            <View style={[styles.track, styles.trackTall, { width: `${(total / max) * 100}%` }]}>
              {r.parts.map((p, i) => (
                <View key={i} style={{ flex: p, backgroundColor: spec.legend[i]?.color ?? colors.accent }} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Stints({ spec, tr }: { spec: Extract<DiagramSpec, { kind: "stints" }>; tr: Tr }) {
  return (
    <View style={styles.rows}>
      {spec.rows.map((r) => (
        <View key={tr(r.label)}>
          <Text style={styles.label}>{tr(r.label)}</Text>
          <View style={[styles.track, styles.trackTall, { gap: 3, backgroundColor: "transparent" }]}>
            {r.stints.map((s, i) => (
              <View key={i} style={[styles.stint, { flex: s.laps, backgroundColor: TYRE_COLORS[s.compound] }]}>
                <Text style={styles.stintText}>
                  {s.compound} · {s.laps}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      <Text style={styles.note}>S / M / H = Soft / Medium / Hard · laps</Text>
    </View>
  );
}

function Compare({ spec, tr }: { spec: Extract<DiagramSpec, { kind: "compare" }>; tr: Tr }) {
  return (
    <View>
      <View style={[styles.compareRow, styles.compareHead]}>
        <Text style={[styles.compareCell, styles.compareLabel]} />
        <Text style={[styles.compareCell, styles.headText]}>{tr(spec.before)}</Text>
        <Text style={[styles.compareCell, styles.headText, { color: colors.accent }]}>{tr(spec.after)}</Text>
      </View>
      {spec.rows.map((r) => (
        <View key={tr(r.label)} style={styles.compareRow}>
          <Text style={[styles.compareCell, styles.compareLabel]}>{tr(r.label)}</Text>
          <Text style={[styles.compareCell, styles.before]}>{tr(r.before)}</Text>
          <Text style={[styles.compareCell, styles.after]}>{tr(r.after)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  title: { color: colors.text, fontSize: 15, fontWeight: "700" },
  note: { color: colors.muted, fontSize: 11, fontStyle: "italic" },
  rows: { gap: 10 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: colors.text, fontSize: 13 },
  value: { color: colors.muted, fontSize: 12, fontFamily: fonts.mono },
  track: { height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: "hidden", flexDirection: "row" },
  trackTall: { height: 22, marginTop: 4 },
  fill: { height: "100%", borderRadius: 5 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stint: { justifyContent: "center", alignItems: "center", borderRadius: 4 },
  stintText: { color: "#0B0D10", fontSize: 11, fontWeight: "700", fontFamily: fonts.mono },
  compareHead: { borderTopWidth: 0 },
  compareRow: { flexDirection: "row", paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.border },
  compareCell: { flex: 1, fontSize: 13 },
  compareLabel: { color: colors.muted, flex: 1.3 },
  headText: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  before: { color: colors.muted, fontFamily: fonts.mono },
  after: { color: colors.text, fontFamily: fonts.mono, fontWeight: "700" },
});
