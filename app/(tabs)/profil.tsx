import { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { User, Settings, Tag, Heart, Circle as HelpCircle, Shield, ChevronRight, LogOut, Pencil, Check, X, Wallet, MapPin } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import ProBadge from '@/components/ProBadge';
import { useResponsive } from '@/hooks/useResponsive';

interface MenuRow {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}

function MenuSection({ rows }: { rows: MenuRow[] }) {
  return (
    <View style={menuStyles.card}>
      {rows.map((row, i) => (
        <View key={row.label}>
          <TouchableOpacity style={menuStyles.row} onPress={row.onPress} activeOpacity={0.7}>
            <View style={menuStyles.iconWrap}>{row.icon}</View>
            <Text style={menuStyles.label}>{row.label}</Text>
            <ChevronRight size={15} color={Colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
          {i < rows.length - 1 && <View style={menuStyles.divider} />}
        </View>
      ))}
    </View>
  );
}

export default function ProfilScreen() {
  const { profile, user, refreshProfile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameValue, setUsernameValue] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  const startEditingUsername = () => {
    setUsernameValue(profile?.username ?? '');
    setUsernameError(null);
    setEditingUsername(true);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const cancelEditingUsername = () => {
    setEditingUsername(false);
    setUsernameError(null);
  };

  const saveUsername = async () => {
    const trimmed = usernameValue.trim();
    if (!trimmed) {
      setUsernameError("Le nom d'utilisateur ne peut pas être vide.");
      return;
    }
    if (trimmed === profile?.username) {
      setEditingUsername(false);
      return;
    }
    if (!/^[a-zA-Z0-9_]{2,30}$/.test(trimmed)) {
      setUsernameError('2-30 caractères, lettres, chiffres ou _');
      return;
    }

    setSavingUsername(true);
    setUsernameError(null);

    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('id', user!.id);

    setSavingUsername(false);

    if (error) {
      if (error.code === '23505') {
        setUsernameError('Ce nom est déjà pris.');
      } else {
        setUsernameError('Une erreur est survenue.');
      }
      return;
    }

    await refreshProfile();
    setEditingUsername(false);
  };

  const memberSince = profile
    ? new Date().getFullYear().toString()
    : null;

  const profileCity = (() => {
    const address = profile?.location_data?.address;
    if (!address) return null;
    const parts = address.split(',');
    if (parts.length >= 2) {
      const cityPart = parts[parts.length - 2].trim();
      const match = cityPart.match(/^\d{4,6}\s+(.+)$/);
      if (match) return match[1].trim();
      return cityPart;
    }
    return null;
  })();

  const accountRows: MenuRow[] = [
    {
      icon: <Settings size={17} color={Colors.primaryDark} strokeWidth={2} />,
      label: 'Paramètres du compte',
      onPress: () => router.push('/account-settings' as any),
    },
    {
      icon: <Tag size={17} color={Colors.primaryDark} strokeWidth={2} />,
      label: 'Mes annonces',
      onPress: () => router.push('/(tabs)/mes-annonces'),
    },
    {
      icon: <Heart size={17} color={Colors.primaryDark} strokeWidth={2} />,
      label: 'Mes favoris',
      onPress: () => router.push('/favorites' as any),
    },
    {
      icon: <Wallet size={17} color={Colors.primaryDark} strokeWidth={2} />,
      label: 'Mon portefeuille',
      onPress: () => router.push('/wallet' as any),
    },
  ];

  const supportRows: MenuRow[] = [
    {
      icon: <HelpCircle size={17} color={Colors.primaryDark} strokeWidth={2} />,
      label: "Centre d'aide",
      onPress: () => router.push('/help-center' as any),
    },
    {
      icon: <Shield size={17} color={Colors.primaryDark} strokeWidth={2} />,
      label: 'Informations légales',
      onPress: () => router.push('/legal' as any),
    },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.replace('/onboarding/welcome');
  };

  const avatarSection = (
    <View style={[styles.header, isDesktop && desktopStyles.headerDesktop]}>
      <View style={[styles.avatarRing, isDesktop && desktopStyles.avatarRingDesktop]}>
        {profile?.photo_url ? (
          <Image source={{ uri: profile.photo_url }} style={styles.avatarImg} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <User size={isDesktop ? 48 : 36} color={Colors.primaryDark} strokeWidth={1.5} />
          </View>
        )}
      </View>

      {editingUsername ? (
        <View style={styles.usernameEditRow}>
          <Text style={styles.atSign}>@</Text>
          <TextInput
            ref={inputRef}
            style={styles.usernameInput}
            value={usernameValue}
            onChangeText={setUsernameValue}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
            returnKeyType="done"
            onSubmitEditing={saveUsername}
          />
          {savingUsername ? (
            <ActivityIndicator size="small" color={Colors.primaryDark} style={{ marginLeft: 6 }} />
          ) : (
            <>
              <TouchableOpacity onPress={saveUsername} style={styles.iconBtn} activeOpacity={0.7}>
                <Check size={18} color={Colors.primaryDark} strokeWidth={2.5} />
              </TouchableOpacity>
              <TouchableOpacity onPress={cancelEditingUsername} style={styles.iconBtn} activeOpacity={0.7}>
                <X size={18} color={Colors.textMuted} strokeWidth={2.5} />
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.usernameRow}
          onPress={startEditingUsername}
          activeOpacity={0.7}
        >
          <Text style={[styles.displayName, isDesktop && { fontSize: 26 }]}>
            @{profile?.username ?? 'utilisateur'}
          </Text>
          <Pencil size={14} color={Colors.textMuted} strokeWidth={2} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      )}

      {usernameError && (
        <Text style={styles.usernameError}>{usernameError}</Text>
      )}

      {memberSince && (
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Membre depuis {memberSince}</Text>
          </View>
          {profile?.is_pro && <ProBadge />}
        </View>
      )}

      {profileCity && (
        <View style={styles.cityRow}>
          <MapPin size={12} color={Colors.primaryDark} strokeWidth={2.5} />
          <Text style={styles.cityText}>{profileCity}</Text>
        </View>
      )}
    </View>
  );

  if (isDesktop && Platform.OS === 'web') {
    return (
      <View style={[desktopStyles.root, { backgroundColor: Colors.background }]}>
        <View style={desktopStyles.leftCol}>
          <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }, { flex: 1 }]}>
            <ScrollView
              contentContainerStyle={desktopStyles.leftScroll}
              showsVerticalScrollIndicator={false}
            >
              {avatarSection}
              <TouchableOpacity
                style={styles.signOutBtn}
                onPress={handleSignOut}
                activeOpacity={0.75}
              >
                <LogOut size={16} color={Colors.white} strokeWidth={2.5} />
                <Text style={styles.signOutText}>Déconnexion</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
        <View style={desktopStyles.rightCol}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], flex: 1 }}>
            <ScrollView
              contentContainerStyle={desktopStyles.rightScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={desktopStyles.sectionTitle}>Votre compte</Text>
              <MenuSection rows={accountRows} />
              <Text style={desktopStyles.sectionTitle}>Aide</Text>
              <MenuSection rows={supportRows} />
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {avatarSection}
          <Text style={styles.sectionLabel}>Votre compte</Text>
          <MenuSection rows={accountRows} />
          <Text style={styles.sectionLabel}>Aide</Text>
          <MenuSection rows={supportRows} />
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
            activeOpacity={0.75}
          >
            <LogOut size={16} color={Colors.white} strokeWidth={2.5} />
            <Text style={styles.signOutText}>Déconnexion</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: Colors.primary,
    padding: 3,
    marginBottom: 14,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  avatarPlaceholder: {
    flex: 1,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight + '50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayName: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  usernameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    gap: 2,
    ...Platform.select({
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(183,191,156,0.25)' },
    }),
  },
  atSign: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.primaryDark,
    marginRight: 2,
  },
  usernameInput: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.text,
    minWidth: 80,
    maxWidth: 180,
    padding: 0,
    letterSpacing: -0.3,
  },
  iconBtn: {
    padding: 4,
    marginLeft: 2,
  },
  usernameError: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.error,
    marginTop: 6,
    textAlign: 'center',
  },
  badgeRow: {
    marginTop: 6,
  },
  badge: {
    backgroundColor: Colors.primaryLight + '60',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.primaryDark,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  cityText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.primaryDark,
  },
  sectionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  signOutBtn: {
    marginTop: 32,
    backgroundColor: Colors.text,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    ...Platform.select({
      ios: { shadowColor: Colors.text, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10 },
      android: { elevation: 6 },
      web: { boxShadow: '0 4px 12px rgba(44,44,44,0.2)' },
    }),
  },
  signOutText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.white,
    letterSpacing: 0.2,
  },
});

const menuStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 64,
  },
});

const desktopStyles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  leftCol: {
    width: 300,
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  leftScroll: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  rightCol: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  rightScroll: {
    paddingHorizontal: 48,
    paddingTop: 48,
    paddingBottom: 48,
    maxWidth: 700,
  },
  headerDesktop: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarRingDesktop: {
    width: 112,
    height: 112,
    borderRadius: 56,
    padding: 4,
    marginBottom: 18,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
});
