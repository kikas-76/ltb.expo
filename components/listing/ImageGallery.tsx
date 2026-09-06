import { useRef, useState, useCallback } from 'react';
import {
  View,
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
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdaptiveImage } from '@/components/AdaptiveImage';
import { Colors } from '@/constants/colors';
import { getOptimizedImageUrl } from '@/lib/imageUrl';
import { CARD_IMAGE_TRANSFORM } from '@/components/explore/ListingCard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageGalleryProps {
  photos: string[];
  height?: number;
  containerWidth?: number;
  onPhotoChange?: (index: number) => void;
  /** Titre de l'annonce, affiché en tête de la page photos. */
  title?: string;
}

/* ------------------------------------------------------------------ */
/* Zoom plein écran (double-tap) — ouvert depuis la page photos         */
/* ------------------------------------------------------------------ */
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

  return (
    <Modal visible transparent animationType="none" onShow={openAnim} statusBarTranslucent>
      <Animated.View style={[styles.lightboxBg, { opacity: opacityAnim }]} />
      <Animated.View
        style={[styles.lightboxContainer, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}
      >
        <TouchableOpacity style={styles.lightboxClose} onPress={handleClose} activeOpacity={0.8}>
          <Ionicons name="close-outline" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.lightboxCounter}>
          <Text style={styles.lightboxCounterText}>
            {currentIndex + 1} / {photos.length}
          </Text>
        </View>

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
                // Ajustement dans un carré de 2000 px : ratio conservé, photo entière.
                source={{ uri: getOptimizedImageUrl(photo, { width: 2000, height: 2000, resize: 'contain', quality: 85 }) ?? photo }}
                style={[
                  styles.lightboxImage,
                  i === currentIndex && { transform: [{ scale: zoomScale }] },
                ]}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.zoomHint}>
          <Ionicons name="expand-outline" size={12} color="rgba(255,255,255,0.6)" />
          <Text style={styles.zoomHintText}>Double-tap pour zoomer</Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Page photos façon Leboncoin : titre + toutes les photos entières,    */
/* l'une sous l'autre, chacune dans un cadre arrondi à son propre ratio */
/* ------------------------------------------------------------------ */
function PhotoListModal({
  photos,
  title,
  initialIndex,
  onClose,
}: {
  photos: string[];
  title?: string;
  initialIndex: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const cardW = Math.min(winW, 720) - 32;
  const [ratios, setRatios] = useState<Record<number, number>>({});
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrolled = useRef(false);

  const onItemLayout = (i: number, y: number) => {
    if (i === initialIndex && initialIndex > 0 && !scrolled.current) {
      scrolled.current = true;
      setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: false }), 0);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.listRoot, { paddingTop: insets.top }]}>
        <View style={styles.listTopBar}>
          <TouchableOpacity onPress={onClose} style={styles.listBackBtn} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.listTitle} numberOfLines={1}>{title ?? 'Photos'}</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {photos.map((photo, i) => {
            const ratio = ratios[i] ?? 4 / 3;
            // Photo entière (ajustée dans 1600 px), le cadre prend son ratio réel.
            const uri = getOptimizedImageUrl(photo, { width: 1200, height: 1200, resize: 'contain', quality: 80 }) ?? photo;
            // Le héros (déjà chargé) sert de placeholder instantané.
            const heroUri = getOptimizedImageUrl(photo, { width: 786, height: 668, resize: 'cover', quality: 72 });
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.95}
                onPress={() => setZoomIndex(i)}
                onLayout={(e) => onItemLayout(i, e.nativeEvent.layout.y)}
                style={[styles.listCard, { width: cardW, aspectRatio: ratio }]}
              >
                <AdaptiveImage
                  uri={uri}
                  style={StyleSheet.absoluteFill}
                  backgroundColor="#E9E6DA"
                  placeholderUri={heroUri}
                  onRatio={(r) => setRatios((prev) => (prev[i] ? prev : { ...prev, [i]: r }))}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {zoomIndex !== null && (
          <LightboxModal photos={photos} initialIndex={zoomIndex} onClose={() => setZoomIndex(null)} />
        )}
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Héros de la fiche : cadre fixe, photo en cover, compteur en bas à    */
/* droite ; le tap ouvre la page photos                                  */
/* ------------------------------------------------------------------ */
export default function ImageGallery({ photos, height = 340, containerWidth, onPhotoChange, title }: ImageGalleryProps) {
  const slideWidth = containerWidth ?? SCREEN_WIDTH;
  const [activeIndex, setActiveIndex] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const showArrows = Platform.OS === 'web' && slideWidth >= 768 && photos.length > 1;

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
    if (idx !== activeIndex) {
      setActiveIndex(idx);
      onPhotoChange?.(idx);
    }
  };

  const goTo = (dir: -1 | 1) => {
    const next = Math.max(0, Math.min(photos.length - 1, activeIndex + dir));
    scrollRef.current?.scrollTo({ x: next * slideWidth, animated: true });
    setActiveIndex(next);
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
        {photos.map((photo, i) => {
          // Le serveur recadre exactement au ratio du cadre (2× pour l'écran Retina) :
          // recadrage centré comme Leboncoin, poids minimal. Seules la photo affichée
          // et ses voisines se chargent.
          const uri = getOptimizedImageUrl(photo, {
            width: Math.round(slideWidth * 2),
            height: Math.round(height * 2),
            resize: 'cover',
            quality: 72,
          }) ?? photo;
          const shouldLoad = Math.abs(i - activeIndex) <= 1;
          // Même URL que la vignette de la card : déjà en cache, affichée à l'instant
          // pendant que le héros haute définition se charge.
          const thumb = getOptimizedImageUrl(photo, CARD_IMAGE_TRANSFORM);
          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.97}
              onPress={() => setListOpen(true)}
              style={{ width: slideWidth, height }}
            >
              {shouldLoad ? (
                <AdaptiveImage
                  uri={uri}
                  style={{ width: slideWidth, height }}
                  backgroundColor={Colors.background}
                  transition={150}
                  placeholderUri={thumb}
                  priority={i === activeIndex ? 'high' : 'normal'}
                />
              ) : (
                <View style={{ width: slideWidth, height, backgroundColor: Colors.background }} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {showArrows && activeIndex > 0 && (
        <TouchableOpacity style={[styles.navArrow, styles.navArrowLeft]} onPress={() => goTo(-1)} activeOpacity={0.85}>
          <Ionicons name="chevron-back-outline" size={18} color="#fff" />
        </TouchableOpacity>
      )}
      {showArrows && activeIndex < photos.length - 1 && (
        <TouchableOpacity style={[styles.navArrow, styles.navArrowRight]} onPress={() => goTo(1)} activeOpacity={0.85}>
          <Ionicons name="chevron-forward-outline" size={18} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Compteur façon Leboncoin, en bas à droite */}
      <View style={styles.countBadge} pointerEvents="none">
        <Ionicons name="camera-outline" size={13} color="#fff" />
        <Text style={styles.countBadgeText}>{activeIndex + 1}/{photos.length}</Text>
      </View>

      {listOpen && (
        <PhotoListModal
          photos={photos}
          title={title}
          initialIndex={activeIndex}
          onClose={() => setListOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  galleryContainer: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  fallback: {
    backgroundColor: Colors.primaryLight,
    width: '100%',
  },

  /* Flèches (web large uniquement) */
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

  /* Compteur */
  countBadge: {
    position: 'absolute',
    bottom: 38,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    zIndex: 5,
  },
  countBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#fff',
  },

  /* Page photos */
  listRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    height: 60,
  },
  listBackBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
      android: { elevation: 3 },
      web: { boxShadow: '0 2px 6px rgba(0,0,0,0.12)' },
    }),
  },
  listTitle: {
    flex: 1,
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
    alignItems: 'center',
  },
  listCard: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E9E6DA',
  },

  /* Zoom */
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
    height: SCREEN_HEIGHT * 0.8,
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
