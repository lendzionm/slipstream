// Slipstream colour palette and fonts.
// Our own "carbon & red" racing style: carbon-black background, a red of our own
// (not any team's or F1's brand red) and chequered-flag accents.
// Change a colour here and it changes everywhere in the app.
import { Platform } from "react-native";

export const colors = {
  bg: "#0B0B0D", // app background (carbon black)
  card: "#15151A", // cards and tab bar
  cardActive: "#1D1A1D", // highlighted card (a hint of red)
  border: "#2A2A31", // thin lines between things
  text: "#F4F4F6", // main text
  muted: "#9C9CA7", // secondary text
  accent: "#FF3B3B", // bright red: text, lines and bars on dark backgrounds
  accentFill: "#CC1F2D", // deeper red: buttons and selected chips (with white text)
  onAccent: "#FFFFFF", // text on accentFill
  amber: "#FFB020", // "next" / warnings
  live: "#2ED47A", // green: live now / gained places
  checkerLight: "#E9E9EE", // chequered flag squares
  checkerDark: "#1E1E24",
};

// Monospace font for numbers (looks like timing screens).
export const fonts = {
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
};
