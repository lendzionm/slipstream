// A row of buttons where one is selected, e.g.  [ Drivers | Teams | Races ].
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";

type Option<K extends string> = { key: K; label: string };

export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.item, active && styles.active]}>
            <Text style={[styles.text, active && styles.activeText]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  item: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
  active: { backgroundColor: colors.accentFill },
  text: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  activeText: { color: colors.onAccent },
});
