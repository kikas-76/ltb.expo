import { ScrollView, View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Monitor, Wrench, Dumbbell, Hop as Home, PartyPopper, Shirt, Baby, Package } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

const H_PADDING = 16;
const GAP = 8;
const VISIBLE = 4.5;

interface Category {
  id: string;
  name: string;
  value: string | null;
  icon_path: string | null;
}

interface CategoryStripProps {
  categories: Category[];
}

const CATEGORY_STYLES: Record<
  string,
  { bg: string; iconColor: string; Icon: React.ComponentType<any> }
> = {
  electronique: { bg: '#D6E8FF', iconColor: '#4A7EC7', Icon: Monitor },
  bricolage: { bg: '#D6EDD6', iconColor: '#4A8C4A', Icon: Wrench },
  sport: { bg: '#FFE8D6', iconColor: '#C07840', Icon: Dumbbell },
  maison: { bg: '#F5E8C8', iconColor: '#A07830', Icon: Home },
  evenementiel: { bg: '#FFE8F5', iconColor: '#C050A0', Icon: PartyPopper },
  vetements: { bg: '#FFD6D6', iconColor: '#B85050', Icon: Shirt },
  enfants: { bg: '#EDD6FF', iconColor: '#8050B8', Icon: Baby },
  autre: { bg: '#E8E5D8', iconColor: '#7A7A6A', Icon: Package },
};

const DEFAULT_STYLE = { bg: '#E8E5D8', iconColor: '#7A7A6A', Icon: Package };

export default function CategoryStrip({ categories }: CategoryStripProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const chipSize = (width - H_PADDING * 2 - GAP * (Math.floor(VISIBLE) - 1)) / VISIBLE;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
      >
        {categories.map((cat) => {
          const key = cat.value || '';
          const style = CATEGORY_STYLES[key] || DEFAULT_STYLE;
          const { Icon, bg, iconColor } = style;

          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, { backgroundColor: bg, width: chipSize }]}
              onPress={() =>
                router.push({
                  pathname: '/category/[id]',
                  params: { id: cat.id, name: cat.name, value: cat.value ?? '' },
                })
              }
              activeOpacity={0.75}
            >
              <Icon size={18} color={iconColor} strokeWidth={1.8} />
              <Text style={styles.label} numberOfLines={1}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.background,
    paddingVertical: 6,
  },
  scrollContent: {
    paddingHorizontal: H_PADDING,
    gap: GAP,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 10,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  label: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    color: Colors.text,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});
