import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Wrench, Camera, Bike, Tent, Speaker, Waves, Shirt, Drill, Guitar, Umbrella, Dumbbell, Package } from 'lucide-react-native';

const ICONS = [
  { Icon: Wrench, color: '#B7BF9C', bg: '#ECEEE6' },
  { Icon: Camera, color: '#C4A882', bg: '#F5EFE6' },
  { Icon: Bike, color: '#B7BF9C', bg: '#ECEEE6' },
  { Icon: Tent, color: '#C4A882', bg: '#F5EFE6' },
  { Icon: Speaker, color: '#B7BF9C', bg: '#ECEEE6' },
  { Icon: Waves, color: '#C4A882', bg: '#F5EFE6' },
  { Icon: Shirt, color: '#B7BF9C', bg: '#ECEEE6' },
  { Icon: Drill, color: '#C4A882', bg: '#F5EFE6' },
  { Icon: Guitar, color: '#B7BF9C', bg: '#ECEEE6' },
  { Icon: Umbrella, color: '#C4A882', bg: '#F5EFE6' },
  { Icon: Dumbbell, color: '#B7BF9C', bg: '#ECEEE6' },
  { Icon: Package, color: '#C4A882', bg: '#F5EFE6' },
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
        {items.map(({ Icon, color, bg }, i) => (
          <View key={i} style={[styles.item, { backgroundColor: bg }]}>
            <Icon size={22} color={color} strokeWidth={1.8} />
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
