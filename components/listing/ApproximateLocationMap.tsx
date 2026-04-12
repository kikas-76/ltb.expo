import { useState } from 'react';
import { View, Text, StyleSheet, Platform, LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { getStaticMapUrl } from '@/lib/googleMaps';

interface ApproximateLocationMapProps {
  lat: number;
  lng: number;
  city: string | null;
}

export default function ApproximateLocationMap({ lat, lng, city }: ApproximateLocationMapProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [imgError, setImgError] = useState(false);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const mapHeight = containerWidth > 0 ? Math.round(containerWidth * 0.48) : 0;
  const apiW = Math.min(Math.round(containerWidth), 640);
  const apiH = Math.min(Math.round(containerWidth * 0.48), 640);
  const apiSize = containerWidth > 0 ? `${apiW}x${apiH}` : '600x288';

  const mapUrl = containerWidth > 0 ? getStaticMapUrl(lat, lng, 13, apiSize) : null;

  const cx = containerWidth / 2;
  const cy = mapHeight / 2;
  const r = Math.round(containerWidth * 0.14);

  const overlay = containerWidth > 0 && mapHeight > 0 ? (
    <View
      style={[StyleSheet.absoluteFill, { width: containerWidth, height: mapHeight }]}
      pointerEvents="none"
    >
      <Svg width={containerWidth} height={mapHeight}>
        <Defs>
          <RadialGradient id="cg" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={Colors.primaryDark} stopOpacity="0.38" />
            <Stop offset="55%" stopColor={Colors.primary} stopOpacity="0.22" />
            <Stop offset="100%" stopColor={Colors.primary} stopOpacity="0.04" />
          </RadialGradient>
        </Defs>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          fill="url(#cg)"
          stroke={Colors.primaryDark}
          strokeWidth={2}
          strokeOpacity={0.5}
          strokeDasharray="7 5"
        />
        <Circle cx={cx} cy={cy} r={9} fill={Colors.primaryDark} fillOpacity={0.85} />
        <Circle cx={cx} cy={cy} r={4} fill={Colors.white} />
      </Svg>
    </View>
  ) : null;

  return (
    <View style={styles.card}>
      <View style={[styles.mapContainer, { height: mapHeight || undefined }]} onLayout={onLayout}>
        {mapUrl && !imgError ? (
          Platform.OS === 'web' ? (
            <>
              <img
                src={mapUrl}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={() => setImgError(true)}
                alt="Carte de localisation approximative"
              />
              {overlay}
            </>
          ) : (
            <>
              <NativeImage
                uri={mapUrl}
                width={containerWidth}
                height={mapHeight}
                onError={() => setImgError(true)}
              />
              {overlay}
            </>
          )
        ) : imgError ? (
          <FallbackMap city={city} />
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Ionicons name="location-outline" size={13} color={Colors.primaryDark} />
          {city ? (
            <Text style={styles.cityText}>{city}</Text>
          ) : (
            <Text style={styles.cityTextMuted}>Localisation non disponible</Text>
          )}
        </View>
        <Text style={styles.approxLabel}>Adresse approximative</Text>
      </View>
    </View>
  );
}

function NativeImage({ uri, width, height, onError }: { uri: string; width: number; height: number; onError: () => void }) {
  const { Image } = require('react-native');
  return (
    <Image
      source={{ uri }}
      style={[StyleSheet.absoluteFill, { width, height }]}
      resizeMode="cover"
      onError={onError}
    />
  );
}

function FallbackMap({ city }: { city: string | null }) {
  return (
    <View style={styles.fallback}>
      <Ionicons name="map-outline" size={32} color={Colors.primary} />
      <Text style={styles.fallbackText}>{city ?? 'Carte non disponible'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10 },
      android: { elevation: 3 },
      web: { boxShadow: '0 3px 10px rgba(0,0,0,0.08)' },
    }),
  },
  mapContainer: {
    width: '100%',
    aspectRatio: 2.08,
    backgroundColor: Colors.borderLight,
    position: 'relative',
    overflow: 'hidden',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cityText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  cityTextMuted: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  approxLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.borderLight,
  },
  fallbackText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.textMuted,
  },
});
