import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  AUTH_COPY_SCALE_MIN,
  AUTH_COPY_HEIGHT,
  AUTH_COPY_PLANET_PAD,
  AUTH_COPY_TOP,
  AUTH_COPY_WIDTH,
  AUTH_ORBIT_ELLIPSE,
  AUTH_ORBIT_LABEL_REF_SLOT,
  AUTH_ORBIT_NODES,
  authCopyFrame,
  authCopyMaxHeightFrac,
  authLowSweepMinY,
  authOrbitLabelStyle,
  authOrbitPoint,
  authPlanetRadiusFrac,
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
