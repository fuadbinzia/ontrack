/**
 * Checklist hub must mount every card on first paint. Default FlatList
 * windowing (~10 rows) is the “some lists, then the rest load in” glitch.
 */
export function checklistHubWindowing(listCount: number) {
  const count = Math.max(0, Math.floor(listCount));
  const render = Math.max(count, 1);
  return {
    initialNumToRender: render,
    maxToRenderPerBatch: render,
    windowSize: render + 1,
    updateCellsBatchingPeriod: 0,
    removeClippedSubviews: false as const,
  };
}
