import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ICONS = [
  { iconName: 'construct-outline', color: '#B7BF9C', bg: '#ECEEE6' },
  { iconName: 'camera-outline', color: '#C4A882', bg: '#F5EFE6' },
  { iconName: 'bicycle-outline', color: '#B7BF9C', bg: '#ECEEE6' },
  { iconName: 'home-outline', color: '#C4A882', bg: '#F5EFE6' },
  { iconName: 'volume-medium-outline', color: '#B7BF9C', bg: '#ECEEE6' },
  { iconName: 'water-outline', color: '#C4A882', bg: '#F5EFE6' },
  { iconName: 'shirt-outline', color: '#B7BF9C', bg: '#ECEEE6' },
  { iconName: 'construct-outline', color: '#C4A882', bg: '#F5EFE6' },
  { iconName: 'musical-notes-outline', color: '#B7BF9C', bg: '#ECEEE6' },
  { iconName: 'umbrella-outline', color: '#C4A882', bg: '#F5EFE6' },
  { iconName: 'barbell-outline', color: '#B7BF9C', bg: '#ECEEE6' },
  { iconName: 'cube-outline', color: '#C4A882', bg: '#F5EFE6' },
];

const BG = '#F5F0E8';
const VERTICAL_PADDING = 12;
const ITEM_SIZE = 52;
const ITEM_GAP = 10;
const ITEM_STRIDE = ITEM_SIZE + ITEM_GAP;
const STRIP_WIDTH = ICONS.length * ITEM_STRIDE;
const DURATION = 18000;

export default function InfiniteIconStrip() {
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: -STRIP_WIDTH,
        duration: DURATION,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const items = [...ICONS, ...ICONS];

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.strip, { transform: [{ translateX }] }]}>
        {items.map(({ iconName, color, bg }, i) => (
          <View key={i} style={[styles.item, { backgroundColor: bg }]}>
            <Ionicons name={iconName as any} size={22} color={color} />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: ITEM_SIZE + VERTICAL_PADDING * 2,
    overflow: 'hidden',
    backgroundColor: BG,
  },
  strip: {
    flexDirection: 'row',
    gap: ITEM_GAP,
    paddingHorizontal: 5,
    paddingVertical: VERTICAL_PADDING,
  },
  item: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
});
