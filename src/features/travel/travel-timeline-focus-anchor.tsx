import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { View, type ScrollView } from 'react-native';

import { scrollAnchorIntoView } from '@/utils/scroll-anchor-into-view';

/** Settle after Add sheet dismiss + day/item expand layout. */
const FOCUS_SETTLE_MS = 280;

/**
 * When `active`, scrolls the plan-detail Screen so this timeline row is in view.
 */
export function TravelTimelineFocusAnchor({
  active,
  scrollRef,
  scrollOffsetYRef,
  onHandled,
  children,
}: {
  active: boolean;
  scrollRef?: RefObject<ScrollView | null>;
  scrollOffsetYRef?: RefObject<number>;
  onHandled?: () => void;
  children: ReactNode;
}) {
  const anchorRef = useRef<View>(null);

  useEffect(() => {
    if (!active || !scrollRef || !scrollOffsetYRef) return;
    const timer = setTimeout(() => {
      scrollAnchorIntoView(
        scrollRef.current,
        anchorRef.current,
        scrollOffsetYRef.current,
        { animated: true },
      );
      onHandled?.();
    }, FOCUS_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [active, onHandled, scrollOffsetYRef, scrollRef]);

  return (
    <View ref={anchorRef} collapsable={false}>
      {children}
    </View>
  );
}
