/** Destination-flavored ground compositions for the itinerary sky plate. */
import { G, Path, Rect } from 'react-native-svg';

import type { TravelSkyGroundKind } from '@/features/travel/travel-sky-ground-kind';
import {
  Car,
  Chalet,
  CountryChurch,
  Fir,
  Hallgrimskirkja,
  House,
  Lighthouse,
  Palm,
  PeakFrost,
  Pyramid,
  SetbackTower,
  SteppedPyramid,
} from '@/features/travel/travel-sky-ground-primitives';
import { SKY_VIEW_H, SKY_VIEW_W } from '@/features/travel/travel-sky-plate';

type GroundPalette = {
  far: string;
  mid: string;
  near: string;
  window: string;
  road: string;
  /** Cool snow/frost on mountain peaks. */
  frost: string;
};

function groundPalette(night: boolean): GroundPalette {
  if (night) {
    return {
      far: 'rgba(14, 28, 42, 0.78)',
      mid: 'rgba(8, 16, 28, 0.9)',
      near: 'rgba(3, 6, 12, 0.96)',
      window: 'rgba(255, 214, 140, 0.55)',
      road: 'rgba(18, 24, 34, 0.95)',
      frost: 'rgba(214, 228, 255, 0.62)',
    };
  }
  return {
    far: 'rgba(110, 132, 152, 0.42)',
    mid: 'rgba(70, 92, 112, 0.55)',
    near: 'rgba(42, 58, 74, 0.68)',
    window: 'rgba(255, 240, 200, 0.35)',
    road: 'rgba(55, 68, 82, 0.55)',
    frost: 'rgba(245, 250, 255, 0.78)',
  };
}

function GroundFarMountains({
  fill,
  frost,
}: {
  fill: string;
  frost: string;
}) {
  const h = SKY_VIEW_H;
  const pts = [
    [0, h - 18],
    [28, h - 36],
    [52, h - 28],
    [88, h - 48],
    [118, h - 32],
    [150, h - 52],
    [190, h - 30],
    [230, h - 46],
    [270, h - 28],
    [310, h - 42],
    [340, h - 30],
    [360, h - 22],
  ] as const;
  // Local apexes (higher on screen = smaller y than both neighbors).
  const peakIdx = [1, 3, 5, 7, 9];
  return (
    <G>
      <Path
        d={`M0 ${h - 18}
         L28 ${h - 36}
         L52 ${h - 28}
         L88 ${h - 48}
         L118 ${h - 32}
         L150 ${h - 52}
         L190 ${h - 30}
         L230 ${h - 46}
         L270 ${h - 28}
         L310 ${h - 42}
         L340 ${h - 30}
         L360 ${h - 22}
         V${h}
         H0 Z`}
        fill={fill}
      />
      {peakIdx.map((i) => {
        const [ax, ay] = pts[i]!;
        const [lx, ly] = pts[i - 1]!;
        const [rx, ry] = pts[i + 1]!;
        return (
          <PeakFrost
            key={`frost-${ax}`}
            ax={ax}
            ay={ay}
            lx={lx}
            ly={ly}
            rx={rx}
            ry={ry}
            fill={frost}
            depth={0.3}
          />
        );
      })}
    </G>
  );
}

function NordicGround({ p, night }: { p: GroundPalette; night: boolean }) {
  const base = SKY_VIEW_H - 2;
  const ridge = [
    [0, base - 16],
    [40, base - 34],
    [78, base - 22],
    [120, base - 40],
    [168, base - 24],
    [210, base - 38],
    [260, base - 20],
    [310, base - 32],
    [360, base - 18],
  ] as const;
  const frostPeaks = [1, 3, 5, 7];
  return (
    <G>
      {/* Esja-like far ridge */}
      <Path
        d={`M0 ${base - 16}
           L40 ${base - 34}
           L78 ${base - 22}
           L120 ${base - 40}
           L168 ${base - 24}
           L210 ${base - 38}
           L260 ${base - 20}
           L310 ${base - 32}
           L360 ${base - 18}
           V${SKY_VIEW_H} H0 Z`}
        fill={p.far}
      />
      {frostPeaks.map((i) => {
        const [ax, ay] = ridge[i]!;
        const [lx, ly] = ridge[i - 1]!;
        const [rx, ry] = ridge[i + 1]!;
        return (
          <PeakFrost
            key={`nordic-frost-${ax}`}
            ax={ax}
            ay={ay}
            lx={lx}
            ly={ly}
            rx={rx}
            ry={ry}
            fill={p.frost}
            depth={0.36}
          />
        );
      })}
      {/* Mid ridge + firs */}
      <Path
        d={`M0 ${base - 6}
           L55 ${base - 16}
           L110 ${base - 10}
           L170 ${base - 18}
           L240 ${base - 8}
           L300 ${base - 14}
           L360 ${base - 6}
           V${SKY_VIEW_H} H0 Z`}
        fill={p.mid}
      />
      <Fir x={18} y={base - 6} h={14} fill={p.mid} />
      <Fir x={34} y={base - 5} h={11} fill={p.mid} />
      <Fir x={300} y={base - 7} h={13} fill={p.mid} />
      <Fir x={318} y={base - 5} h={10} fill={p.mid} />
      {/* Town row — church is the hero landmark */}
      <House x={42} y={base} w={16} h={11} fill={p.near} window={p.window} lit={night} />
      <House x={60} y={base} w={14} h={10} fill={p.near} window={p.window} lit={night} />
      <House x={76} y={base} w={18} h={12} fill={p.near} window={p.window} lit={night} />
      <House x={96} y={base} w={13} h={9} fill={p.near} window={p.window} lit={false} />
      <Hallgrimskirkja x={188} fill={p.near} window={p.window} lit={night} />
      <House x={236} y={base} w={15} h={10} fill={p.near} window={p.window} lit={night} />
      <House x={254} y={base} w={17} h={12} fill={p.near} window={p.window} lit={night} />
      <House x={274} y={base} w={14} h={9} fill={p.near} window={p.window} lit={false} />
      {/* Road + cars */}
      <Rect x={0} y={base + 1} width={SKY_VIEW_W} height={4} fill={p.road} />
      <Car x={58} y={base + 1} w={16} fill={p.near} />
      <Car x={290} y={base + 1.5} w={14} fill={p.mid} />
    </G>
  );
}

function TropicalGround({ p, night }: { p: GroundPalette; night: boolean }) {
  const base = SKY_VIEW_H - 2;
  return (
    <G>
      <Path
        d={`M0 ${base - 8}
           Q90 ${base - 18} 180 ${base - 10}
           Q270 ${base - 20} 360 ${base - 8}
           V${SKY_VIEW_H} H0 Z`}
        fill={p.far}
      />
      <Path
        d={`M0 ${base}
           Q120 ${base - 6} 240 ${base - 2}
           L360 ${base}
           V${SKY_VIEW_H} H0 Z`}
        fill={p.mid}
      />
      <Palm x={40} y={base} fill={p.near} />
      <Palm x={62} y={base + 1} fill={p.mid} />
      <Palm x={290} y={base} fill={p.near} />
      <Palm x={318} y={base + 1} fill={p.mid} />
      <SteppedPyramid x={180} fill={p.near} tiers={4} />
      <House x={110} y={base} w={18} h={9} fill={p.mid} window={p.window} lit={night} />
      <House x={230} y={base} w={16} h={10} fill={p.mid} window={p.window} lit={night} />
      <Rect x={0} y={base + 1} width={SKY_VIEW_W} height={4} fill={p.road} />
      <Car x={250} y={base + 1} w={15} fill={p.near} />
    </G>
  );
}

function DesertGround({ p }: { p: GroundPalette }) {
  const base = SKY_VIEW_H - 2;
  return (
    <G>
      <Path
        d={`M0 ${base - 4}
           Q60 ${base - 22} 120 ${base - 8}
           Q180 ${base - 28} 250 ${base - 10}
           Q310 ${base - 24} 360 ${base - 6}
           V${SKY_VIEW_H} H0 Z`}
        fill={p.far}
      />
      <Path
        d={`M0 ${base}
           Q100 ${base - 10} 200 ${base - 2}
           Q280 ${base - 12} 360 ${base}
           V${SKY_VIEW_H} H0 Z`}
        fill={p.mid}
      />
      <Pyramid x={178} fill={p.near} />
      {/* Sparse cactus / rock markers */}
      <Rect x={72} y={base - 14} width={2.2} height={14} rx={1} fill={p.near} />
      <Rect x={68} y={base - 10} width={10} height={2} rx={1} fill={p.near} />
      <Rect x={300} y={base - 12} width={2} height={12} rx={1} fill={p.near} />
      <Rect x={296} y={base - 9} width={9} height={2} rx={1} fill={p.near} />
      <Car x={240} y={base} w={14} fill={p.mid} />
    </G>
  );
}

function MetroGround({ p, night }: { p: GroundPalette; night: boolean }) {
  const base = SKY_VIEW_H - 2;
  const blockTowers = [
    { x: 18, w: 12, h: 28 },
    { x: 34, w: 9, h: 22 },
    { x: 48, w: 14, h: 36 },
    { x: 66, w: 10, h: 24 },
    { x: 118, w: 11, h: 30 },
    { x: 134, w: 16, h: 38 },
    { x: 210, w: 12, h: 26 },
    { x: 226, w: 15, h: 34 },
    { x: 280, w: 11, h: 24 },
    { x: 296, w: 14, h: 32 },
    { x: 318, w: 10, h: 22 },
    { x: 332, w: 16, h: 30 },
  ];
  return (
    <G>
      <GroundFarMountains fill={p.far} frost={p.frost} />
      {blockTowers.map((t) => (
        <G key={`${t.x}-${t.h}`}>
          <Rect x={t.x} y={base - t.h} width={t.w} height={t.h} fill={p.mid} />
          {night
            ? Array.from({ length: Math.floor(t.h / 8) }, (_, i) => (
                <Rect
                  key={i}
                  x={t.x + t.w * 0.25}
                  y={base - t.h + 4 + i * 8}
                  width={t.w * 0.2}
                  height={2}
                  rx={0.3}
                  fill={i % 3 === 0 ? p.window : 'rgba(255,214,140,0.2)'}
                />
              ))
            : null}
        </G>
      ))}
      {/* Hero setback towers — art-deco / skyline cue */}
      <SetbackTower
        x={82}
        w={18}
        h={56}
        fill={p.near}
        window={p.window}
        lit={night}
      />
      <SetbackTower
        x={158}
        w={22}
        h={68}
        fill={p.near}
        window={p.window}
        lit={night}
      />
      <SetbackTower
        x={248}
        w={16}
        h={50}
        fill={p.near}
        window={p.window}
        lit={night}
      />
      <Rect x={0} y={base + 1} width={SKY_VIEW_W} height={4} fill={p.road} />
      <Car x={90} y={base + 1} w={15} fill={p.mid} />
      <Car x={210} y={base + 1.5} w={13} fill={p.near} />
    </G>
  );
}

function AlpineGround({ p }: { p: GroundPalette }) {
  const base = SKY_VIEW_H - 2;
  const ridge = [
    [0, base - 10],
    [45, base - 48],
    [70, base - 28],
    [110, base - 58],
    [150, base - 30],
    [200, base - 62],
    [245, base - 34],
    [290, base - 54],
    [330, base - 28],
    [360, base - 40],
  ] as const;
  // Tall alpine apexes only — skip saddles so frost reads as snow caps.
  const frostPeaks = [1, 3, 5, 7];
  return (
    <G>
      <Path
        d={`M0 ${base - 10}
           L45 ${base - 48}
           L70 ${base - 28}
           L110 ${base - 58}
           L150 ${base - 30}
           L200 ${base - 62}
           L245 ${base - 34}
           L290 ${base - 54}
           L330 ${base - 28}
           L360 ${base - 40}
           V${SKY_VIEW_H} H0 Z`}
        fill={p.far}
      />
      {frostPeaks.map((i) => {
        const [ax, ay] = ridge[i]!;
        const [lx, ly] = ridge[i - 1]!;
        const [rx, ry] = ridge[i + 1]!;
        return (
          <PeakFrost
            key={`alpine-frost-${ax}`}
            ax={ax}
            ay={ay}
            lx={lx}
            ly={ly}
            rx={rx}
            ry={ry}
            fill={p.frost}
            depth={0.4}
          />
        );
      })}
      <Path
        d={`M0 ${base}
           L80 ${base - 14}
           L160 ${base - 6}
           L240 ${base - 16}
           L320 ${base - 8}
           L360 ${base}
           V${SKY_VIEW_H} H0 Z`}
        fill={p.mid}
      />
      {[24, 40, 56, 250, 268, 290, 310].map((x, i) => (
        <Fir key={x} x={x} y={base - (i % 2)} h={12 + (i % 3) * 3} fill={p.near} />
      ))}
      <Chalet
        x={132}
        y={base}
        w={22}
        h={12}
        fill={p.near}
        window={p.window}
        lit={false}
      />
      <Chalet
        x={168}
        y={base}
        w={18}
        h={10}
        fill={p.mid}
        window={p.window}
        lit={false}
      />
      <Car x={210} y={base} w={14} fill={p.near} />
    </G>
  );
}

function CoastalGround({ p, night }: { p: GroundPalette; night: boolean }) {
  const base = SKY_VIEW_H - 2;
  return (
    <G>
      <Path
        d={`M0 ${base - 12}
           Q80 ${base - 20} 160 ${base - 10}
           Q240 ${base - 22} 360 ${base - 12}
           V${SKY_VIEW_H} H0 Z`}
        fill={p.far}
      />
      {/* Water shelf */}
      <Path
        d={`M0 ${base + 2}
           Q120 ${base - 2} 240 ${base + 1}
           T360 ${base}
           V${SKY_VIEW_H} H0 Z`}
        fill={p.mid}
      />
      <House x={36} y={base - 2} w={15} h={10} fill={p.near} window={p.window} lit={night} />
      <House x={54} y={base - 2} w={13} h={9} fill={p.near} window={p.window} lit={night} />
      <Lighthouse x={188} fill={p.near} window={p.window} lit={night} />
      <House x={250} y={base - 2} w={16} h={11} fill={p.near} window={p.window} lit={night} />
      {/* Pier + boats */}
      <Rect x={120} y={base - 1} width={50} height={2} fill={p.near} />
      <Path
        d={`M130 ${base - 1} L137 ${base - 8} L150 ${base - 1} Z`}
        fill={p.near}
      />
      <Path
        d={`M155 ${base} L163 ${base - 7} L173 ${base} Z`}
        fill={p.mid}
      />
      <Palm x={300} y={base - 2} fill={p.near} />
      <Car x={76} y={base - 1} w={14} fill={p.near} />
    </G>
  );
}

function PastoralGround({ p, night }: { p: GroundPalette; night: boolean }) {
  const base = SKY_VIEW_H - 2;
  return (
    <G>
      <GroundFarMountains fill={p.far} frost={p.frost} />
      <Path
        d={`M0 ${base}
           Q90 ${base - 12} 180 ${base - 4}
           Q270 ${base - 14} 360 ${base}
           V${SKY_VIEW_H} H0 Z`}
        fill={p.mid}
      />
      {[30, 48, 70, 250, 275, 300, 330].map((x, i) => (
        <Fir key={x} x={x} y={base} h={10 + (i % 4) * 2} fill={p.near} />
      ))}
      <CountryChurch x={168} fill={p.near} window={p.window} lit={night} />
      <House x={120} y={base} w={16} h={10} fill={p.mid} window={p.window} lit={night} />
      <House x={196} y={base} w={14} h={9} fill={p.mid} window={p.window} lit={false} />
      <Rect x={0} y={base + 1} width={SKY_VIEW_W} height={3.5} fill={p.road} />
      <Car x={230} y={base + 1} w={15} fill={p.near} />
    </G>
  );
}

export function GroundArt({
  kind,
  night,
}: {
  kind: TravelSkyGroundKind;
  night: boolean;
}) {
  const p = groundPalette(night);
  switch (kind) {
    case 'nordic':
      return <NordicGround p={p} night={night} />;
    case 'tropical':
      return <TropicalGround p={p} night={night} />;
    case 'desert':
      return <DesertGround p={p} />;
    case 'metro':
      return <MetroGround p={p} night={night} />;
    case 'alpine':
      return <AlpineGround p={p} />;
    case 'coastal':
      return <CoastalGround p={p} night={night} />;
    default:
      return <PastoralGround p={p} night={night} />;
  }
}

/**
 * Location-flavored ground band for the itinerary sky plate —
 * mountains, trees, town/city, cars — dissolving with the horizon fade.
 */
