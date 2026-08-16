import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Symbol } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

import { holidayMark, type HolidayMarkId } from './holiday-icon';

/** 5-point star centered in a 24 box — Christmas topper / Juneteenth burst. */
export function starPath(
  cx: number,
  cy: number,
  spikes: number,
  outer: number,
  inner: number,
): string {
  const parts: string[] = [];
  const count = spikes * 2;
  for (let i = 0; i < count; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / spikes;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `${parts.join(' ')} Z`;
}

function HolidayMarkPaths({
  mark,
  color,
}: {
  mark: HolidayMarkId;
  color: string;
}) {
  switch (mark) {
    case 'christmas-tree':
      return (
        <>
          <Path d={starPath(12, 3.15, 5, 2.2, 0.88)} fill={color} />
          <Path
            d="M12 6.2 L16.35 11.15 H14.15 L17.55 15.2 H13.35 V17.55 H10.65 V15.2 H6.45 L9.85 11.15 H7.65 Z"
            fill={color}
          />
          <Path d="M10.7 17.55 H13.3 V19.05 H10.7 Z" fill={color} />
          <Path
            d="M8.85 19.05 H15.15 V20.55 H8.85 Z"
            fill={color}
          />
        </>
      );
    case 'gift':
      return (
        <Path
          d="M7.2 10.4 H16.8 V20 H7.2 Z M6.5 7.6 H17.5 V10.6 H6.5 Z M11.35 7.6 H12.65 V20 H11.35 Z M9.1 4.6 C9.1 3.4 10.15 2.8 11.2 3.5 L12 4.1 L12.8 3.5 C13.85 2.8 14.9 3.4 14.9 4.6 C14.9 5.7 13.7 6.5 12 7.6 C10.3 6.5 9.1 5.7 9.1 4.6 Z"
          fill={color}
        />
      );
    case 'party':
      return (
        <>
          <Path
            d="M4.6 19.4 L10.2 13.2 L13.1 16.1 L7.5 21.2 Z"
            fill={color}
          />
          <Path
            d="M10.6 12.6 L14.4 8.2 C15.5 9.1 16.2 10.4 16.4 11.8 L12.2 15.4 Z"
            fill={color}
          />
          <Circle cx="16.6" cy="6.2" r="1.05" fill={color} />
          <Circle cx="19.2" cy="8.6" r="0.85" fill={color} />
          <Circle cx="18.4" cy="4.8" r="0.7" fill={color} />
          <Circle cx="20.4" cy="11.2" r="0.7" fill={color} />
        </>
      );
    case 'champagne':
      return (
        <>
          <Path
            d="M8.6 3.4 H15.4 L13.15 11.6 C12.85 12.6 12 13.15 12 13.15 C12 13.15 11.15 12.6 10.85 11.6 Z"
            fill={color}
          />
          <Path d="M11.25 13.1 H12.75 V18.3 H11.25 Z" fill={color} />
          <Path d="M8.8 18.3 H15.2 V20.3 H8.8 Z" fill={color} />
          <Circle cx="17.4" cy="5.2" r="0.7" fill={color} />
          <Circle cx="18.6" cy="7.4" r="0.55" fill={color} />
        </>
      );
    case 'heart':
      return (
        <Path
          d="M12 20.2 C12 20.2 3.6 14.6 3.6 8.9 C3.6 6.2 5.7 4.2 8.3 4.2 C10 4.2 11.35 5.1 12 6.4 C12.65 5.1 14 4.2 15.7 4.2 C18.3 4.2 20.4 6.2 20.4 8.9 C20.4 14.6 12 20.2 12 20.2 Z"
          fill={color}
        />
      );
    case 'tie':
      return (
        <Path
          d="M10.4 3.4 H13.6 L14.5 5.6 L12 6.7 L9.5 5.6 Z M10.7 6.9 L13.3 6.9 L15.4 20.2 L12 17.6 L8.6 20.2 Z"
          fill={color}
        />
      );
    case 'shamrock':
      return (
        <>
          <Circle cx="12" cy="7.4" r="3.15" fill={color} />
          <Circle cx="8.15" cy="11.55" r="3.15" fill={color} />
          <Circle cx="15.85" cy="11.55" r="3.15" fill={color} />
          <Path d="M11.35 13.4 H12.65 V20.4 H11.35 Z" fill={color} />
        </>
      );
    case 'egg':
      return (
        <Path
          fill={color}
          fillRule="evenodd"
          d="M12 2.8 C16.4 2.8 19.4 8.2 19.4 13.4 C19.4 17.8 16.2 21.2 12 21.2 C7.8 21.2 4.6 17.8 4.6 13.4 C4.6 8.2 7.6 2.8 12 2.8 Z M6.6 11.15 H17.4 V13.35 H6.6 Z"
        />
      );
    case 'cross':
      return (
        <Path
          d="M10.15 3.2 H13.85 V8.7 H19.1 V12.2 H13.85 V20.8 H10.15 V12.2 H4.9 V8.7 H10.15 Z"
          fill={color}
        />
      );
    case 'people':
      return (
        <Path
          d="M8.2 4.6 A2.35 2.35 0 1 1 8.2 9.3 A2.35 2.35 0 1 1 8.2 4.6 Z M4.3 11.1 C4.3 9.9 5.3 9.1 6.5 9.1 H9.9 C11.1 9.1 12.1 9.9 12.1 11.1 V16.6 H4.3 Z M16.1 5.2 A2.15 2.15 0 1 1 16.1 9.5 A2.15 2.15 0 1 1 16.1 5.2 Z M12.9 11.4 C12.9 10.3 13.8 9.6 14.9 9.6 H17.9 C19 9.6 19.9 10.3 19.9 11.4 V16.6 H12.9 Z"
          fill={color}
        />
      );
    case 'columns':
      return (
        <Path
          d="M4.6 7.2 L12 3.2 L19.4 7.2 V8.7 H4.6 Z M6.2 9.3 H8.3 V17.6 H6.2 Z M10.95 9.3 H13.05 V17.6 H10.95 Z M15.7 9.3 H17.8 V17.6 H15.7 Z M4.4 17.6 H19.6 V20.3 H4.4 Z"
          fill={color}
        />
      );
    case 'burst-star':
      return <Path d={starPath(12, 12.1, 8, 9.4, 3.55)} fill={color} />;
    case 'maple':
      return (
        <Path
          d="M12 3.1 L13.35 7.15 L17.7 5.4 L15.85 9.05 L20.2 10.15 L15.7 12.25 L17.85 16.7 L13.5 14.35 L12 19.4 L10.5 14.35 L6.15 16.7 L8.3 12.25 L3.8 10.15 L8.15 9.05 L6.3 5.4 L10.65 7.15 Z M11.25 16.6 H12.75 V21 H11.25 Z"
          fill={color}
        />
      );
    case 'southern-cross':
      return (
        <>
          <Path d={starPath(12, 6.3, 4, 2.05, 0.85)} fill={color} />
          <Path d={starPath(12, 16.7, 4, 2.35, 0.95)} fill={color} />
          <Path d={starPath(7.15, 11.15, 4, 1.7, 0.72)} fill={color} />
          <Path d={starPath(16.55, 10.35, 4, 1.55, 0.66)} fill={color} />
        </>
      );
    case 'poppy':
      return (
        <>
          <Circle cx="12" cy="7.6" r="3.2" fill={color} />
          <Circle cx="7.7" cy="12.1" r="3.2" fill={color} />
          <Circle cx="16.3" cy="12.1" r="3.2" fill={color} />
          <Circle cx="12" cy="16.2" r="3.2" fill={color} />
          <Circle cx="12" cy="12.1" r="1.55" fill={color} />
        </>
      );
    case 'medal':
      return (
        <>
          <Path
            d="M8.2 3.2 L12 8.1 L15.8 3.2 H17.6 L13.1 9.4 H10.9 L6.4 3.2 Z"
            fill={color}
          />
          <Circle cx="12" cy="15.3" r="5.15" fill={color} />
        </>
      );
    case 'hammer':
      return (
        <Path
          d="M13.6 3.4 L20.1 9.9 L17.7 12.3 L15.6 10.2 L8.3 17.5 C7.5 18.3 6.2 18.3 5.4 17.5 L4.3 16.4 C3.5 15.6 3.5 14.3 4.3 13.5 L11.6 6.2 L9.5 4.1 Z"
          fill={color}
        />
      );
    case 'sun':
      return (
        <>
          <Circle cx="12" cy="12" r="4.15" fill={color} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <Line
                key={deg}
                x1={12 + Math.cos(rad) * 6.1}
                y1={12 + Math.sin(rad) * 6.1}
                x2={12 + Math.cos(rad) * 9.4}
                y2={12 + Math.sin(rad) * 9.4}
                stroke={color}
                strokeWidth={1.85}
                strokeLinecap="round"
              />
            );
          })}
        </>
      );
    case 'pumpkin':
      return (
        <>
          <Path d="M11.15 3.1 H12.85 V5.5 H11.15 Z" fill={color} />
          <Path
            fill={color}
            fillRule="evenodd"
            d="M12 5.3 C16.7 5.3 20.3 8.7 20.3 13.4 C20.3 18 16.7 21.3 12 21.3 C7.3 21.3 3.7 18 3.7 13.4 C3.7 8.7 7.3 5.3 12 5.3 Z M8.35 10.3 L10.55 13.05 L8.2 13.55 Z M15.65 10.3 L15.8 13.55 L13.45 13.05 Z M7.7 15.35 C9.3 17.85 14.7 17.85 16.3 15.35 C14.4 16.55 9.6 16.55 7.7 15.35 Z"
          />
        </>
      );
    case 'turkey':
      return (
        <>
          <Path
            d="M12 4.2 L14.35 9.1 L19.4 8.3 L16.2 12.2 L20.1 16.1 L14.6 15.1 L13.3 20.2 L12 15.4 L10.7 20.2 L9.4 15.1 L3.9 16.1 L7.8 12.2 L4.6 8.3 L9.65 9.1 Z"
            fill={color}
          />
          <Circle cx="12" cy="12.4" r="3.35" fill={color} />
          <Path
            d="M14.7 10.6 C16.5 9.5 17.7 10.1 17.5 11.8 C17.3 13.2 15.8 13.6 14.5 12.8 Z"
            fill={color}
          />
        </>
      );
    case 'crown':
      return (
        <Path
          d="M4.4 9.1 L7.6 13.1 L12 6.4 L16.4 13.1 L19.6 9.1 V17.2 H4.4 Z M4.4 18.1 H19.6 V20.3 H4.4 Z"
          fill={color}
        />
      );
    case 'blossom':
      return (
        <>
          {[0, 72, 144, 216, 288].map((deg) => {
            const rad = ((deg - 90) * Math.PI) / 180;
            return (
              <Circle
                key={deg}
                cx={12 + Math.cos(rad) * 4.15}
                cy={12 + Math.sin(rad) * 4.15}
                r={2.55}
                fill={color}
              />
            );
          })}
          <Circle cx="12" cy="12" r="1.7" fill={color} />
        </>
      );
    case 'calendar':
    default:
      return (
        <Path
          fill={color}
          fillRule="evenodd"
          d="M6.2 4.8 H8.1 V3.2 H9.7 V4.8 H14.3 V3.2 H15.9 V4.8 H17.8 C18.7 4.8 19.4 5.5 19.4 6.4 V19.4 C19.4 20.3 18.7 21 17.8 21 H6.2 C5.3 21 4.6 20.3 4.6 19.4 V6.4 C4.6 5.5 5.3 4.8 6.2 4.8 Z M6.3 8.5 H17.7 V19.3 H6.3 Z"
        />
      );
  }
}

export function HolidayMark({ slug }: { slug: string }) {
  const theme = useTheme();
  const { iconSizes } = useResponsive();
  const mark = holidayMark(slug);
  if (mark === 'fireworks') {
    return <Symbol name="fireworks" size="lg" color={theme.accentPrimary} />;
  }
  return (
    <Svg width={iconSizes.lg} height={iconSizes.lg} viewBox="0 0 24 24" fill="none">
      <HolidayMarkPaths mark={mark} color={theme.accentPrimary} />
    </Svg>
  );
}
