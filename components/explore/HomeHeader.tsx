import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { TabIcon } from '@/components/TabIcon';
import { useNotifications } from '@/contexts/NotificationsContext';
import { haptics } from '@/lib/haptics';

interface HomeHeaderProps {
  username: string | null;
  photoUrl: string | null;
  notificationCount?: number;
}

/**
 * En-tête de l'accueil : un bonjour discret, la question qui introduit la
 * barre de recherche, et la cloche du centre de notifications avec sa pastille.
 */
export default function HomeHeader({ username }: HomeHeaderProps) {
  const router = useRouter();
  const { unread } = useNotifications();

  return (
    <View style={styles.container}>
      <View style={styles.textCol}>
        <Text style={styles.greeting} numberOfLines={1}>
          {username ? `Bonjour ${username}` : 'Bonjour'}
        </Text>
        <Text style={styles.title}>
          Que voulez-vous <Text style={styles.titleAccent}>louer</Text> aujourd'hui ?
        </Text>
      </View>
      <TouchableOpacity
        style={styles.bell}
        activeOpacity={0.8}
        onPress={() => {
          haptics.selection();
          router.push('/notifications' as any);
        }}
        accessibilityLabel="Notifications"
      >
        <TabIcon name="bell" size={24} color={Colors.text} active={unread > 0} />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 2,
    backgroundColor: Colors.background,
  },
  textCol: { flex: 1, gap: 2 },
  greeting: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.textMuted },
  title: { fontFamily: 'Inter-Bold', fontSize: 24, lineHeight: 30, letterSpacing: -0.5, color: Colors.text },
  titleAccent: { color: Colors.primaryDark },
  bell: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E7E3D5', marginTop: 4,
  },
  badge: {
    position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: '#C25450', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.background,
  },
  badgeText: { fontFamily: 'Inter-Bold', fontSize: 10, color: Colors.white },
});
