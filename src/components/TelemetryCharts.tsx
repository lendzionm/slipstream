// Charts for the telemetry duel, drawn with react-native-svg.
// All charts share one "cursor": drag a finger (or the mouse) across any chart
// and every chart plus the track map shows the same point on the lap.
import { useState } from "react";
import { GestureResponderEvent, LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect } from "react-native-svg";
import { colors, fonts } from "@/theme";

export const COLOR_A = colors.accent;
export const COLOR_B = "#E9E9EE";

type Series = { values: number[]; color: string };

function useWidth() {
  const [width, setWidth] = useState(0);
  return { width, onLayout: (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width) };
}

export function LineChart(props: {
  title: string;
  series: Series[];
  height?: number;
  min?: number;
  max?: number;
  zeroLine?: boolean;
  step?: boolean; // draw as steps (for gear / brake)
  cursor: number | null;
  onCursor: (i: number | null) => void;
  readout?: string; // text shown on the right of the title while dragging
}) {
  const { width, onLayout } = useWidth();
  const height = props.height ?? 110;
  const n = Math.max(...props.series.map((s) => s.values.length));
  const all = props.series.flatMap((s) => s.values);
  let min = props.min ?? Math.min(...all);
  let max = props.max ?? Math.max(...all);
  if (props.zeroLine) {
    const m = Math.max(Math.abs(min), Math.abs(max), 0.05);
    min = -m;
    max = m;
  }
  const pad = 4;
  const x = (i: number) => (i / Math.max(n - 1, 1)) * width;
  const y = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (height - pad * 2);

  const points = (values: number[]) => {
    const out: string[] = [];
    // at most ~1 point per pixel keeps drawing fast on phones
    const every = Math.max(1, Math.floor(values.length / Math.max(width, 1)));
    for (let i = 0; i < values.length; i += every) {
      if (props.step && i > 0) out.push(`${x(i).toFixed(1)},${y(values[i - every]).toFixed(1)}`);
      out.push(`${x(i).toFixed(1)},${y(values[i]).toFixed(1)}`);
    }
    return out.join(" ");
  };

  const move = (e: GestureResponderEvent) => {
    if (!width) return;
    const i = Math.round((e.nativeEvent.locationX / width) * (n - 1));
    props.onCursor(Math.min(Math.max(i, 0), n - 1));
  };

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{props.title.toUpperCase()}</Text>
        {props.readout ? <Text style={styles.readout}>{props.readout}</Text> : null}
      </View>
      <View
        onLayout={onLayout}
        style={{ height }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={move}
        onResponderMove={move}
        onResponderTerminationRequest={() => true}
      >
        {width > 0 && (
          <Svg width={width} height={height} pointerEvents="none">
            <Rect x={0} y={0} width={width} height={height} fill="transparent" />
            {props.zeroLine && <Line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke={colors.border} strokeWidth={1} />}
            {props.series.map((s, k) => (
              <Polyline key={k} points={points(s.values)} fill="none" stroke={s.color} strokeWidth={1.6} />
            ))}
            {props.cursor !== null && (
              <Line x1={x(props.cursor)} x2={x(props.cursor)} y1={0} y2={height} stroke={colors.amber} strokeWidth={1} />
            )}
          </Svg>
        )}
      </View>
    </View>
  );
}

// Track outline coloured mini-sector by mini-sector.
export function TrackMap(props: {
  points: { x: number; y: number; d: number }[];
  sectorColor: (d: number) => string;
  cursorDistance: number | null;
  height?: number;
}) {
  const { width, onLayout } = useWidth();
  const height = props.height ?? 240;
  const pts = props.points;
  if (pts.length < 10) return null;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 12;
  const scale = Math.min((width - pad * 2) / (maxX - minX || 1), (height - pad * 2) / (maxY - minY || 1));
  const offX = (width - (maxX - minX) * scale) / 2;
  const offY = (height - (maxY - minY) * scale) / 2;
  const px = (v: number) => offX + (v - minX) * scale;
  const py = (v: number) => offY + (maxY - v) * scale; // screen y goes down

  // Group consecutive points with the same colour into one line.
  const runs: { color: string; pts: string[] }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const c = props.sectorColor(pts[i].d);
    const p = `${px(pts[i].x).toFixed(1)},${py(pts[i].y).toFixed(1)}`;
    const last = runs[runs.length - 1];
    if (last && last.color === c) last.pts.push(p);
    else runs.push({ color: c, pts: last ? [last.pts[last.pts.length - 1], p] : [p] });
  }
  let dot: { x: number; y: number } | null = null;
  if (props.cursorDistance !== null) {
    const closest = pts.reduce((best, p) => (Math.abs(p.d - props.cursorDistance!) < Math.abs(best.d - props.cursorDistance!) ? p : best));
    dot = { x: px(closest.x), y: py(closest.y) };
  }
  const start = { x: px(pts[0].x), y: py(pts[0].y) };

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Polyline
            points={pts.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={colors.border}
            strokeWidth={9}
            strokeLinejoin="round"
          />
          {runs.map((r, i) => (
            <Polyline key={i} points={r.pts.join(" ")} fill="none" stroke={r.color} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          <Rect x={start.x - 6} y={start.y - 6} width={12} height={12} fill={colors.checkerLight} stroke={colors.bg} strokeWidth={2} />
          {dot && <Circle cx={dot.x} cy={dot.y} r={6} fill={colors.amber} stroke={colors.bg} strokeWidth={2} />}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 6 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { color: colors.accent, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  readout: { color: colors.text, fontSize: 11, fontFamily: fonts.mono, flexShrink: 1, textAlign: "right" },
});
