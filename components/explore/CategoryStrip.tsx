import { ScrollView, View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

const H_PADDING = 16;
const GAP = 12;

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
  { bg: string; iconColor: string; iconName: string }
> = {
  electronique: { bg: '#D6E8FF', iconColor: '#4A7EC7', iconName: 'desktop-outline' },
  bricolage: { bg: '#D6EDD6', iconColor: '#4A8C4A', iconName: 'construct-outline' },
  sport: { bg: '#FFE8D6', iconColor: '#C07840', iconName: 'barbell-outline' },
  maison: { bg: '#F5E8C8', iconColor: '#A07830', iconName: 'home-outline' },
  evenementiel: { bg: '#FFE8F5', iconColor: '#C050A0', iconName: 'sparkles-outline' },
  vetements: { bg: '#FFD6D6', iconColor: '#B85050', iconName: 'shirt-outline' },
  enfants: { bg: '#EDD6FF', iconColor: '#8050B8', iconName: 'happy-outline' },
  autre: { bg: '#E8E5D8', iconColor: '#7A7A6A', iconName: 'cube-outline' },
  mobilite: { bg: '#D6F0E8', iconColor: '#3A8C6A', iconName: 'bicycle-outline' },
  hightech: { bg: '#D6E0FF', iconColor: '#4A5EC7', iconName: 'game-controller-outline' },
  musique: { bg: '#FFE8F0', iconColor: '#C04070', iconName: 'musical-notes-outline' },
  cuisine: { bg: '#FFF0D6', iconColor: '#C08030', iconName: 'restaurant-outline' },
  camping: { bg: '#E0F0D6', iconColor: '#5A9040', iconName: 'compass-outline' },
  pro: { bg: '#E8E0D6', iconColor: '#8A6A50', iconName: 'briefcase-outline' },
};

const DEFAULT_STYLE = { bg: '#E8E5D8', iconColor: '#7A7A6A', iconName: 'cube-outline' };

export default function CategoryStrip({ categories }: CategoryStripProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  const VISIBLE = isDesktop ? 8.5 : isTablet ? 6.5 : 4.5;
  const chipSize = (width - H_PADDING * 2 - GAP * (Math.floor(VISIBLE) - 1)) / VISIBLE;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { gap: GAP }]}
        decelerationRate="fast"
        {...(Platform.OS === 'web' ? { style: styles.scrollHideBar } : {})}
      >
        {categories.map((cat) => {
          const key = cat.value || '';
          const style = CATEGORY_STYLES[key] || DEFAULT_STYLE;
          const { bg, iconColor, iconName } = style;

          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, { backgroundColor: bg, width: chipSize, minWidth: isDesktop ? 80 : 64 }]}
              onPress={() =>
                router.push({
                  pathname: '/category/[id]',
                  params: { id: cat.id, name: cat.name, value: cat.value ?? '' },
                })
              }
              activeOpacity={0.75}
            >
              <Ionicons name={iconName as any} size={isDesktop ? 20 : 18} color={iconColor} />
              <Text style={[styles.label, isDesktop && styles.labelDesktop]} numberOfLines={1}>
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
  },
  scrollHideBar: {
    ...Platform.select({
      web: { scrollbarWidth: 'none' } as any,
    }),
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
  labelDesktop: {
    fontSize: 11,
  },
});
