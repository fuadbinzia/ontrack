/** SVG building blocks for itinerary sky ground bands. */
import { Circle, G, Path, Rect } from 'react-native-svg';

import { SKY_VIEW_H } from '@/features/travel/travel-sky-plate';

/**
 * Snow / frost cap on a mountain peak — triangle from the apex partway
 * down each face so the ridge reads as iced, not flat silhouette fill.
 */
export function PeakFrost({
  ax,
  ay,
  lx,
  ly,
  rx,
  ry,
  fill,
  depth = 0.34,
}: {
  ax: number;
  ay: number;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  fill: string;
  /** 0…1 how far down each face the frost reaches. */
  depth?: number;
}) {
  const x1 = ax + (lx - ax) * depth;
  const y1 = ay + (ly - ay) * depth;
  const x2 = ax + (rx - ax) * depth;
  const y2 = ay + (ry - ay) * depth;
  return <Path d={`M${x1} ${y1} L${ax} ${ay} L${x2} ${y2} Z`} fill={fill} />;
}

export function Fir({
  x,
  y,
  h,
  fill,
}: {
  x: number;
  y: number;
  h: number;
  fill: string;
}) {
  const w = h * 0.55;
  return (
    <Path
      d={`M${x} ${y} L${x + w / 2} ${y - h} L${x + w} ${y} Z`}
      fill={fill}
    />
  );
}

export function Palm({
  x,
  y,
  fill,
}: {
  x: number;
  y: number;
  fill: string;
}) {
  return (
    <G>
      <Path
        d={`M${x} ${y} Q${x - 1} ${y - 18} ${x + 1} ${y - 28}`}
        stroke={fill}
        strokeWidth={1.4}
        fill="none"
      />
      <Path
        d={`M${x + 1} ${y - 26} Q${x - 10} ${y - 30} ${x - 14} ${y - 22}`}
        stroke={fill}
        strokeWidth={1.2}
        fill="none"
      />
      <Path
        d={`M${x + 1} ${y - 26} Q${x + 12} ${y - 32} ${x + 16} ${y - 22}`}
        stroke={fill}
        strokeWidth={1.2}
        fill="none"
      />
      <Path
        d={`M${x + 1} ${y - 26} Q${x + 4} ${y - 36} ${x - 2} ${y - 34}`}
        stroke={fill}
        strokeWidth={1.1}
        fill="none"
      />
    </G>
  );
}

export function Car({
  x,
  y,
  w,
  fill,
}: {
  x: number;
  y: number;
  w: number;
  fill: string;
}) {
  const h = w * 0.38;
  return (
    <G>
      <Path
        d={`M${x} ${y}
           H${x + w * 0.18}
           L${x + w * 0.28} ${y - h * 0.55}
           H${x + w * 0.68}
           L${x + w * 0.8} ${y}
           H${x + w}
           V${y + h * 0.45}
           H${x}
           Z`}
        fill={fill}
      />
      <Circle cx={x + w * 0.28} cy={y + h * 0.45} r={w * 0.08} fill={fill} />
      <Circle cx={x + w * 0.72} cy={y + h * 0.45} r={w * 0.08} fill={fill} />
    </G>
  );
}

export function House({
  x,
  y,
  w,
  h,
  fill,
  window,
  lit,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  window: string;
  lit: boolean;
}) {
  const roof = h * 0.45;
  return (
    <G>
      <Path
        d={`M${x} ${y - h}
           L${x + w / 2} ${y - h - roof}
           L${x + w} ${y - h}
           Z`}
        fill={fill}
      />
      <Rect x={x} y={y - h} width={w} height={h} fill={fill} />
      {lit ? (
        <>
          <Rect
            x={x + w * 0.18}
            y={y - h * 0.7}
            width={w * 0.22}
            height={h * 0.28}
            rx={0.6}
            fill={window}
          />
          <Rect
            x={x + w * 0.58}
            y={y - h * 0.7}
            width={w * 0.22}
            height={h * 0.28}
            rx={0.6}
            fill={window}
          />
        </>
      ) : null}
    </G>
  );
}

/**
 * Hallgrímskirkja — basalt-column wings stepping into a tall central tower.
 * Individual fins (with gaps) read as the church, not a generic skyscraper.
 */
export function Hallgrimskirkja({
  x,
  fill,
  window,
  lit,
}: {
  x: number;
  fill: string;
  window: string;
  lit: boolean;
}) {
  const baseY = SKY_VIEW_H - 2;
  /** Outer → inner wing column heights (mirrored). */
  const wingHs = [12, 18, 24, 30, 37, 44, 51, 58];
  const colW = 2.35;
  const gap = 0.5;
  const towerW = 11;
  const towerH = 76;
  const wingPitch = colW + gap;
  const wingSpan = wingHs.length * wingPitch - gap;
  const left0 = x - towerW / 2 - gap - wingSpan;

  return (
    <G>
      {/* Left basalt-column wing */}
      {wingHs.map((h, i) => (
        <Rect
          key={`L${i}`}
          x={left0 + i * wingPitch}
          y={baseY - h}
          width={colW}
          height={h}
          fill={fill}
        />
      ))}
      {/* Central tower + faceted spire */}
      <Rect
        x={x - towerW / 2}
        y={baseY - towerH}
        width={towerW}
        height={towerH}
        fill={fill}
      />
      <Path
        d={`M${x - towerW / 2 + 1.2} ${baseY - towerH}
           L${x} ${baseY - towerH - 10}
           L${x + towerW / 2 - 1.2} ${baseY - towerH}
           Z`}
        fill={fill}
      />
      {/* Right wing (mirror) */}
      {wingHs.map((h, i) => (
        <Rect
          key={`R${i}`}
          x={x + towerW / 2 + gap + (wingHs.length - 1 - i) * wingPitch}
          y={baseY - h}
          width={colW}
          height={h}
          fill={fill}
        />
      ))}
      {/* Gothic door arch cue */}
      <Path
        d={`M${x - 2.4} ${baseY}
           V${baseY - 10}
           Q${x - 2.4} ${baseY - 16} ${x} ${baseY - 16}
           Q${x + 2.4} ${baseY - 16} ${x + 2.4} ${baseY - 10}
           V${baseY}
           Z`}
        fill={lit ? window : 'rgba(20, 32, 48, 0.35)'}
      />
      {lit ? (
        <>
          {[28, 36, 44, 52, 60].map((dy) => (
            <Rect
              key={dy}
              x={x - 1.4}
              y={baseY - dy}
              width={2.8}
              height={2.4}
              rx={0.3}
              fill={window}
            />
          ))}
          <Circle cx={x} cy={baseY - 68} r={2.2} fill={window} />
        </>
      ) : null}
    </G>
  );
}

/** Wide-eave alpine chalet — pitched roof overhangs the walls. */
export function Chalet({
  x,
  y,
  w,
  h,
  fill,
  window,
  lit,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  window: string;
  lit: boolean;
}) {
  const roof = h * 0.7;
  const overhang = w * 0.18;
  return (
    <G>
      <Path
        d={`M${x - overhang} ${y - h}
           L${x + w / 2} ${y - h - roof}
           L${x + w + overhang} ${y - h}
           Z`}
        fill={fill}
      />
      <Rect x={x} y={y - h} width={w} height={h} fill={fill} />
      {lit ? (
        <Rect
          x={x + w * 0.35}
          y={y - h * 0.65}
          width={w * 0.3}
          height={h * 0.32}
          rx={0.5}
          fill={window}
        />
      ) : null}
    </G>
  );
}

/** Coastal lighthouse — tapered shaft + lantern cage. */
export function Lighthouse({
  x,
  fill,
  window,
  lit,
}: {
  x: number;
  fill: string;
  window: string;
  lit: boolean;
}) {
  const baseY = SKY_VIEW_H - 4;
  return (
    <G>
      <Path
        d={`M${x - 5} ${baseY}
           L${x - 3.2} ${baseY - 36}
           H${x + 3.2}
           L${x + 5} ${baseY}
           Z`}
        fill={fill}
      />
      <Rect x={x - 4} y={baseY - 42} width={8} height={7} rx={0.6} fill={fill} />
      <Path
        d={`M${x - 3.2} ${baseY - 42}
           L${x} ${baseY - 48}
           L${x + 3.2} ${baseY - 42}
           Z`}
        fill={fill}
      />
      {lit ? (
        <Rect
          x={x - 2.4}
          y={baseY - 40.5}
          width={4.8}
          height={3.6}
          rx={0.4}
          fill={window}
        />
      ) : null}
    </G>
  );
}

/** Desert / tropical stepped pyramid cue. */
export function SteppedPyramid({
  x,
  fill,
  tiers = 4,
}: {
  x: number;
  fill: string;
  tiers?: number;
}) {
  const baseY = SKY_VIEW_H - 2;
  const baseW = 36;
  const tierH = 7;
  return (
    <G>
      {Array.from({ length: tiers }, (_, i) => {
        const t = i / Math.max(tiers - 1, 1);
        const w = baseW * (1 - t * 0.72);
        const y = baseY - (i + 1) * tierH;
        return (
          <Rect
            key={i}
            x={x - w / 2}
            y={y}
            width={w}
            height={tierH + 0.4}
            fill={fill}
          />
        );
      })}
      <Path
        d={`M${x - 3} ${baseY - tiers * tierH}
           L${x} ${baseY - tiers * tierH - 6}
           L${x + 3} ${baseY - tiers * tierH}
           Z`}
        fill={fill}
      />
    </G>
  );
}

/** Smooth desert pyramid. */
export function Pyramid({ x, fill }: { x: number; fill: string }) {
  const baseY = SKY_VIEW_H - 2;
  return (
    <Path
      d={`M${x - 22} ${baseY}
         L${x} ${baseY - 42}
         L${x + 22} ${baseY}
         Z`}
      fill={fill}
    />
  );
}

/** Pastoral country church — nave + steeple. */
export function CountryChurch({
  x,
  fill,
  window,
  lit,
}: {
  x: number;
  fill: string;
  window: string;
  lit: boolean;
}) {
  const baseY = SKY_VIEW_H - 2;
  return (
    <G>
      <Rect x={x - 12} y={baseY - 14} width={24} height={14} fill={fill} />
      <Path
        d={`M${x - 13} ${baseY - 14}
           L${x} ${baseY - 22}
           L${x + 13} ${baseY - 14}
           Z`}
        fill={fill}
      />
      <Rect x={x - 3.2} y={baseY - 34} width={6.4} height={20} fill={fill} />
      <Path
        d={`M${x - 4} ${baseY - 34}
           L${x} ${baseY - 42}
           L${x + 4} ${baseY - 34}
           Z`}
        fill={fill}
      />
      {lit ? (
        <Rect
          x={x - 1.6}
          y={baseY - 28}
          width={3.2}
          height={4}
          rx={0.3}
          fill={window}
        />
      ) : null}
    </G>
  );
}

/** Metro setback tower (art-deco / Empire-adjacent cue). */
export function SetbackTower({
  x,
  w,
  h,
  fill,
  window,
  lit,
}: {
  x: number;
  w: number;
  h: number;
  fill: string;
  window: string;
  lit: boolean;
}) {
  const baseY = SKY_VIEW_H - 2;
  const midH = h * 0.55;
  const topH = h * 0.28;
  const midW = w * 0.72;
  const topW = w * 0.42;
  return (
    <G>
      <Rect x={x} y={baseY - midH} width={w} height={midH} fill={fill} />
      <Rect
        x={x + (w - midW) / 2}
        y={baseY - midH - topH}
        width={midW}
        height={topH}
        fill={fill}
      />
      <Rect
        x={x + (w - topW) / 2}
        y={baseY - h}
        width={topW}
        height={h - midH - topH}
        fill={fill}
      />
      <Path
        d={`M${x + w / 2 - 1} ${baseY - h}
           V${baseY - h - 6}
           H${x + w / 2 + 1}
           V${baseY - h}
           Z`}
        fill={fill}
      />
      {lit
        ? Array.from({ length: Math.floor(midH / 8) }, (_, i) => (
            <Rect
              key={i}
              x={x + w * 0.22}
              y={baseY - midH + 3 + i * 8}
              width={w * 0.18}
              height={2}
              rx={0.3}
              fill={i % 2 === 0 ? window : 'rgba(255,214,140,0.22)'}
            />
          ))
        : null}
    </G>
  );
}

