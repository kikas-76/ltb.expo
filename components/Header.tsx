import { View, Image, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

export default function Header() {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/logoLTBwhitoutbaground.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 52,
    paddingBottom: 10,
    paddingHorizontal: 20,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  logo: {
    width: 130,
    height: 32,
  },
});
