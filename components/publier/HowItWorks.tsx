import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

const STEPS: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  {
    icon: 'mail-unread-outline',
    title: 'Un voisin vous envoie une demande',
    text: 'Vous êtes prévenu par email, avec ses dates et son message.',
  },
  {
    icon: 'checkmark-circle-outline',
    title: 'Vous acceptez, ou non',
    text: 'Vous gardez toujours le dernier mot. Le lieu de remise se décide ensemble, dans la messagerie.',
  },
  {
    icon: 'card-outline',
    title: 'Il paie en ligne',
    text: 'Le locataire paie avant de récupérer l\'objet, et une caution peut protéger votre objet.',
  },
  {
    icon: 'cash-outline',
    title: 'Vous êtes payé',
    text: 'Après la location, votre gain vous est versé par virement sur votre compte bancaire.',
  },
];

/** Les 4 étapes d'une location, côté propriétaire. */
export default function HowItWorks() {
  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Comment ça marche</Text>
      {STEPS.map((s, i) => (
        <View key={s.title} style={styles.row}>
          <View style={styles.rail}>
            <View style={styles.badge}>
              <Ionicons name={s.icon} size={18} color={Colors.primaryDark} />
            </View>
            {i < STEPS.length - 1 && <View style={styles.line} />}
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>
              {i + 1}. {s.title}
            </Text>
            <Text style={styles.text}>{s.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  heading: { fontFamily: 'Inter-Bold', fontSize: 18, color: Colors.text, marginBottom: 14 },
  row: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 36 },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { flex: 1, width: 2, backgroundColor: Colors.primary + '33', marginVertical: 4 },
  body: { flex: 1, paddingBottom: 16, paddingTop: 6 },
  title: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.text, marginBottom: 3 },
  text: { fontFamily: 'Inter-Regular', fontSize: 13.5, lineHeight: 19, color: Colors.textSecondary },
});
