import { placeTravelChatMessageMenu } from '@/features/travel/travel-chat-message-menu-layout';

const base = {
  reactionHeight: 56,
  actionsHeight: 180,
  gap: 8,
  topMin: 60,
  bottomMax: 700,
};

describe('placeTravelChatMessageMenu', () => {
  it('keeps reactions above and actions below when there is room', () => {
    const placement = placeTravelChatMessageMenu({
      ...base,
      anchor: { x: 40, y: 320, width: 200, height: 48 },
    });
    expect(placement.openActionsBelow).toBe(true);
    expect(placement.reactionTop).toBe(320 - 8 - 56);
    expect(placement.actionsTop).toBe(320 + 48 + 8);
    expect(placement.actionsTop + base.actionsHeight).toBeLessThanOrEqual(
      base.bottomMax,
    );
  });

  it('flips the action stack above the bubble near the bottom chrome', () => {
    // Bubble sits just above a tall tab dock / composer zone.
    const placement = placeTravelChatMessageMenu({
      ...base,
      bottomMax: 640,
      anchor: { x: 40, y: 520, width: 200, height: 48 },
    });
    expect(placement.openActionsBelow).toBe(false);
    expect(placement.actionsTop + base.actionsHeight).toBeLessThanOrEqual(520);
    expect(placement.reactionTop).toBeLessThan(placement.actionsTop);
    expect(placement.actionsTop + base.actionsHeight).toBeLessThanOrEqual(640);
  });

  it('never drops actions below bottomMax (tab dock / keyboard)', () => {
    const bottomMax = 600;
    const placement = placeTravelChatMessageMenu({
      ...base,
      bottomMax,
      anchor: { x: 40, y: 540, width: 200, height: 64 },
    });
    expect(placement.actionsTop + base.actionsHeight).toBeLessThanOrEqual(
      bottomMax,
    );
    expect(placement.reactionTop).toBeGreaterThanOrEqual(base.topMin);
  });
});
