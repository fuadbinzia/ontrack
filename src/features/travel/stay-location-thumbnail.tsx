import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { SymbolSize } from '@/components/primitives';
import { GlassIconWell, Symbol } from '@/components/primitives';
import {
  fetchPlaceCoverUri,
  stayCoverCandidates,
} from '@/features/travel/destination-cover';
import { fetchStayBrandMark } from '@/features/travel/stay-brand-lookup';
import { stayBrandDomain } from '@/features/travel/stay-company';
import { resolveTravelPhotoUris } from '@/features/travel/travel-moment-media';

function isSvgSource(uri: string): boolean {
  const lower = uri.toLowerCase();
  if (lower.includes('unavatar.io/')) return true;
  const path = uri.split('?')[0] ?? '';
  return path.endsWith('.svg');
}

async function fetchSvgXml(uri: string): Promise<string | undefined> {
  try {
    const response = await fetch(uri, {
      headers: { Accept: 'image/svg+xml,*/*' },
    });
    if (!response.ok) return undefined;
    const text = await response.text();
    return /<svg\b/i.test(text) ? text : undefined;
  } catch {
    return undefined;
  }
}

type BrandMark =
  | { kind: 'svg'; xml: string; domain: string }
  | { kind: 'raster'; uri: string; domain: string };

function BrandLogoMark({
  brandMark,
  title,
  onError,
}: {
  brandMark: BrandMark;
  title?: string;
  onError: () => void;
}) {
  const pixelSize = Math.round(64 * Math.max(3, PixelRatio.get()));
  const label = `${title?.trim() || brandMark.domain} logo`;
  if (brandMark.kind === 'svg') {
    return (
      <SvgXml
        xml={brandMark.xml}
        width="100%"
        height="100%"
        accessibilityLabel={label}
      />
    );
  }
  return (
    <Image
      source={{
        uri: brandMark.uri,
        width: pixelSize,
        height: pixelSize,
      }}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      transition={120}
      recyclingKey={`stay-brand:${brandMark.domain}@${pixelSize}`}
      cachePolicy="memory-disk"
      allowDownscaling={false}
      accessibilityIgnoresInvertColors
      accessibilityLabel={label}
      onError={onError}
    />
  );
}

/**
 * Stay kind-pill / summary mark:
 * company/OTA logo (no outer circle) → attached photo → place cover → bed icon in circle.
 */
export function StayLocationThumbnail({
  title,
  address,
  bookingUrl,
  photoUris,
  /** When set, owns chrome: logo = bare mark; otherwise circular well. */
  size,
  fallbackIconSize = 'lg',
  fallbackColor,
}: {
  title?: string;
  address?: string;
  bookingUrl?: string;
  photoUris?: string[];
  size?: number;
  fallbackIconSize?: SymbolSize;
  fallbackColor: string;
}) {
  const syncDomain = stayBrandDomain({ title, bookingUrl });
  const localPhoto = resolveTravelPhotoUris(photoUris)[0];
  const [brandMark, setBrandMark] = useState<BrandMark>();
  const [brandLookupDone, setBrandLookupDone] = useState(false);
  const [remoteUri, setRemoteUri] = useState<string>();
  const [photoFailed, setPhotoFailed] = useState(false);
  const queryKey = stayCoverCandidates(title, address).join('|');

  useEffect(() => {
    let active = true;
    setBrandMark(undefined);
    setBrandLookupDone(false);

    void (async () => {
      const mark = await fetchStayBrandMark({ title, bookingUrl });
      if (!active) return;
      if (!mark?.logoUri) {
        // Sync domain alone without a sharp logo — don't flash a soft favicon.
        setBrandLookupDone(true);
        return;
      }

      if (isSvgSource(mark.logoUri)) {
        const xml = await fetchSvgXml(mark.logoUri);
        if (!active) return;
        if (xml) {
          setBrandMark({ kind: 'svg', xml, domain: mark.domain });
          setBrandLookupDone(true);
          return;
        }
        setBrandLookupDone(true);
        return;
      }

      setBrandMark({
        kind: 'raster',
        uri: mark.logoUri,
        domain: mark.domain,
      });
      setBrandLookupDone(true);
    })();

    return () => {
      active = false;
    };
  }, [title, bookingUrl, syncDomain]);

  useEffect(() => {
    if (!brandLookupDone) return;
    if (brandMark) return;
    if (localPhoto) return;
    let active = true;
    setPhotoFailed(false);
    setRemoteUri(undefined);
    const candidates = stayCoverCandidates(title, address);
    if (!candidates.length) return;

    void fetchPlaceCoverUri(candidates).then((uri) => {
      if (!active) return;
      setRemoteUri(uri);
    });

    return () => {
      active = false;
    };
  }, [brandMark, brandLookupDone, localPhoto, queryKey, title, address]);

  const clearBrand = () => setBrandMark(undefined);

  // --- Company / OTA logo: bare mark (no white plate / outer circle) ---
  if (brandMark) {
    if (size != null) {
      const logoRadius = Math.max(6, Math.round(size * 0.22));
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: logoRadius,
            overflow: 'hidden',
          }}>
          <BrandLogoMark
            brandMark={brandMark}
            title={title}
            onError={clearBrand}
          />
        </View>
      );
    }
    return (
      <View style={StyleSheet.absoluteFill}>
        <BrandLogoMark
          brandMark={brandMark}
          title={title}
          onError={clearBrand}
        />
      </View>
    );
  }

  // Wait for brand discovery before falling back to place photos.
  if (!brandLookupDone && !localPhoto) {
    if (size != null) {
      return (
        <GlassIconWell size={size} borderRadius={size / 2}>
          <Symbol
            name="lodging"
            size={fallbackIconSize}
            color={fallbackColor}
          />
        </GlassIconWell>
      );
    }
    return (
      <Symbol name="lodging" size={fallbackIconSize} color={fallbackColor} />
    );
  }

  // --- Place / attached photo ---
  const photoUri = localPhoto ?? (!photoFailed ? remoteUri : undefined);
  if (photoUri) {
    const photo = (
      <Image
        source={{ uri: photoUri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={160}
        recyclingKey={`stay-thumb:${photoUri}`}
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
        accessibilityLabel={title?.trim() || 'Stay photo'}
        onError={() => setPhotoFailed(true)}
      />
    );
    if (size != null) {
      return (
        <GlassIconWell size={size} borderRadius={size / 2}>
          <View style={StyleSheet.absoluteFill}>{photo}</View>
        </GlassIconWell>
      );
    }
    return <View style={StyleSheet.absoluteFill}>{photo}</View>;
  }

  if (size != null) {
    return (
      <GlassIconWell size={size} borderRadius={size / 2}>
        <Symbol name="lodging" size={fallbackIconSize} color={fallbackColor} />
      </GlassIconWell>
    );
  }

  return (
    <Symbol name="lodging" size={fallbackIconSize} color={fallbackColor} />
  );
}
