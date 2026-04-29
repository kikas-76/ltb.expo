import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

export default function AdminScreenFallback() {
  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={Colors.primaryDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
});
