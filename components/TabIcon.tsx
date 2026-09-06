import Svg, { Circle, Path } from 'react-native-svg';

type Prim = { t: 'S'; d: string; w: number } | { t: 'F'; d: string } | { t: 'C'; cx: number; cy: number; r: number; w: number };

/**
 * Icônes de la barre d'onglets, dessinées dans le même langage que les
 * pictogrammes catégories : traits épais arrondis, aplat duotone à l'état actif.
 */
const ICONS: Record<TabIconName, Prim[]> = {
  "explore": [
    {
      "t": "F",
      "d": "M12 20 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0z"
    },
    {
      "t": "C",
      "cx": 22,
      "cy": 20,
      "r": 10,
      "w": 3.4
    },
    {
      "t": "S",
      "d": "M29 27 l10 10",
      "w": 3.4
    },
    {
      "t": "S",
      "d": "M8 8 l2 2 M40 6 l-2 2",
      "w": 3.4
    }
  ],
  "listings": [
    {
      "t": "F",
      "d": "M8 20 l16-6 16 6 v16 l-16 6 -16-6z"
    },
    {
      "t": "S",
      "d": "M8 20 l16-6 16 6 -16 6z M8 20 v16 l16 6 16-6 v-16 M24 26 v16",
      "w": 3.4
    },
    {
      "t": "S",
      "d": "M36 6 v10 M31 11 h10",
      "w": 3.4
    }
  ],
  "inbox": [
    {
      "t": "F",
      "d": "M8 12 h32 v20 h-16 l-8 7 v-7 h-8z"
    },
    {
      "t": "S",
      "d": "M8 12 h32 v20 h-16 l-8 7 v-7 h-8z",
      "w": 3.4
    },
    {
      "t": "S",
      "d": "M18 22 h.1 M24 22 h.1 M30 22 h.1",
      "w": 3.4
    }
  ],
  "bell": [
    {
      "t": "F",
      "d": "M14 32 v-10 a10 10 0 0 1 20 0 v10 l4 5 h-28z"
    },
    {
      "t": "S",
      "d": "M14 32 v-10 a10 10 0 0 1 20 0 v10 l4 5 h-28z M20 40 a4 4 0 0 0 8 0 M24 10 v2",
      "w": 3.4
    },
    {
      "t": "C",
      "cx": 24,
      "cy": 9,
      "r": 2,
      "w": 3.4
    }
  ],
  "profile": [
    {
      "t": "F",
      "d": "M14 42 a10 10 0 0 1 20 0z"
    },
    {
      "t": "C",
      "cx": 24,
      "cy": 16,
      "r": 8,
      "w": 3.4
    },
    {
      "t": "S",
      "d": "M10 42 a14 14 0 0 1 28 0",
      "w": 3.4
    }
  ]
};

export type TabIconName = 'explore' | 'listings' | 'inbox' | 'profile' | 'bell';

interface Props {
  name: TabIconName;
  color: string;
  size?: number;
  active?: boolean;
}

export function TabIcon({ name, color, size = 24, active = false }: Props) {
  const prims = ICONS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {prims.map((p, i) => {
        if (p.t === 'F') return active ? <Path key={i} d={p.d} fill={color} opacity={0.22} /> : null;
        if (p.t === 'C') return <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="none" stroke={color} strokeWidth={p.w} />;
        return <Path key={i} d={p.d} fill="none" stroke={color} strokeWidth={p.w} strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </Svg>
  );
}
