import { relativeLuminanceFromHex, parseHexRgb } from '@/features/travel/travel-home-atmosphere-ink';
import { formatMinutes } from '@/utils/date';

/**
 * Kind accents from light theme (#315A7C flight) wash out on dark artwork glass.
 * Lift toward white until the stroke/label stays readable.
 */
export function accentForArtworkGlass(accent: string, darkGlass: boolean): string {
  if (!darkGlass) return accent;
  const luma = relativeLuminanceFromHex(accent);
  const rgb = parseHexRgb(accent);
  if (!rgb || luma === undefined || luma >= 0.45) return accent;
  const t = Math.min(0.72, (0.5 - luma) / 0.5);
  const to = (n: number) =>
    Math.round(n + (255 - n) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`.toUpperCase();
}

export function timeLabel(minutes?: number): string {
  return minutes !== undefined ? formatMinutes(minutes) : '—';
}

export function codeLabel(airport?: string): string {
  return airport?.trim().toUpperCase() ?? '';
}
