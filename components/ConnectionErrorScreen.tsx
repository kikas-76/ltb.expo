import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import LoadError from '@/components/LoadError';

interface Props {
  onRetry: () => void;
  onSignOut: () => void;
}

/** Plein écran quand le profil n'a pas pu être lu au démarrage (réseau, serveur). */
export default function ConnectionErrorScreen({ onRetry, onSignOut }: Props) {
  return (
    <View style={styles.root}>
      <LoadError onRetry={onRetry} title="Connexion impossible" />
      <TouchableOpacity onPress={onSignOut} activeOpacity={0.7} style={styles.link}>
        <Text style={styles.linkText}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', padding: 24 },
  link: { alignSelf: 'center', paddingVertical: 12 },
  linkText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.textSecondary },
});
