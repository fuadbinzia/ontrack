import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import type { AnatomySex, BodyView } from './muscle-data';
import { highlightImageForMuscle } from './muscle-highlight-images';

interface MuscleHighlightPlateProps {
  bodyView: BodyView;
  anatomySex: AnatomySex;
  /** Muscle target / atlas highlight id used to pick the pre-rendered plate. */
  muscleId?: string;
  isDarkMode?: boolean;
}

/**
 * Finished-art anatomy plate. Full plate is shown — do not crop the head under the chrome bar.
 */
export function MuscleHighlightPlate({
  bodyView,
  anatomySex,
  muscleId,
  isDarkMode = false,
}: MuscleHighlightPlateProps) {
  const source = highlightImageForMuscle(muscleId, bodyView, anatomySex);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image
        accessibilityIgnoresInvertColors
        contentFit="cover"
        recyclingKey={`${anatomySex}-${bodyView}-${muscleId ?? 'neutral'}`}
        source={source}
        style={StyleSheet.absoluteFill}
        transition={0}
      />
      {isDarkMode ? (
        <LinearGradient
          colors={[
            'rgba(0, 0, 0, 0.35)',
            'rgba(0, 0, 0, 0.15)',
            'rgba(0, 0, 0, 0.3)',
          ]}
          locations={[0, 0.5, 1]}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}
