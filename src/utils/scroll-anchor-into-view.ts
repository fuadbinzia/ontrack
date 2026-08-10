import type { ScrollView, View } from 'react-native';

const DEFAULT_EDGE_PAD = 24;

/**
 * Scroll a Screen ScrollView so `anchor` sits inside the visible viewport.
 * Uses measureInWindow — works for nested timeline / list rows.
 */
export function scrollAnchorIntoView(
  scrollView: ScrollView | null,
  anchor: View | null,
  offsetY: number,
  options?: { edgePad?: number; animated?: boolean },
): void {
  if (!scrollView || !anchor) return;
  const edgePad = options?.edgePad ?? DEFAULT_EDGE_PAD;
  const animated = options?.animated ?? true;
  const viewport = scrollView as ScrollView & {
    measureInWindow?: View['measureInWindow'];
  };
  if (typeof viewport.measureInWindow !== 'function') return;
  anchor.measureInWindow((ax, ay, _aw, ah) => {
    viewport.measureInWindow?.((_sx, sy, _sw, sh) => {
      if (
        ![ay, ah, sy, sh, offsetY].every(
          (n) => typeof n === 'number' && Number.isFinite(n),
        )
      ) {
        return;
      }
      const visibleTop = sy + edgePad;
      const visibleBottom = sy + sh - edgePad;
      const targetBottom = ay + ah;
      let delta = 0;
      if (targetBottom > visibleBottom) {
        delta = targetBottom - visibleBottom;
      } else if (ay < visibleTop) {
        delta = ay - visibleTop;
      }
      if (Math.abs(delta) < 1) return;
      scrollView.scrollTo({
        y: Math.max(0, offsetY + delta),
        animated,
      });
    });
  });
}
