import { Image as RNImage, ImageProps, Platform } from 'react-native';
import { getOptimizedImageUrl } from '@/lib/imageUrl';

interface Props extends Omit<ImageProps, 'source'> {
  uri: string | null | undefined;
  width?: number; // intended display width (CSS px); used to size the transform
  quality?: number;
  resize?: 'cover' | 'contain' | 'fill';
}

export function SmartImage({ uri, width, quality, resize, style, ...rest }: Props) {
  const transformWidth = width ? Math.round(width * 2) : undefined;
  const optimized = getOptimizedImageUrl(uri, { width: transformWidth, quality, resize });

  if (Platform.OS === 'web' && optimized) {
    const flatStyle = (Array.isArray(style) ? Object.assign({}, ...style) : style) ?? {};
    return (
      <img
        src={optimized}
        loading="lazy"
        decoding="async"
        style={{ objectFit: 'cover', ...flatStyle }}
      />
    );
  }

  return <RNImage source={optimized ? { uri: optimized } : { uri: uri ?? '' }} style={style} {...rest} />;
}
