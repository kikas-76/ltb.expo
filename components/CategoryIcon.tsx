import Svg, { Circle, Path } from 'react-native-svg';
import { View } from 'react-native';

type Prim = { t: 'S'; d: string } | { t: 'F'; d: string } | { t: 'C'; cx: number; cy: number; r: number };

/**
 * Pictogrammes maison des catégories (viewBox 48) : traits épais arrondis
 * (style « bold rounded ») et aplat duotone à 22 % de la même encre.
 * Dessinés pour LoueTonBien, cohérents entre eux et avec le ∞ du logo.
 */
const ICONS: Record<string, Prim[]> = {
  "bricolage": [
    {
      "t": "F",
      "d": "M41 15 a9 9 0 0 1 -12 11 L15 40 a3.5 3.5 0 0 1 -5 -5 L24 21 a9 9 0 0 1 11 -12 l-4 5 v5 h5z"
    },
    {
      "t": "S",
      "d": "M41 15 a9 9 0 0 1 -12 11 L15 40 a3.5 3.5 0 0 1 -5 -5 L24 21 a9 9 0 0 1 11 -12 l-4 5 v5 h5z"
    }
  ],
  "mobilite": [
    {
      "t": "F",
      "d": "M12 34 l7-16 h12 l5 16z"
    },
    {
      "t": "C",
      "cx": 12,
      "cy": 34,
      "r": 7
    },
    {
      "t": "C",
      "cx": 36,
      "cy": 34,
      "r": 7
    },
    {
      "t": "S",
      "d": "M12 34 l7-16 h12 l5 16 M19 18 l6 16 M25 34 l6-16 M31 18 l-3-6 h5 M15 16 h7"
    }
  ],
  "sport": [
    {
      "t": "F",
      "d": "M24 8 a16 16 0 0 1 16 16 h-16z"
    },
    {
      "t": "C",
      "cx": 24,
      "cy": 24,
      "r": 16
    },
    {
      "t": "S",
      "d": "M24 8 v32 M8 24 h32 M13 13 c6 4 6 18 0 22 M35 13 c-6 4-6 18 0 22"
    }
  ],
  "camping": [
    {
      "t": "F",
      "d": "M24 10 l14 26 h-8 l-6-10 -6 10 h-8z"
    },
    {
      "t": "S",
      "d": "M24 10 l-16 28 h32z M24 22 l-6 16 M24 22 l6 16 M6 40 h36"
    }
  ],
  "evenementiel": [
    {
      "t": "F",
      "d": "M8 40 l8-20 12 12z"
    },
    {
      "t": "S",
      "d": "M8 40 l8-20 12 12z M26 14 l3-6 M32 20 l6-2 M30 28 l5 3"
    },
    {
      "t": "C",
      "cx": 35,
      "cy": 9,
      "r": 2.2
    },
    {
      "t": "C",
      "cx": 41,
      "cy": 27,
      "r": 2.2
    },
    {
      "t": "C",
      "cx": 24,
      "cy": 8,
      "r": 1.8
    }
  ],
  "cuisine": [
    {
      "t": "F",
      "d": "M8 24 h32 v8 a8 8 0 0 1 -8 8 h-16 a8 8 0 0 1 -8 -8z"
    },
    {
      "t": "S",
      "d": "M8 24 h32 v8 a8 8 0 0 1 -8 8 h-16 a8 8 0 0 1 -8 -8z M4 24 h40 M24 18 v-3 M17 12 c0-3 3-3 3-6 M28 12 c0-3 3-3 3-6"
    }
  ],
  "maison": [
    {
      "t": "F",
      "d": "M8 22 l12-11 12 11 v16 h-24z"
    },
    {
      "t": "S",
      "d": "M4 24 l16-14 16 14 M8 21 v17 h24 v-17 M17 38 v-9 h6 v9"
    },
    {
      "t": "C",
      "cx": 41,
      "cy": 24,
      "r": 5
    },
    {
      "t": "S",
      "d": "M41 29 v9"
    }
  ],
  "hightech": [
    {
      "t": "F",
      "d": "M8 16 h32 a7 7 0 0 1 7 7 v10 a7 7 0 0 1 -7 7 h-32 a7 7 0 0 1 -7 -7 v-10 a7 7 0 0 1 7 -7z"
    },
    {
      "t": "S",
      "d": "M8 16 h32 a7 7 0 0 1 7 7 v10 a7 7 0 0 1 -7 7 h-32 a7 7 0 0 1 -7 -7 v-10 a7 7 0 0 1 7 -7z M17 22 v10 M12 27 h10"
    },
    {
      "t": "C",
      "cx": 32,
      "cy": 25,
      "r": 2.4
    },
    {
      "t": "C",
      "cx": 38,
      "cy": 30,
      "r": 2.4
    }
  ],
  "electronique": [
    {
      "t": "F",
      "d": "M6 16 h9 l3-5 h12 l3 5 h9 v22 h-36z"
    },
    {
      "t": "S",
      "d": "M6 16 h9 l3-5 h12 l3 5 h9 v22 h-36z"
    },
    {
      "t": "C",
      "cx": 24,
      "cy": 27,
      "r": 7
    },
    {
      "t": "S",
      "d": "M34 21 h.1"
    }
  ],
  "musique": [
    {
      "t": "F",
      "d": "M9 36 a5.5 5.5 0 1 0 11 0 a5.5 5.5 0 1 0 -11 0z M27 32 a5.5 5.5 0 1 0 11 0 a5.5 5.5 0 1 0 -11 0z"
    },
    {
      "t": "C",
      "cx": 14.5,
      "cy": 36,
      "r": 5.5
    },
    {
      "t": "C",
      "cx": 32.5,
      "cy": 32,
      "r": 5.5
    },
    {
      "t": "S",
      "d": "M20 36 V11 M38 32 V7 M20 11 L38 7 M20 17 L38 13"
    }
  ],
  "enfants": [
    {
      "t": "F",
      "d": "M8 14 h10 v10 h18 a10 10 0 0 1 -10 10 h-8 a10 10 0 0 1 -10 -10z"
    },
    {
      "t": "S",
      "d": "M8 14 h10 v10 h18 M8 24 a10 10 0 0 0 10 10 h8 a10 10 0 0 0 10 -10 M8 14 l-4-4"
    },
    {
      "t": "C",
      "cx": 14,
      "cy": 40,
      "r": 3
    },
    {
      "t": "C",
      "cx": 32,
      "cy": 40,
      "r": 3
    }
  ],
  "vetements": [
    {
      "t": "F",
      "d": "M16 8 l8 4 8-4 10 8 -5 6 -5-3 v19 h-16 v-19 l-5 3 -5-6z"
    },
    {
      "t": "S",
      "d": "M16 8 l8 4 8-4 10 8 -5 6 -5-3 v19 h-16 v-19 l-5 3 -5-6z"
    }
  ],
  "pro": [
    {
      "t": "F",
      "d": "M10 30 a14 14 0 0 1 28 0z"
    },
    {
      "t": "S",
      "d": "M6 30 h36 M10 30 a14 14 0 0 1 28 0 M20 16 v-4 h8 v4 M24 12 v18 M4 36 h40"
    }
  ],
  "autre": [
    {
      "t": "F",
      "d": "M22 8 l4 10 10 4 -10 4 -4 10 -4-10 -10-4 10-4z"
    },
    {
      "t": "S",
      "d": "M22 8 l4 10 10 4 -10 4 -4 10 -4-10 -10-4 10-4z M38 30 l2 4 4 2 -4 2 -2 4 -2-4 -4-2 4-2z"
    }
  ]
};

interface Props {
  value: string | null | undefined;
  size?: number;
  color?: string;
}

export function CategoryIcon({ value, size = 28, color = '#2C2C2C' }: Props) {
  const prims = (value && ICONS[value]) || ICONS.autre;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        {prims.map((p, i) => {
          if (p.t === 'F') return <Path key={i} d={p.d} fill={color} opacity={0.22} />;
          if (p.t === 'C') return <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="none" stroke={color} strokeWidth={3.6} />;
          return <Path key={i} d={p.d} fill="none" stroke={color} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />;
        })}
      </Svg>
    </View>
  );
}
