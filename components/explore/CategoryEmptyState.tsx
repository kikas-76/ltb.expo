import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

interface CategoryEmptyStateProps {
  categoryName: string;
}

export default function CategoryEmptyState({ categoryName }: CategoryEmptyStateProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="search-outline" size={40} color={Colors.primaryDark} />
      </View>
      <Text style={styles.title}>Aucune annonce dans{'\n'}« {categoryName} »</Text>
      <Text style={styles.subtitle}>
        Soyez le premier à déposer une annonce dans cette catégorie.
      </Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push('/create-listing')}
        activeOpacity={0.8}
      >
        <Ionicons name="add-outline" size={15} color="#fff" />
        <Text style={styles.btnText}>Déposer une annonce</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.primaryDark,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginTop: 8,
  },
  btnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#fff',
  },
});
