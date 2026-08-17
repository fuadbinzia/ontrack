import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, View } from "react-native";

import { motion } from "@/design-system";
import { useTheme } from "@/hooks/use-theme";

const ITINERARY_JOURNEY_ATLAS = require("../../../assets/images/travel/itinerary-journey-atlas-v1.png");

/** Atlas wash — Android has no BlurView, so the watercolor must sit quieter. */
export function itineraryJourneyWashColors(options: {
  dark: boolean;
  android?: boolean;
}): [string, string, string] {
  const android = options.android ?? Platform.OS === "android";
  if (options.dark) {
    return android
      ? ["rgba(4,18,28,0.78)", "rgba(5,20,31,0.72)", "rgba(3,15,25,0.84)"]
      : ["rgba(4,18,28,0.66)", "rgba(5,20,31,0.58)", "rgba(3,15,25,0.72)"];
  }
  return android
    ? ["rgba(245,251,250,0.54)", "rgba(248,251,250,0.44)", "rgba(238,248,246,0.58)"]
    : [
        "rgba(245,251,250,0.26)",
        "rgba(248,251,250,0.10)",
        "rgba(238,248,246,0.22)",
      ];
}

/** Fixed illustrated journey layer that begins below the itinerary sky hero. */
export function TravelItineraryBackground({ top }: { top: number }) {
  const theme = useTheme();
  const dark = theme.name === "dark";

  return (
    <View pointerEvents="none" style={[styles.layer, { top }]}>
      <Image
        source={ITINERARY_JOURNEY_ATLAS}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={{ top: "0%", left: "50%" }}
        transition={motion.fade}
      />
      <LinearGradient
        colors={itineraryJourneyWashColors({ dark })}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
  },
});
