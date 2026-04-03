import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SnackbarProps {
  visible: boolean;
  message: string;
  type?: 'favorite' | 'unfavorite' | 'share';
  onHide: () => void;
}

export default function Snackbar({ visible, message, type = 'favorite', onHide }: SnackbarProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 20, duration: 220, useNativeDriver: true }),
          ]).start(onHide);
        }, 2800);
      });
    }
  }, [visible]);

  if (!visible) return null;

  const isShare = type === 'share';

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
      {isShare ? (
        <Ionicons name="link-outline" size={15} color="#B7BF9C" />
      ) : (
        <Ionicons name={type === 'favorite' ? 'heart' : 'heart-outline'} size={15} color="#E05252" />
      )}
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 110 : 90,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2C2C2C',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12 },
      android: { elevation: 8 },
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.18)' },
    }),
    zIndex: 9999,
  },
  text: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },
});
