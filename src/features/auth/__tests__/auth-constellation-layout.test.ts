import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  AUTH_COPY_SCALE_MIN,
  AUTH_COPY_HEIGHT,
  AUTH_COPY_INNER_WIDTH,
  AUTH_COPY_PLANET_PAD,
  AUTH_COPY_TOP,
  AUTH_COPY_WIDTH,
  AUTH_ORBIT_ELLIPSE,
  AUTH_ORBIT_LABEL_REF_SLOT,
  AUTH_ORBIT_NODES,
  authCopyFrame,
  authCopyFramePx,
  authCopyMaxHeightFrac,
  authLowSweepMinY,
  authOrbitLabelStyle,
  authOrbitPoint,
  authPlanetRadiusFrac,
  authPlanetRadiusPx,
} from '@/features/auth/auth-constellation-layout';

describe('auth constellation layout clearance', () => {
  it('keeps the copy band inside the ring clear-line', () => {
    const wellFrac = 0.115;
    const copyBottom = AUTH_COPY_TOP + authCopyMaxHeightFrac(wellFrac);
    const lowTop = authLowSweepMinY() - wellFrac / 2;

    expect(copyBottom).toBeLessThan(lowTop);
  });

  it('centres the ring on the copy (text is the sun)', () => {
    const frame = authCopyFrame();
    expect(frame.center).toBeCloseTo(AUTH_ORBIT_ELLIPSE.cx, 5);
    expect(frame.left + frame.width / 2).toBeCloseTo(AUTH_ORBIT_ELLIPSE.cx, 5);
    expect(frame.top + frame.height / 2).toBeCloseTo(AUTH_ORBIT_ELLIPSE.cy, 5);
    expect(frame.width).toBe(AUTH_COPY_WIDTH);
    expect(frame.height).toBe(AUTH_COPY_HEIGHT);
  });

  it('keeps the copy band inside the planet disc', () => {
    const r = authPlanetRadiusFrac() - AUTH_COPY_PLANET_PAD;
    const frame = authCopyFrame();
    const corners = [
      { x: frame.left, y: frame.top },
      { x: frame.left + frame.width, y: frame.top },
      { x: frame.left, y: frame.top + frame.height },
      { x: frame.left + frame.width, y: frame.top + frame.height },
    ];
    for (const corner of corners) {
      const dx = corner.x - AUTH_ORBIT_ELLIPSE.cx;
      const dy = corner.y - AUTH_ORBIT_ELLIPSE.cy;
      expect(dx * dx + dy * dy).toBeLessThanOrEqual(r * r + 1e-9);
    }
  });

  it('uses the side room inside the planet without leaving the disc', () => {
    const innerD = (authPlanetRadiusFrac() - AUTH_COPY_PLANET_PAD) * 2;
    expect(AUTH_COPY_INNER_WIDTH).toBeGreaterThanOrEqual(0.82);
    expect(AUTH_COPY_INNER_WIDTH).toBeLessThan(1);
    expect(AUTH_COPY_WIDTH).toBeCloseTo(innerD * AUTH_COPY_INNER_WIDTH, 5);
    expect(AUTH_COPY_WIDTH).toBeGreaterThan(innerD * 0.8);
  });

  it('inscribes the live copy band in the planet on a wide short canvas', () => {
    const canvasW = 430;
    const canvasH = 280;
    const well = Math.min(48, Math.max(30, canvasH * 0.115));
    const innerR =
      authPlanetRadiusPx(canvasW, canvasH, well) -
      Math.min(canvasW, canvasH) * AUTH_COPY_PLANET_PAD;
    const frame = authCopyFramePx(canvasW, canvasH, well);
    const cx = canvasW * AUTH_ORBIT_ELLIPSE.cx;
    const cy = canvasH * AUTH_ORBIT_ELLIPSE.cy;
    const corners = [
      { x: frame.left, y: frame.top },
      { x: frame.left + frame.width, y: frame.top },
      { x: frame.left, y: frame.top + frame.height },
      { x: frame.left + frame.width, y: frame.top + frame.height },
    ];
    for (const corner of corners) {
      const dx = corner.x - cx;
      const dy = corner.y - cy;
      expect(dx * dx + dy * dy).toBeLessThanOrEqual(innerR * innerR + 1e-6);
    }
    expect(frame.width).toBeCloseTo(innerR * 2 * AUTH_COPY_INNER_WIDTH, 5);
    expect(frame.width).toBeLessThan(canvasW * 0.42);
  });

  it('keeps the same fill ratio on a square phone canvas', () => {
    const canvas = 390;
    const well = Math.min(48, Math.max(30, canvas * 0.115));
    const innerR =
      authPlanetRadiusPx(canvas, canvas, well) - canvas * AUTH_COPY_PLANET_PAD;
    const frame = authCopyFramePx(canvas, canvas, well);
    expect(frame.width / (innerR * 2)).toBeCloseTo(AUTH_COPY_INNER_WIDTH, 5);
    expect(frame.left + frame.width / 2).toBeCloseTo(canvas / 2, 5);
  });

  it('includes Journal among the orbiting features', () => {
    expect(AUTH_ORBIT_NODES.some((node) => node.tab === 'journal')).toBe(true);
  });

  it('keeps Food inside the right edge at rest (well + label clearance)', () => {
    const food = AUTH_ORBIT_NODES.find((node) => node.tab === 'food');
    expect(food?.x).toBeLessThanOrEqual(0.9);
    expect(AUTH_ORBIT_ELLIPSE.cx + AUTH_ORBIT_ELLIPSE.rx).toBeLessThanOrEqual(
      0.9,
    );
  });

  it('rides a full circle centred on the copy', () => {
    expect(AUTH_ORBIT_ELLIPSE.rx).toBe(AUTH_ORBIT_ELLIPSE.ry);
    expect(AUTH_ORBIT_ELLIPSE.cx).toBe(0.5);
    expect(AUTH_ORBIT_ELLIPSE.cy).toBe(0.5);
  });

  it('keeps every satellite on the shared ellipse', () => {
    for (const node of AUTH_ORBIT_NODES) {
      const nx = (node.x - AUTH_ORBIT_ELLIPSE.cx) / AUTH_ORBIT_ELLIPSE.rx;
      const ny = (node.y - AUTH_ORBIT_ELLIPSE.cy) / AUTH_ORBIT_ELLIPSE.ry;
      expect(nx * nx + ny * ny).toBeCloseTo(1, 5);
    }
  });

  it('spaces satellites evenly around the copy', () => {
    const degs = AUTH_ORBIT_NODES.map((node) => node.deg);
    const step = 360 / degs.length;
    for (let i = 1; i < degs.length; i += 1) {
      expect((degs[i]! - degs[i - 1]! + 360) % 360).toBeCloseTo(step, 5);
    }
  });

  it('floors canvas type scale so ring copy cannot crush', () => {
    expect(AUTH_COPY_SCALE_MIN).toBeGreaterThanOrEqual(0.75);
  });

  it('sizes every orbit label from the slot, not the word length', () => {
    const caption = { fontSize: 12.5, lineHeight: 17 };
    const wide = authOrbitLabelStyle(AUTH_ORBIT_LABEL_REF_SLOT + 20, caption);
    const tight = authOrbitLabelStyle(58, caption);

    expect(wide.fontSize).toBe(caption.fontSize);
    expect(wide.letterSpacing).toBe(0);
    expect(tight.fontSize).toBeLessThan(caption.fontSize);
    expect(tight.fontSize).toBe(caption.fontSize * Math.max(0.75, 58 / AUTH_ORBIT_LABEL_REF_SLOT));
    expect(tight.letterSpacing).toBe(0);
    expect(authOrbitLabelStyle(58, caption)).toEqual(tight);
  });

  it('sizes welcome and sign-in copy from the live planet, not canvas width', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/auth/auth-constellation.tsx'),
      'utf8',
    );
    expect(source).toContain('authCopyFramePx');
    expect(source).not.toMatch(/width \* copyFrame\.(left|width)/);
  });

  it('does not fit-shrink orbit labels per word', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/auth/auth-constellation.tsx'),
      'utf8',
    );
    expect(source).toContain('authOrbitLabelStyle');
    expect(source).not.toMatch(
      /<AppText[\s\S]*?variant="caption"[\s\S]*?fit>/,
    );
  });

  it('exposes authOrbitPoint for the same ring', () => {
    const top = authOrbitPoint(270);
    expect(top.x).toBeCloseTo(AUTH_ORBIT_ELLIPSE.cx, 5);
    expect(top.y).toBeCloseTo(
      AUTH_ORBIT_ELLIPSE.cy - AUTH_ORBIT_ELLIPSE.ry,
      5,
    );
  });
});
