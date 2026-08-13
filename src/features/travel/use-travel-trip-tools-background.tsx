import { LinearGradient } from "expo-linear-gradient";
import { useMemo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";

import {
  usePageSurfaceBackground,
  useSafeAreaChrome,
  useSafeAreaChromeOverlay,
} from "@/components/primitives";
import { useTheme } from "@/hooks/use-theme";

const TRIP_TOOLS_ATLAS = require("../../../assets/images/travel/trip-tools-atlas-v1.png");
const TRIP_TOOLS_SKY_LIGHT = "#C8EAF5";
const TRIP_TOOLS_SKY_DARK = "#102A3A";

/**
 * Full-window travel-desk atlas behind Trip Tools.
 * Mirrors Travel Home's scenic app-shell chrome so the art continues through
 * the status bar and stays fixed while the glass tool groups scroll.
 */
export function useTravelTripToolsBackground() {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const dark = theme.name === "dark";
  const sky = dark ? TRIP_TOOLS_SKY_DARK : TRIP_TOOLS_SKY_LIGHT;
  const veil = useMemo(
    () => (
      <LinearGradient
        colors={
          dark
            ? ["rgba(4,18,29,0.74)", "rgba(7,24,37,0.66)", "rgba(4,16,27,0.78)"]
            : [
                "rgba(238,249,253,0.30)",
                "rgba(247,251,252,0.12)",
                "rgba(232,246,250,0.22)",
              ]
        }
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
    ),
    [dark],
  );

  useSafeAreaChrome(sky, {
    backgroundImage: TRIP_TOOLS_ATLAS,
    backgroundImageHeight: height,
    backgroundImageBlurRadius: 0,
    priority: 1,
  });
  useSafeAreaChromeOverlay(veil, height, { priority: 1 });
  usePageSurfaceBackground(sky, { priority: 1 });
}
