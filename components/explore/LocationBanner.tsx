import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MapPin, Pencil } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

interface LocationBannerProps {
  address: string | null;
}

export default function LocationBanner({ address }: LocationBannerProps) {
  const router = useRouter();

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.container}
        onPress={() => router.push('/edit-address')}
        activeOpacity={0.75}
      >
        <View style={styles.iconWrap}>
          <MapPin size={16} color={Colors.primaryDark} strokeWidth={2.5} />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.label}>Votre adresse</Text>
          <Text style={styles.address} numberOfLines={1}>
            {address || 'Adresse non renseignée'}
          </Text>
        </View>
        <View style={styles.editBtn}>
          <Pencil size={13} color={Colors.primaryDark} strokeWidth={2} />
          <Text style={styles.editText}>Modifier</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight + '55',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  address: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
    letterSpacing: -0.1,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight + '44',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    flexShrink: 0,
  },
  editText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.primaryDark,
  },
});
