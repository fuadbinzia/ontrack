import { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, {
    Circle,
    Defs,
    LinearGradient,
    Path,
    Pattern,
    Rect,
    Stop,
} from 'react-native-svg';

import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import {
    ATLAS_COUNTRIES,
    TRAVEL_MAP_FLAT_VIEWBOX,
    TRAVEL_MAP_INK,
    TRAVEL_MAP_LAND_COLORS,
    TRAVEL_MAP_OCEAN_BOTTOM,
    TRAVEL_MAP_OCEAN_MIDDLE,
    TRAVEL_MAP_OCEAN_TOP,
    TRAVEL_MAP_VIEWBOX,
    atlasCountryAtCoordinate,
    atlasCountryByCode,
    invertTravelCoordinate,
} from './country-data';
import type { TravelMapCountryCluster } from './model';
import { isDrawableSvgPath } from './svg-path';
import { TravelMapPinButton } from './travel-map-pin-button';

type Layout = { width: number; height: number };

export const TravelMapWorldFlat = memo(function TravelMapWorldFlat({
  clusters,
  onCountryPress,
}: {
  clusters: TravelMapCountryCluster[];
  onCountryPress: (countryCode: string) => void;
}) {
  const [layout, setLayout] = useState<Layout>({ width: 1, height: 1 });
  const clusterMarkers = useMemo(
    () => clusters.flatMap((cluster) => {
      const country = atlasCountryByCode(cluster.countryCode);
      return country ? [{ cluster, country }] : [];
    }),
    [clusters],
  );

  const updateLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setLayout({ width, height });
  };

  const selectCountryAtPoint = useCallback(
    (x: number, y: number) => {
      if (layout.width <= 1 || layout.height <= 1) return;
      const coordinate = invertTravelCoordinate(
        (x / layout.width) * TRAVEL_MAP_FLAT_VIEWBOX.width,
        (y / layout.height) * TRAVEL_MAP_FLAT_VIEWBOX.height,
      );
      if (!coordinate) return;
      const country = atlasCountryAtCoordinate(
        coordinate.latitude,
        coordinate.longitude,
      );
      if (country) onCountryPress(country.code);
    },
    [layout.height, layout.width, onCountryPress],
  );

  return (
    <AgentTestId
      testID={AgentUiIds.travel.map.flatWorld}
      label="Full-screen flat world map"
      style={styles.root}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={updateLayout}
        onStartShouldSetResponder={() => true}
        onResponderRelease={(event) => {
          selectCountryAtPoint(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
          );
        }}>
        <Svg
          pointerEvents="none"
          width="100%"
          height="100%"
          viewBox={`0 0 ${TRAVEL_MAP_FLAT_VIEWBOX.width} ${TRAVEL_MAP_FLAT_VIEWBOX.height}`}
          preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="flatOcean" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={TRAVEL_MAP_OCEAN_TOP} />
              <Stop offset="0.55" stopColor={TRAVEL_MAP_OCEAN_MIDDLE} />
              <Stop offset="1" stopColor={TRAVEL_MAP_OCEAN_BOTTOM} />
            </LinearGradient>
            <Pattern id="flatPaper" width="24" height="24" patternUnits="userSpaceOnUse">
              <Circle cx="4" cy="6" r="1.4" fill="rgba(255,255,255,0.16)" />
              <Circle cx="18" cy="17" r="1" fill="rgba(10,72,98,0.09)" />
            </Pattern>
          </Defs>
          <Rect
            width={TRAVEL_MAP_VIEWBOX.width}
            height={TRAVEL_MAP_VIEWBOX.height}
            fill="url(#flatOcean)"
          />
          <Rect
            width={TRAVEL_MAP_VIEWBOX.width}
            height={TRAVEL_MAP_VIEWBOX.height}
            fill="url(#flatPaper)"
          />
          <Path
            d="M40 128 C130 92 205 158 300 120 S490 86 590 126"
            fill="none"
            stroke="rgba(235,252,250,0.38)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Path
            d="M360 390 C470 350 555 424 675 380 S865 346 970 392"
            fill="none"
            stroke="rgba(16,83,109,0.22)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {ATLAS_COUNTRIES.map((country) =>
            isDrawableSvgPath(country.path) ? (
              <Path
                key={`shadow-${country.code}`}
                d={country.path}
                fill={TRAVEL_MAP_INK}
                opacity="0.18"
                transform="translate(2 3)"
                pointerEvents="none"
              />
            ) : null,
          )}
          {ATLAS_COUNTRIES.map((country, index) =>
            isDrawableSvgPath(country.path) ? (
              <Path
                key={country.code}
                d={country.path}
                fill={TRAVEL_MAP_LAND_COLORS[index % TRAVEL_MAP_LAND_COLORS.length]}
                stroke={TRAVEL_MAP_INK}
                strokeOpacity="0.64"
                strokeWidth="0.95"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            ) : null,
          )}
        </Svg>

        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {clusterMarkers.map(({ cluster, country }) => (
            <TravelMapPinButton
              key={cluster.countryCode}
              testID={AgentUiIds.travel.map.countryCluster(cluster.countryCode)}
              label={`${cluster.countryName}, ${cluster.visits.length} trip${
                cluster.visits.length === 1 ? '' : 's'
              }`}
              colors={cluster.colors}
              left={country.center[0] / TRAVEL_MAP_FLAT_VIEWBOX.width * layout.width}
              top={country.center[1] / TRAVEL_MAP_FLAT_VIEWBOX.height * layout.height}
              onPress={() => onCountryPress(cluster.countryCode)}
            />
          ))}
        </View>
      </View>
    </AgentTestId>
  );
});

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    backgroundColor: TRAVEL_MAP_OCEAN_BOTTOM,
  },
});
