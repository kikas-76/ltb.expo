import { useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import type { ImageLoadEventData } from 'expo-image';

interface Props {
  uri: string;
  style?: StyleProp<ViewStyle>;
  /** Couleur visible autour de la photo quand son ratio diffère du cadre. */
  backgroundColor?: string;
  recyclingKey?: string;
  transition?: number;
  /** Ratio largeur/hauteur réel de la photo, dès qu'il est connu. */
  onRatio?: (ratio: number) => void;
  /** Image déjà en cache (ex. vignette de la card) affichée instantanément
   *  pendant que la version définitive se charge. */
  placeholderUri?: string | null;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Photo d'annonce plein cadre (cover) : une seule image chargée, mise en cache,
 * et le ratio réel remonté au parent dès le chargement (la galerie s'en sert
 * pour caler son cadre sur la première photo, qui n'est alors pas recadrée).
 */
export function AdaptiveImage({
  uri,
  style,
  backgroundColor = '#EFEDE4',
  recyclingKey,
  transition = 150,
  onRatio,
  placeholderUri,
  priority = 'normal',
}: Props) {
  const [reported, setReported] = useState(false);

  const onLoad = (e: ImageLoadEventData) => {
    if (reported) return;
    const w = e.source?.width;
    const h = e.source?.height;
    if (w && h) {
      setReported(true);
      onRatio?.(w / h);
    }
  };

  return (
    <View style={[styles.box, { backgroundColor }, style]}>
      <ExpoImage
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={transition}
        recyclingKey={recyclingKey}
        onLoad={onLoad}
        priority={priority}
        placeholder={placeholderUri ? { uri: placeholderUri } : undefined}
        placeholderContentFit="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
  },
});
