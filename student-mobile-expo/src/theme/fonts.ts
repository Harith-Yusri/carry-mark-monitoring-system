import { Platform } from "react-native";

export const fonts = {
  sans: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
  sansMedium: Platform.select({ ios: "System", android: "sans-serif-medium", default: "System" }),
  display: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
};
