import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <Text style={styles.emoji}>404</Text>
        <Text style={styles.title}>Page introuvable</Text>
        <Text style={styles.subtitle}>
          Ce lien ne fonctionne plus ou n'existe pas.
        </Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Retour à l'accueil →</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: Colors.background,
  },
  emoji: {
    fontSize: 48,
    fontFamily: 'Inter-Bold',
    color: Colors.primaryDark,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  link: {
    marginTop: 28,
  },
  linkText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: Colors.primaryDark,
  },
});
