import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface Props {
  status: string;
  reason?: string | null;
  until?: string | null;
  onSignOut: () => void;
}

/** Écran plein affiché à la place de l'app quand le compte est suspendu ou banni. */
export default function SuspendedScreen({ status, reason, until, onSignOut }: Props) {
  const banned = status === 'banned';
  const untilLabel = until && !banned
    ? new Date(until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="ban-outline" size={30} color={Colors.error} />
        </View>
        <Text style={styles.title}>{banned ? 'Compte fermé' : 'Compte suspendu'}</Text>
        <Text style={styles.text}>
          {banned
            ? "Votre compte a été fermé pour non-respect des conditions d'utilisation."
            : untilLabel
              ? `Votre compte est suspendu jusqu'au ${untilLabel}.`
              : 'Votre compte est suspendu pour le moment.'}
        </Text>
        {reason ? <Text style={styles.reason}>Motif : {reason}</Text> : null}
        <Text style={styles.text}>
          Pendant cette période, vous ne pouvez ni publier, ni écrire, ni réserver. Pour toute question ou contestation, écrivez-nous.
        </Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => Linking.openURL('mailto:admin@louetonbien.fr')} activeOpacity={0.85}>
          <Text style={styles.btnPrimaryText}>Contacter le support</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={onSignOut} activeOpacity={0.8}>
          <Text style={styles.btnSecondaryText}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, backgroundColor: Colors.white, borderRadius: 24, padding: 28, gap: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.errorLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontFamily: 'Inter-Bold', fontSize: 22, color: Colors.text, textAlign: 'center' },
  text: { fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 22, color: Colors.textSecondary, textAlign: 'center' },
  reason: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.text, textAlign: 'center' },
  btnPrimary: { marginTop: 8, alignSelf: 'stretch', backgroundColor: Colors.primaryDark, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  btnPrimaryText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.white },
  btnSecondary: { alignSelf: 'stretch', paddingVertical: 12, alignItems: 'center' },
  btnSecondaryText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.textSecondary },
});
