import { TouchableOpacity, Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

interface GoogleButtonProps {
  onPress: () => void;
  loading?: boolean;
}

export default function GoogleButton({ onPress, loading = false }: GoogleButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.btn, loading && { opacity: 0.65 }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={Colors.text} />
      ) : (
        <>
          <View style={styles.googleIcon}>
            <Text style={styles.googleIconText}>G</Text>
          </View>
          <Text style={styles.btnText}>Continuer avec Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: 54,
    gap: 10,
  },
  googleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  googleIconText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#4285F4',
    lineHeight: 17,
  },
  btnText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
    letterSpacing: 0.1,
  },
});
