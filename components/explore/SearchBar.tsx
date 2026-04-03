import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onPress?: () => void;
}

export default function SearchBar({ value, onChangeText, onPress }: SearchBarProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Rechercher un objet..."
          placeholderTextColor={Colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          returnKeyType="search"
          editable={!onPress}
          onFocus={onPress}
        />
        {onPress && (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={onPress}
            activeOpacity={0.75}
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
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    gap: 10,
  },
  icon: {
    flexShrink: 0,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.text,
    padding: 0,
    margin: 0,
  },
});
