import { useRef, useState, useCallback } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  ScrollView,
  Animated,
  Text,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { getOptimizedImageUrl } from '@/lib/imageUrl';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageGalleryProps {
  photos: string[];
  height?: number;
  containerWidth?: number;
  onPhotoChange?: (index: number) => void;
}

function LightboxModal({
  photos,
  initialIndex,
  onClose,
}: {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollRef = useRef<ScrollView>(null);
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [zoomed, setZoomed] = useState(false);
  const zoomScale = useRef(new Animated.Value(1)).current;
  const lastTap = useRef<number>(0);

  const openAnim = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 200 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      scrollRef.current?.scrollTo({ x: initialIndex * SCREEN_WIDTH, animated: false });
    });
  }, []);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      const newZoomed = !zoomed;
      setZoomed(newZoomed);
      Animated.spring(zoomScale, {
        toValue: newZoomed ? 2.2 : 1,
        useNativeDriver: true,
        damping: 16,
        stiffness: 200,
      }).start();
    }
    lastTap.current = now;
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true, damping: 18 }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(onClose);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (idx !== currentIndex) {
      setCurrentIndex(idx);
      if (zoomed) {
        setZoomed(false);
        zoomScale.setValue(1);
      }
    }
  };

  const goTo = (dir: -1 | 1) => {
    const next = Math.max(0, Math.min(photos.length - 1, currentIndex + dir));
    scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
    setCurrentIndex(next);
  };

  return (
    <Modal visible transparent animationType="none" onShow={openAnim} statusBarTranslucent>
      <Animated.View style={[styles.lightboxBg, { opacity: opacityAnim }]} />

      <Animated.View
        style={[styles.lightboxContainer, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}
      >
        {/* Close button */}
        <TouchableOpacity style={styles.lightboxClose} onPress={handleClose} activeOpacity={0.8}>
          <Ionicons name="close-outline" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Counter */}
        <View style={styles.lightboxCounter}>
          <Text style={styles.lightboxCounterText}>
            {currentIndex + 1} / {photos.length}
          </Text>
        </View>

        {/* Images scrollable */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          scrollEnabled={!zoomed}
          style={styles.lightboxScroll}
        >
          {photos.map((photo, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={1}
              onPress={handleDoubleTap}
              style={styles.lightboxPage}
            >
              <Animated.Image
                source={{ uri: getOptimizedImageUrl(photo, { width: 1400, quality: 85 }) ?? photo }}
                style={[
                  styles.lightboxImage,
                  i === currentIndex && { transform: [{ scale: zoomScale }] },
                ]}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Prev / next arrows */}
        {photos.length > 1 && (
          <>
            {currentIndex > 0 && (
              <TouchableOpacity style={[styles.lightboxArrow, styles.lightboxArrowLeft]} onPress={() => goTo(-1)}>
                <Ionicons name="chevron-back-outline" size={22} color="#fff" />
              </TouchableOpacity>
            )}
            {currentIndex < photos.length - 1 && (
              <TouchableOpacity style={[styles.lightboxArrow, styles.lightboxArrowRight]} onPress={() => goTo(1)}>
                <Ionicons name="chevron-forward-outline" size={22} color="#fff" />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Dot indicators */}
        {photos.length > 1 && (
          <View style={styles.lightboxDots}>
            {photos.map((_, i) => (
              <View key={i} style={[styles.lightboxDot, i === currentIndex && styles.lightboxDotActive]} />
            ))}
          </View>
        )}

        {/* Zoom hint */}
        <View style={styles.zoomHint}>
          <Ionicons name="expand-outline" size={12} color="rgba(255,255,255,0.6)" />
          <Text style={styles.zoomHintText}>Double-tap pour zoomer</Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

export default function ImageGallery({ photos, height = 340, containerWidth, onPhotoChange }: ImageGalleryProps) {
  const slideWidth = containerWidth ?? SCREEN_WIDTH;
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const dotAnim = useRef(photos.map(() => new Animated.Value(0))).current;

  const animateDot = (index: number) => {
    dotAnim.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: i === index ? 1 : 0,
        useNativeDriver: false,
        damping: 16,
        stiffness: 220,
      }).start();
    });
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
    if (idx !== activeIndex) {
      setActiveIndex(idx);
      animateDot(idx);
      onPhotoChange?.(idx);
    }
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const goTo = (dir: -1 | 1) => {
    const next = Math.max(0, Math.min(photos.length - 1, activeIndex + dir));
    scrollRef.current?.scrollTo({ x: next * slideWidth, animated: true });
    setActiveIndex(next);
    animateDot(next);
    onPhotoChange?.(next);
  };

  if (photos.length === 0) {
    return <View style={[styles.galleryContainer, { height }]}><View style={[styles.fallback, { height }]} /></View>;
  }

  return (
    <View style={[styles.galleryContainer, { height }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEnabled={photos.length > 1}
        style={{ width: slideWidth, height }}
        decelerationRate="fast"
      >
        {photos.map((photo, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.97}
            onPress={() => openLightbox(i)}
            style={{ width: slideWidth, height }}
          >
            <Image source={{ uri: getOptimizedImageUrl(photo, { width: 1000 }) ?? photo }} style={{ width: slideWidth, height }} resizeMode="contain" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Zoom icon hint */}
      <View style={styles.zoomIconHint} pointerEvents="none">
        <Ionicons name="expand-outline" size={14} color="rgba(255,255,255,0.9)" />
      </View>

      {/* Prev/Next buttons for multi-photo */}
      {photos.length > 1 && activeIndex > 0 && (
        <TouchableOpacity style={[styles.navArrow, styles.navArrowLeft]} onPress={() => goTo(-1)} activeOpacity={0.85}>
          <Ionicons name="chevron-back-outline" size={18} color="#fff" />
        </TouchableOpacity>
      )}
      {photos.length > 1 && activeIndex < photos.length - 1 && (
        <TouchableOpacity style={[styles.navArrow, styles.navArrowRight]} onPress={() => goTo(1)} activeOpacity={0.85}>
          <Ionicons name="chevron-forward-outline" size={18} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Dot indicators */}
      {photos.length > 1 && (
        <View style={styles.dots}>
          {photos.map((_, i) => {
            const width = dotAnim[i].interpolate({ inputRange: [0, 1], outputRange: [6, 20] });
            const opacity = dotAnim[i].interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
            return (
              <TouchableOpacity key={i} onPress={() => {
                scrollRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
                setActiveIndex(i);
                animateDot(i);
              }}>
                <Animated.View style={[styles.dot, { width, opacity }]} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.thumbStrip}
          contentContainerStyle={styles.thumbStripContent}
        >
          {photos.map((photo, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                scrollRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
                setActiveIndex(i);
                animateDot(i);
              }}
              activeOpacity={0.8}
              style={[styles.thumbBtn, i === activeIndex && styles.thumbBtnActive]}
            >
              <Image source={{ uri: getOptimizedImageUrl(photo, { width: 120 }) ?? photo }} style={styles.thumbImg} resizeMode="cover" />
              {i === activeIndex && <View style={styles.thumbOverlay} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Photo count badge (top-right) */}
      {photos.length > 1 && (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{activeIndex + 1}/{photos.length}</Text>
        </View>
      )}

      {lightboxOpen && (
        <LightboxModal
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  galleryContainer: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  fallback: {
    backgroundColor: Colors.primaryLight,
    width: '100%',
  },

  /* Nav arrows */
  navArrow: {
    position: 'absolute',
    top: '42%',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  navArrowLeft: { left: 12 },
  navArrowRight: { right: 12 },

  /* Dots */
  dots: {
    position: 'absolute',
    bottom: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 5,
    zIndex: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },

  /* Thumbnails */
  thumbStrip: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    zIndex: 4,
  },
  thumbStripContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  thumbBtn: {
    width: 46,
    height: 46,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbBtnActive: {
    borderColor: '#fff',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  /* Count badge */
  countBadge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 40,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 5,
  },
  countBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#fff',
  },

  /* Zoom hint */
  zoomIconHint: {
    position: 'absolute',
    bottom: 72,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 99,
    padding: 6,
    zIndex: 4,
  },

  /* Lightbox */
  lightboxBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  lightboxContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxScroll: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  lightboxPage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  lightboxClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 36,
    right: 18,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxCounter: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  lightboxCounterText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  lightboxArrow: {
    position: 'absolute',
    top: '48%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  lightboxArrowLeft: { left: 14 },
  lightboxArrowRight: { right: 14 },
  lightboxDots: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 48 : 32,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    zIndex: 10,
  },
  lightboxDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  lightboxDotActive: {
    backgroundColor: '#fff',
    width: 18,
  },
  zoomHint: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 80 : 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
    zIndex: 10,
  },
  zoomHintText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
});
