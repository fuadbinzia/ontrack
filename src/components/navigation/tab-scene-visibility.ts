/**
 * Keep parked tab scenes painted so the pager slides real pixels.
 *
 * Expo Router's vendored bottom-tabs marks non-focused tabs `STATE_INACTIVE`
 * when no tab animation is configured. With `detachInactiveScreens={false}`
 * react-native-screens takes its JS fallback branch, which renders inactive
 * scenes with `display: 'none'` — the swipe pager then drags a blank page
 * until the commit flips display back and the tab repaints ("blank page
 * before showing the next page loaded").
 *
 * Supplying a `transitionSpec` flips `hasAnimation` on, which turns
 * `activityState` into an Animated node — the fallback treats that as
 * "keep painted" (`display: 'flex'`), Instagram's paint-then-translate.
 * Zero duration keeps the navigator's own animation inert; all motion
 * belongs to the pager (`tabSwipeX` in `tab-swipe.ts`).
 *
 * Do not reintroduce `animation: 'none'` on the Tabs screenOptions — an
 * explicit 'none' short-circuits `hasAnimation` and blanks parked lanes.
 */
export const TAB_SCENE_KEEP_PAINTED_SPEC = {
  animation: 'timing',
  config: { duration: 0 },
} as const;

const REST_SCENE_STYLE = { sceneStyle: {} } as const;

/** Never fade/shift scenes from the navigator — the pager owns all motion. */
export function tabSceneKeepPainted(): typeof REST_SCENE_STYLE {
  return REST_SCENE_STYLE;
}
