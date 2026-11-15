// A strip of chequered-flag squares that fills the available width.
// Generic racing imagery: our own pattern, no logos.
import { useState } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { colors } from "@/theme";

type Props = { rows?: number; size?: number; style?: StyleProp<ViewStyle> };

export function Checkered({ rows = 2, size = 8, style }: Props) {
  const [width, setWidth] = useState(0);
  const cols = Math.ceil(width / size);

  return (
    <View
      style={[{ height: rows * size, overflow: "hidden" }, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={{ flexDirection: "row", height: size }}>
          {Array.from({ length: cols }, (_, c) => (
            <View
              key={c}
              style={{
                width: size,
                height: size,
                backgroundColor: (r + c) % 2 === 0 ? colors.checkerLight : colors.checkerDark,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
