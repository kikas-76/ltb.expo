import Svg, { Circle, Path } from 'react-native-svg';
import { Colors } from '@/constants/colors';

type Prim = { t: 'T'; d: string } | { t: 'S'; d: string; w: number } | { t: 'F'; d: string; o: number } | { t: 'C'; cx: number; cy: number; r: number };

/** Illustrations des états vides (viewBox 120) : blob teinté, pictogramme épais, étincelles. */
const ILLUS: Record<EmptyIllustrationName, Prim[]> = {
  "box": [
    {
      "t": "T",
      "d": "M60 8 c26-4 52 14 52 42 s-14 56-46 58 S8 92 8 62 34 12 60 8z"
    },
    {
      "t": "F",
      "d": "M32 52 l28-10 28 10 v28 l-28 10 -28-10z",
      "o": 0.22
    },
    {
      "t": "S",
      "d": "M32 52 l28-10 28 10 -28 10z M32 52 v28 l28 10 28-10 v-28 M60 62 v28",
      "w": 4
    },
    {
      "t": "S",
      "d": "M40 40 l-8-8 M80 40 l8-8",
      "w": 4
    },
    {
      "t": "S",
      "d": "M96 22 l2 5 5 2 -5 2 -2 5 -2-5 -5-2 5-2z",
      "w": 2.6
    },
    {
      "t": "S",
      "d": "M20 30 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5-3.5 -3.5-1.5 3.5-1.5z",
      "w": 2.4
    }
  ],
  "search": [
    {
      "t": "T",
      "d": "M60 8 c26-4 52 14 52 42 s-14 56-46 58 S8 92 8 62 34 12 60 8z"
    },
    {
      "t": "F",
      "d": "M38 52 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0z",
      "o": 0.22
    },
    {
      "t": "C",
      "cx": 58,
      "cy": 52,
      "r": 20
    },
    {
      "t": "S",
      "d": "M72 66 l16 16",
      "w": 5
    },
    {
      "t": "S",
      "d": "M53 46 c0-6 10-6 10 0 c0 4-5 4-5 9 M58 62 h.1",
      "w": 3.6
    },
    {
      "t": "S",
      "d": "M96 22 l2 5 5 2 -5 2 -2 5 -2-5 -5-2 5-2z",
      "w": 2.6
    },
    {
      "t": "S",
      "d": "M20 30 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5-3.5 -3.5-1.5 3.5-1.5z",
      "w": 2.4
    }
  ],
  "heart": [
    {
      "t": "T",
      "d": "M60 8 c26-4 52 14 52 42 s-14 56-46 58 S8 92 8 62 34 12 60 8z"
    },
    {
      "t": "F",
      "d": "M60 92 c-20-14-32-24-32-40 a15 15 0 0 1 32-6 a15 15 0 0 1 32 6 c0 16-12 26-32 40z",
      "o": 0.22
    },
    {
      "t": "S",
      "d": "M60 92 c-20-14-32-24-32-40 a15 15 0 0 1 32-6 a15 15 0 0 1 32 6 c0 16-12 26-32 40z",
      "w": 4
    },
    {
      "t": "S",
      "d": "M96 22 l2 5 5 2 -5 2 -2 5 -2-5 -5-2 5-2z",
      "w": 2.6
    },
    {
      "t": "S",
      "d": "M20 30 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5-3.5 -3.5-1.5 3.5-1.5z",
      "w": 2.4
    }
  ],
  "calendar": [
    {
      "t": "T",
      "d": "M60 8 c26-4 52 14 52 42 s-14 56-46 58 S8 92 8 62 34 12 60 8z"
    },
    {
      "t": "F",
      "d": "M30 44 h60 v42 h-60z",
      "o": 0.22
    },
    {
      "t": "S",
      "d": "M30 36 h60 v50 h-60z M30 48 h60 M44 30 v12 M76 30 v12",
      "w": 4
    },
    {
      "t": "S",
      "d": "M48 66 l8 8 16-16",
      "w": 4.5
    },
    {
      "t": "S",
      "d": "M96 22 l2 5 5 2 -5 2 -2 5 -2-5 -5-2 5-2z",
      "w": 2.6
    },
    {
      "t": "S",
      "d": "M20 30 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5-3.5 -3.5-1.5 3.5-1.5z",
      "w": 2.4
    }
  ],
  "chat": [
    {
      "t": "T",
      "d": "M60 8 c26-4 52 14 52 42 s-14 56-46 58 S8 92 8 62 34 12 60 8z"
    },
    {
      "t": "F",
      "d": "M28 34 h64 v38 h-30 l-14 12 v-12 h-20z",
      "o": 0.22
    },
    {
      "t": "S",
      "d": "M28 34 h64 v38 h-30 l-14 12 v-12 h-20z",
      "w": 4
    },
    {
      "t": "S",
      "d": "M46 53 h.1 M60 53 h.1 M74 53 h.1",
      "w": 6
    },
    {
      "t": "S",
      "d": "M96 22 l2 5 5 2 -5 2 -2 5 -2-5 -5-2 5-2z",
      "w": 2.6
    },
    {
      "t": "S",
      "d": "M20 30 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5-3.5 -3.5-1.5 3.5-1.5z",
      "w": 2.4
    }
  ]
};

export type EmptyIllustrationName = 'box' | 'search' | 'heart' | 'calendar' | 'chat';

interface Props {
  name: EmptyIllustrationName;
  size?: number;
  ink?: string;
  tint?: string;
}

export function EmptyIllustration({ name, size = 132, ink = Colors.primaryDark, tint = '#E4EBD3' }: Props) {
  const prims = ILLUS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {prims.map((p, i) => {
        if (p.t === 'T') return <Path key={i} d={p.d} fill={tint} />;
        if (p.t === 'F') return <Path key={i} d={p.d} fill={ink} opacity={p.o} />;
        if (p.t === 'C') return <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="none" stroke={ink} strokeWidth={4} />;
        return <Path key={i} d={p.d} fill="none" stroke={ink} strokeWidth={p.w} strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </Svg>
  );
}
