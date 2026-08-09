import { useEffect } from 'react';

import type { StayBookingOpen } from '@/features/travel/booking-open';
import { openInAppBrowser } from '@/utils/safe-url';

type WebViewOpen = Extract<StayBookingOpen, { mode: 'webview' }>;

interface BookingOpenSheetProps {
  target: WebViewOpen | null;
  onClose: () => void;
}

export function BookingOpenSheet({ target, onClose }: BookingOpenSheetProps) {
  useEffect(() => {
    if (!target) return;
    let mounted = true;
    void openInAppBrowser(target.url).finally(() => {
      if (mounted) {
        onClose();
      }
    });
    return () => {
      mounted = false;
    };
  }, [target, onClose]);

  return null;
}
