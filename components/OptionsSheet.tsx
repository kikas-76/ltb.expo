import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

export interface SheetOption {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title?: string;
  options: SheetOption[];
  onClose: () => void;
}

/** Feuille d'actions (signaler, bloquer…) identique sur iOS, Android et web. */
export default function OptionsSheet({ visible, title, options, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]} onPress={() => {}}>
          <View style={styles.grabber} />
          {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
          {options.map((o) => (
            <TouchableOpacity
              key={o.key}
              style={styles.row}
              activeOpacity={0.75}
              onPress={() => {
                onClose();
                setTimeout(o.onPress, Platform.OS === 'web' ? 0 : 220);
              }}
            >
              <View style={[styles.iconWrap, o.destructive && styles.iconWrapDestructive]}>
                <Ionicons name={o.icon} size={18} color={o.destructive ? Colors.error : Colors.primaryDark} />
              </View>
              <Text style={[styles.label, o.destructive && styles.labelDestructive]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancel} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,20,20,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingTop: 8, gap: 4, maxWidth: 560, width: '100%', alignSelf: 'center',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D9D5C8', marginBottom: 8 },
  title: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 6 },
  iconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  iconWrapDestructive: { backgroundColor: Colors.errorLight },
  label: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.text },
  labelDestructive: { color: Colors.error },
  cancel: { marginTop: 6, paddingVertical: 13, borderRadius: 999, backgroundColor: Colors.background, alignItems: 'center' },
  cancelText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.text },
});
