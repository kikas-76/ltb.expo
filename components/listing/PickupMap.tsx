import { Platform, View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY as string;

interface PickupMapProps {
  lat: number;
  lng: number;
}

function getEmbedUrl(lat: number, lng: number): string {
  return (
    `https://www.google.com/maps/embed/v1/view` +
    `?key=${GOOGLE_MAPS_KEY}` +
    `&center=${lat},${lng}` +
    `&zoom=14` +
    `&maptype=roadmap`
  );
}

function getMapHtml(lat: number, lng: number): string {
  const embedUrl = getEmbedUrl(lat, lng);
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>* { margin:0; padding:0; box-sizing:border-box; } html,body,iframe { width:100%; height:100%; border:none; display:block; }</style>
</head><body>
<iframe src="${embedUrl}" width="100%" height="100%" frameborder="0" allowfullscreen style="pointer-events:none"></iframe>
</body></html>`;
}

export default function PickupMap({ lat, lng }: PickupMapProps) {
  if (Platform.OS === 'web') {
    const embedUrl = getEmbedUrl(lat, lng);
    return (
      <View style={styles.wrapper}>
        <iframe
          src={embedUrl}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', pointerEvents: 'none' }}
          scrolling="no"
          title="Carte de récupération"
        />
      </View>
    );
  }

  const { default: WebView } = require('react-native-webview');
  return (
    <View style={styles.wrapper}>
      <WebView
        style={styles.webview}
        scrollEnabled={false}
        pointerEvents="none"
        source={{ html: getMapHtml(lat, lng) }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 190,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  webview: {
    flex: 1,
  },
});
