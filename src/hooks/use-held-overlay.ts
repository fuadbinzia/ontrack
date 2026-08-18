import { useEffect, useState } from 'react';

import { motion } from '@/design-system';

/**
 * Keep an overlay mounted through its fade-out so chrome never pops.
 * `holdMs` defaults to `motion.fade` (the shared exit duration).
 */
export function useHeldOverlay(active: boolean, holdMs: number = motion.fade): boolean {
  const [held, setHeld] = useState(active);
  useEffect(() => {
    if (active) {
      setHeld(true);
      return undefined;
    }
    const timer = setTimeout(() => setHeld(false), holdMs);
    return () => clearTimeout(timer);
  }, [active, holdMs]);
  return held || active;
}
