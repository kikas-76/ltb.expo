import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Colors } from '@/constants/colors';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CATEGORY_THEMES } from '@/constants/categories';

const VALUES = Object.keys(CATEGORY_THEMES);

const VERTICAL_PADDING = 10;
const ITEM_SIZE = 54;
const ITEM_GAP = 10;
const ITEM_STRIDE = ITEM_SIZE + ITEM_GAP;
const STRIP_WIDTH = VALUES.length * ITEM_STRIDE;
const DURATION = 26000;

/** Ruban infini des catégories : les pictogrammes maison défilent lentement. */
export default function InfiniteIconStrip() {
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: -STRIP_WIDTH,
        duration: DURATION,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const items = [...VALUES, ...VALUES, ...VALUES];
  const totalWidth = items.length * ITEM_STRIDE;

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.strip, { width: totalWidth, transform: [{ translateX }] }]}>
        {items.map((value, i) => {
          const theme = CATEGORY_THEMES[value];
          return (
            <View key={i} style={[styles.item, { backgroundColor: theme.tint }]}>
              <CategoryIcon value={value} size={28} color={theme.ink} />
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    height: ITEM_SIZE + VERTICAL_PADDING * 2,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  strip: {
    flexDirection: 'row',
    gap: ITEM_GAP,
    paddingVertical: VERTICAL_PADDING,
  },
  item: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B3A30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
});
