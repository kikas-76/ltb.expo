import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

interface AppleButtonProps {
  onPress: () => void;
}

// Bouton natif Sign in with Apple (conforme aux Human Interface Guidelines).
// Le libellé suit la langue de l'appareil (« Continuer avec Apple » en
// français) grâce à la localisation fr du bundle. Le contour blanc s'accorde
// au bouton Google juste en dessous. Masqué hors iOS (voir AppleButton.web.tsx).
export default function AppleButton({ onPress }: AppleButtonProps) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => setAvailable(false));
    }
  }, []);

  if (!available) return null;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
      cornerRadius={27}
      style={styles.btn}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '100%',
    height: 54,
  },
});
