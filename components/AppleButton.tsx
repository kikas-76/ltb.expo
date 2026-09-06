import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Colors } from '@/constants/colors';

interface AppleButtonProps {
  onPress: () => void;
}

// Bouton personnalisé (autorisé par les Human Interface Guidelines « Sign in
// with Apple » : logo Apple + libellé « Continuer avec Apple », fond blanc
// avec contour). Le bouton natif AppleAuthenticationButton impose la police
// système et un libellé dans la langue de développement du bundle (anglais),
// ce qui le rendait différent du bouton Google juste en dessous.
export default function AppleButton({ onPress }: AppleButtonProps) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => setAvailable(false));
    }
  }, []);

  if (!available) return null;

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Continuer avec Apple"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="logo-apple" size={22} color="#000" />
      </View>
      <Text style={styles.btnText}>Continuer avec Apple</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: 54,
    gap: 10,
  },
  iconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    // Le logo Apple est visuellement centré un peu bas ; on le remonte.
    marginTop: -2,
  },
  btnText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
    letterSpacing: 0.1,
  },
});
