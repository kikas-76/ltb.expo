import { View, TextInput, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onPress?: () => void;
  placeholder?: string;
  /** Grande barre « héros » de l'accueil. */
  prominent?: boolean;
}

/**
 * Barre de recherche. En mode prominent (accueil), c'est l'élément principal
 * de l'écran : pilule haute, ombre douce, bouton loupe vert plein.
 */
export default function SearchBar({ value, onChangeText, onPress, placeholder, prominent }: SearchBarProps) {
  return (
    <View style={[styles.wrapper, prominent && styles.wrapperProminent]}>
      <View style={[styles.container, prominent && styles.containerProminent]}>
        {!prominent && <Ionicons name="search-outline" size={18} color={Colors.textMuted} />}
        <TextInput
          style={[styles.input, prominent && styles.inputProminent]}
          placeholder={placeholder ?? (prominent ? 'Que voulez-vous louer ?' : 'Rechercher un objet...')}
          placeholderTextColor={prominent ? '#8E8C80' : Colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          returnKeyType="search"
          editable={!onPress}
          onFocus={onPress}
        />
        {prominent && (
          <View style={styles.searchBtn}>
            <Ionicons name="search" size={18} color={Colors.white} />
          </View>
        )}
        {onPress && (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={onPress}
            activeOpacity={0.85}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  wrapperProminent: {
    paddingTop: 10,
    paddingBottom: 6,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 3 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.07)' },
    }),
  },
  containerProminent: {
    paddingLeft: 22,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#E7E3D5',
    ...Platform.select({
      ios: { shadowColor: '#3B3A30', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14 },
      android: { elevation: 5 },
      web: { boxShadow: '0 6px 14px rgba(59,58,48,0.10)' },
    }),
  },
  input: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.text,
    padding: 0,
    margin: 0,
  },
  inputProminent: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    paddingVertical: 10,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
