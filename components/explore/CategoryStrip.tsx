import { ScrollView, View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { CategoryIcon } from '@/components/CategoryIcon';
import { categoryTheme } from '@/constants/categories';

const H_PADDING = 16;
const GAP = 14;

interface Category {
  id: string;
  name: string;
  value: string | null;
  icon_path: string | null;
}

interface CategoryStripProps {
  categories: Category[];
}

/**
 * Bande de catégories : tuiles « sticker » teintées, pictogramme maison
 * (traits épais arrondis + aplat duotone), pastille décorative en coin,
 * libellé sous la tuile. Chaque catégorie a sa propre teinte, issue de la
 * palette terreuse de la marque.
 */
export default function CategoryStrip({ categories }: CategoryStripProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  const VISIBLE = isDesktop ? 9.5 : isTablet ? 7.5 : 4.6;
  const tile = Math.round((width - H_PADDING * 2 - GAP * (Math.floor(VISIBLE) - 1)) / VISIBLE);
  const tileSize = Math.max(58, Math.min(tile, 84));
  const iconSize = Math.round(tileSize * 0.5);

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
          const theme = categoryTheme(cat.value);
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.item, { width: tileSize }]}
              onPress={() =>
                router.push({
                  pathname: '/category/[id]',
                  params: { id: cat.id, name: cat.name, value: cat.value ?? '' },
                })
              }
              activeOpacity={0.8}
            >
              <View style={[styles.tile, { width: tileSize, height: tileSize, backgroundColor: theme.tint }]}>
                {/* Pastille décorative en coin, comme un sticker */}
                <View
                  style={[
                    styles.tileDot,
                    { width: tileSize * 0.5, height: tileSize * 0.5, borderRadius: tileSize * 0.25, backgroundColor: theme.ink },
                  ]}
                />
                <CategoryIcon value={cat.value} size={iconSize} color={theme.ink} />
              </View>
              <Text style={[styles.label, isDesktop && styles.labelDesktop]} numberOfLines={2}>
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
    paddingVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: H_PADDING,
  },
  scrollHideBar: {
    ...Platform.select({
      web: { scrollbarWidth: 'none' } as any,
    }),
  },
  item: {
    alignItems: 'center',
    gap: 7,
  },
  tile: {
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#3B3A30', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 2 },
      web: { boxShadow: '0 3px 6px rgba(59,58,48,0.08)' },
    }),
  },
  tileDot: {
    position: 'absolute',
    top: -8,
    right: -8,
    opacity: 0.1,
  },
  label: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    lineHeight: 14,
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  labelDesktop: {
    fontSize: 12,
    lineHeight: 15,
  },
});
