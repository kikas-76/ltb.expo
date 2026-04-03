import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function EmptyState() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Ionicons name="infinite-outline" size={48} color={Colors.primaryDark} />
      <Text style={styles.title}>Pas encore d'objets près de chez vous</Text>
      <Text style={styles.subtitle}>Soyez le premier à publier !</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/create-listing')}
        activeOpacity={0.8}
      >
        <Ionicons name="add-outline" size={16} color={Colors.primaryDark} />
        <Text style={styles.buttonText}>Publier un objet</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 8,
  },
  title: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 12,
  },
  buttonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.primaryDark,
  },
});
