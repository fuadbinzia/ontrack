import { clampNumber, type DropdownAnchor } from '@/components/primitives/dropdown-layout';

export type TravelChatMessageMenuPlacement = {
  reactionTop: number;
  actionsTop: number;
  /** Actions sit below the bubble when true; stacked above when false. */
  openActionsBelow: boolean;
};

/**
 * Place reaction + action popovers relative to a chat bubble.
 * Coords are overlay-local (same space as `anchor`).
 * `bottomMax` must clear the tab dock / keyboard — not only the home indicator.
 */
export function placeTravelChatMessageMenu(input: {
  anchor: DropdownAnchor;
  reactionHeight: number;
  actionsHeight: number;
  gap: number;
  topMin: number;
  /** Bottom of usable overlay in the same coords as `anchor` (exclusive). */
  bottomMax: number;
}): TravelChatMessageMenuPlacement {
  const { anchor, reactionHeight, actionsHeight, gap, topMin, bottomMax } =
    input;

  const anchorBottom = anchor.y + anchor.height;
  const spaceBelow = bottomMax - anchorBottom - gap;
  const spaceAbove = anchor.y - topMin - gap;
  const openActionsBelow = spaceBelow >= actionsHeight || spaceBelow >= spaceAbove;

  if (openActionsBelow) {
    const reactionTop = Math.max(topMin, anchor.y - gap - reactionHeight);
    const actionsTopIdeal = anchorBottom + gap;
    const actionsTopMax = bottomMax - actionsHeight;
    // Keep actions under the reaction strip when both fight for space.
    const actionsTopFloor = Math.min(
      reactionTop + reactionHeight + gap,
      Math.max(topMin, actionsTopMax),
    );
    const actionsTop = clampNumber(
      actionsTopIdeal,
      actionsTopFloor,
      Math.max(topMin, actionsTopMax),
    );
    return { reactionTop, actionsTop, openActionsBelow: true };
  }

  // Flip: [reactions] → [actions] → [bubble], kept above bottom chrome.
  let actionsTop = anchor.y - gap - actionsHeight;
  let reactionTop = actionsTop - gap - reactionHeight;

  if (reactionTop < topMin) {
    reactionTop = topMin;
    actionsTop = reactionTop + reactionHeight + gap;
  }

  if (actionsTop + actionsHeight > bottomMax) {
    actionsTop = Math.max(
      topMin + reactionHeight + gap,
      bottomMax - actionsHeight,
    );
    reactionTop = Math.max(topMin, actionsTop - gap - reactionHeight);
  }

  return { reactionTop, actionsTop, openActionsBelow: false };
}
