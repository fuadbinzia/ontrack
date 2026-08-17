/**
 * Auth constellation geometry — satellites ring the hero copy (the sun).
 * Fractions are of canvas height/width unless noted.
 */

export type AuthOrbitNode = {
  tab: string;
  /** Degrees from +x, CCW, in a y-down canvas. */
  deg: number;
  x: number;
  y: number;
  dropWhenCompact?: boolean;
};

export type AuthOrbitEllipse = {
  cx: number;
  cy: number;
  /** Horizontal radius (canvas width fraction). */
  rx: number;
  /** Vertical radius (canvas height fraction). */
  ry: number;
};

/**
 * Full circle centred on the welcome copy. Wide enough that the planet can
 * hold the full intro; wells still clear the canvas edge under sway.
 */
export const AUTH_ORBIT_ELLIPSE: AuthOrbitEllipse = {
  cx: 0.5,
  cy: 0.5,
  rx: 0.4,
  ry: 0.4,
};

/** Dotted guides: concentric with the satellite ring. */
export const AUTH_ORBIT_GUIDES: readonly AuthOrbitEllipse[] = [
  AUTH_ORBIT_ELLIPSE,
  { ...AUTH_ORBIT_ELLIPSE, rx: 0.3, ry: 0.3 },
  { ...AUTH_ORBIT_ELLIPSE, rx: 0.48, ry: 0.48 },
];

/** Clockwise from upper-left so the top sweep reads Social → Calendar → Travel. */
const AUTH_ORBIT_TABS: readonly {
  tab: string;
  dropWhenCompact?: boolean;
}[] = [
  { tab: 'social' },
  { tab: 'calendar' },
  { tab: 'travel' },
  { tab: 'workouts' },
  { tab: 'food' },
  { tab: 'health', dropWhenCompact: true },
  { tab: 'finance' },
  { tab: 'vehicles' },
  { tab: 'vision-board' },
  { tab: 'to-do' },
  { tab: 'journal' },
  { tab: 'games', dropWhenCompact: true },
];

/** First satellite sits left of top; remaining tabs space evenly around 360°. */
const AUTH_ORBIT_START_DEG = 234;

export function authOrbitPoint(
  degrees: number,
  ellipse: AuthOrbitEllipse = AUTH_ORBIT_ELLIPSE,
): { x: number; y: number } {
  const t = (degrees * Math.PI) / 180;
  return {
    x: ellipse.cx + ellipse.rx * Math.cos(t),
    y: ellipse.cy + ellipse.ry * Math.sin(t),
  };
}

export function authOrbitNodesForTabs(
  tabs: readonly { tab: string; dropWhenCompact?: boolean }[] = AUTH_ORBIT_TABS,
  ellipse: AuthOrbitEllipse = AUTH_ORBIT_ELLIPSE,
): AuthOrbitNode[] {
  const step = 360 / tabs.length;
  return tabs.map(({ tab, dropWhenCompact }, index) => {
    const deg = AUTH_ORBIT_START_DEG + index * step;
    const { x, y } = authOrbitPoint(deg, ellipse);
    return { tab, deg, x, y, dropWhenCompact };
  });
}

/**
 * Satellites evenly spaced on the centred circle. Positions are the rest pose;
 * the live hero advances each `deg` so icons orbit the text.
 */
export const AUTH_ORBIT_NODES: readonly AuthOrbitNode[] = authOrbitNodesForTabs();

/** Matches constellation `well` sizing (`height * 0.115`). */
export const AUTH_ORBIT_WELL_FRAC = 0.115;
/** Clear air between planet rim and satellite wells. */
export const AUTH_PLANET_ICON_GAP_FRAC = 0.035;
/** Extra inset so glyphs stay inside the planet face (not on the rim). */
export const AUTH_COPY_PLANET_PAD = 0.03;
/**
 * Copy column as a share of the inner planet diameter. Wide enough to use
 * the side room inside the disc — type size is unchanged.
 */
export const AUTH_COPY_INNER_WIDTH = 0.86;

/** Planet radius as a canvas fraction (orbit minus well/2 minus gap). */
export function authPlanetRadiusFrac(
  ellipse: AuthOrbitEllipse = AUTH_ORBIT_ELLIPSE,
  wellFrac: number = AUTH_ORBIT_WELL_FRAC,
  gapFrac: number = AUTH_PLANET_ICON_GAP_FRAC,
): number {
  return Math.max(
    0.18,
    Math.min(ellipse.rx, ellipse.ry) - wellFrac / 2 - gapFrac,
  );
}

/** Live planet radius in px — matches constellation `Planet` (min side + well clamp). */
export function authPlanetRadiusPx(
  canvasW: number,
  canvasH: number,
  wellPx: number = Math.min(48, Math.max(30, canvasH * AUTH_ORBIT_WELL_FRAC)),
): number {
  const orbitPx = Math.min(
    canvasW * AUTH_ORBIT_ELLIPSE.rx,
    canvasH * AUTH_ORBIT_ELLIPSE.ry,
  );
  const gap = Math.min(canvasW, canvasH) * AUTH_PLANET_ICON_GAP_FRAC;
  return Math.max(0, orbitPx - wellPx / 2 - gap);
}

/**
 * Copy band centred on the planet — width/height satisfy
 * `(w/2)² + (h/2)² ≤ (planetR − pad)²` so text cannot spill past the disc.
 */
const AUTH_COPY_INNER_R =
  authPlanetRadiusFrac() - AUTH_COPY_PLANET_PAD;
export const AUTH_COPY_WIDTH = AUTH_COPY_INNER_R * 2 * AUTH_COPY_INNER_WIDTH;
export const AUTH_COPY_HEIGHT =
  2 *
  Math.sqrt(
    Math.max(0, AUTH_COPY_INNER_R ** 2 - (AUTH_COPY_WIDTH / 2) ** 2),
  );

/** Top of the copy band — derived from the ring centre. */
export const AUTH_COPY_TOP =
  AUTH_ORBIT_ELLIPSE.cy - AUTH_COPY_HEIGHT / 2;

/** Full-size copy reference height; shorter canvases scale type down. */
export const AUTH_COPY_BASE_HEIGHT = 390;
/** Floor so ring copy cannot shrink to an unreadable size. */
export const AUTH_COPY_SCALE_MIN = 0.75;

/** Breathing room so orbiting wells cannot kiss the intro. */
export const AUTH_COPY_CLEAR_PAD = 0.045;

/**
 * Horizontal + vertical frame for hero copy — locked to the orbit centre so
 * the intro is the sun the satellites ride around.
 */
export function authCopyFrame(
  ellipse: AuthOrbitEllipse = AUTH_ORBIT_ELLIPSE,
  widthFrac: number = AUTH_COPY_WIDTH,
  heightFrac: number = AUTH_COPY_HEIGHT,
): { left: number; top: number; width: number; height: number; center: number } {
  return {
    left: ellipse.cx - widthFrac / 2,
    top: ellipse.cy - heightFrac / 2,
    width: widthFrac,
    height: heightFrac,
    center: ellipse.cx,
  };
}

/**
 * Pixel copy band inscribed in the live planet. Uses the same radius as the
 * disc (min of canvas sides) so a wide/short slot cannot stretch text into the rim.
 */
export function authCopyFramePx(
  canvasW: number,
  canvasH: number,
  wellPx?: number,
): { left: number; top: number; width: number; height: number; center: number } {
  const cx = canvasW * AUTH_ORBIT_ELLIPSE.cx;
  const cy = canvasH * AUTH_ORBIT_ELLIPSE.cy;
  const innerR = Math.max(
    0,
    authPlanetRadiusPx(canvasW, canvasH, wellPx) -
      Math.min(canvasW, canvasH) * AUTH_COPY_PLANET_PAD,
  );
  const width = innerR * 2 * AUTH_COPY_INNER_WIDTH;
  const height =
    2 * Math.sqrt(Math.max(0, innerR ** 2 - (width / 2) ** 2));
  return {
    left: cx - width / 2,
    top: cy - height / 2,
    width,
    height,
    center: cx,
  };
}

/** Nodes at/below this Y own the low sweep (rest pose). */
const LOW_SWEEP_Y = 0.7;

export function authLowSweepMinY(
  nodes: readonly AuthOrbitNode[] = AUTH_ORBIT_NODES,
): number {
  const ys = nodes.filter((node) => node.y >= LOW_SWEEP_Y).map((node) => node.y);
  return ys.length ? Math.min(...ys) : 1;
}

/**
 * Max copy block height as a canvas fraction. Prefer the centred copy band;
 * never grow past the inner clear line under the rest-pose low sweep.
 */
export function authCopyMaxHeightFrac(
  wellFrac: number,
  nodes: readonly AuthOrbitNode[] = AUTH_ORBIT_NODES,
): number {
  const wellTop = authLowSweepMinY(nodes) - wellFrac / 2;
  const fromSweep = Math.max(
    0.22,
    wellTop - AUTH_COPY_CLEAR_PAD - AUTH_COPY_TOP,
  );
  return Math.min(AUTH_COPY_HEIGHT, fromSweep);
}

/**
 * Slot width that fits the longest orbit label ("Checklists") at caption size.
 * All labels share one scale from this — never per-word `fit` shrink.
 */
export const AUTH_ORBIT_LABEL_REF_SLOT = 76;

export function authOrbitLabelStyle(
  slot: number,
  caption: { fontSize: number; lineHeight: number },
): {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  width: '100%';
} {
  const scale = Math.min(1, Math.max(0.75, slot / AUTH_ORBIT_LABEL_REF_SLOT));
  return {
    fontSize: caption.fontSize * scale,
    lineHeight: caption.lineHeight * scale,
    letterSpacing: 0,
    width: '100%',
  };
}

export { AUTH_ORBIT_START_DEG, AUTH_ORBIT_TABS };
