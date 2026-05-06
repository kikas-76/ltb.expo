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
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import ProBadge from '@/components/ProBadge';

const BEIGE = '#f5f2e8';

interface MenuRow {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}

function MenuSection({ rows, isDesktop }: { rows: MenuRow[]; isDesktop?: boolean }) {
  return (
    <View style={[menuStyles.card, isDesktop && menuStyles.cardDesktop]}>
      {rows.map((row, i) => (
        <View key={row.label}>
          <TouchableOpacity
            style={[menuStyles.row, isDesktop && menuStyles.rowDesktop]}
            onPress={row.onPress}
            activeOpacity={0.7}
          >
            <View style={[menuStyles.iconWrap, isDesktop && menuStyles.iconWrapDesktop]}>
              {row.icon}
            </View>
            <Text style={[menuStyles.label, isDesktop && menuStyles.labelDesktop]}>{row.label}</Text>
            <Ionicons name="chevron-forward-outline" size={15} color={Colors.textMuted} />
          </TouchableOpacity>
          {i < rows.length - 1 && <View style={menuStyles.divider} />}
        </View>
      ))}
    </View>
  );
}

export default function ProfilScreen() {
  const { profile, user, refreshProfile, signOut } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

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
      if (error.code === '23505' || error.message?.toLowerCase().includes('unique') || error.message?.toLowerCase().includes('already')) {
        setUsernameError('Ce nom est déjà pris.');
      } else if (error.code === '23514' || error.message?.toLowerCase().includes('check')) {
        setUsernameError('Nom invalide : 2-30 caractères, lettres, chiffres et _ uniquement.');
      } else {
        setUsernameError(error.message ?? 'Une erreur est survenue.');
      }
      return;
    }

    await refreshProfile();
    setEditingUsername(false);
  };

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
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
      icon: <Ionicons name="settings-outline" size={isDesktop ? 20 : 17} color={Colors.primaryDark} />,
      label: 'Paramètres du compte',
      onPress: () => router.push('/account-settings' as any),
    },
    {
      icon: <Ionicons name="pricetag-outline" size={isDesktop ? 20 : 17} color={Colors.primaryDark} />,
      label: 'Mes annonces',
      onPress: () => router.push('/(tabs)/mes-annonces'),
    },
    {
      icon: <Ionicons name="heart-outline" size={isDesktop ? 20 : 17} color={Colors.primaryDark} />,
      label: 'Mes favoris',
      onPress: () => router.push('/favorites' as any),
    },
    {
      icon: <Ionicons name="wallet-outline" size={isDesktop ? 20 : 17} color={Colors.primaryDark} />,
      label: 'Mon portefeuille',
      onPress: () => router.push('/wallet' as any),
    },
  ];

  const supportRows: MenuRow[] = [
    {
      icon: <Ionicons name="flag-outline" size={isDesktop ? 20 : 17} color={Colors.primaryDark} />,
      label: 'Mes signalements',
      onPress: () => router.push('/my-reports' as any),
    },
    {
      icon: <Ionicons name="help-circle-outline" size={isDesktop ? 20 : 17} color={Colors.primaryDark} />,
      label: "Centre d'aide",
      onPress: () => router.push('/help-center' as any),
    },
    {
      icon: <Ionicons name="shield-outline" size={isDesktop ? 20 : 17} color={Colors.primaryDark} />,
      label: 'Informations légales',
      onPress: () => router.push('/legal' as any),
    },
  ];

  const adminRows: MenuRow[] = [
    {
      icon: <Ionicons name="shield-checkmark-outline" size={isDesktop ? 20 : 17} color={Colors.error} />,
      label: 'Administration',
      onPress: () => router.push('/admin' as any),
    },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  if (isDesktop && Platform.OS === 'web') {
    return (
      <View style={desktopStyles.root}>
        <Animated.View style={[desktopStyles.leftCol, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={desktopStyles.avatarSection}>
            <View style={desktopStyles.avatarRing}>
              {profile?.photo_url ? (
                <Image source={{ uri: profile.photo_url }} style={desktopStyles.avatarImg} />
              ) : (
                <View style={desktopStyles.avatarPlaceholder}>
                  <Ionicons name="person-outline" size={42} color={Colors.primaryDark} />
                </View>
              )}
            </View>

            {editingUsername ? (
              <View style={styles.usernameEditRow}>
                <Text style={styles.atSign}>@</Text>
                <TextInput
                  ref={inputRef}
                  style={[styles.usernameInput, { fontSize: 16 }]}
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
                      <Ionicons name="checkmark-outline" size={18} color={Colors.primaryDark} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={cancelEditingUsername} style={styles.iconBtn} activeOpacity={0.7}>
                      <Ionicons name="close-outline" size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={desktopStyles.usernameRow}
                onPress={startEditingUsername}
                activeOpacity={0.7}
              >
                <Text style={desktopStyles.username}>@{profile?.username ?? 'utilisateur'}</Text>
                <Ionicons name="pencil-outline" size={13} color={Colors.textMuted} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            )}

            {usernameError && (
              <Text style={styles.usernameError}>{usernameError}</Text>
            )}

            {memberSince && (
              <View style={desktopStyles.metaRow}>
                <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                <Text style={desktopStyles.metaText}>Membre depuis {memberSince}</Text>
              </View>
            )}

            {profileCity && (
              <View style={desktopStyles.metaRow}>
                <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
                <Text style={desktopStyles.metaText}>{profileCity}</Text>
              </View>
            )}

            {profile?.is_pro && (
              <View style={{ marginTop: 10 }}>
                <ProBadge />
              </View>
            )}

            {user?.id && (
              <TouchableOpacity
                style={desktopStyles.previewLink}
                onPress={() => router.push(`/owner/${user.id}` as any)}
                activeOpacity={0.7}
              >
                <Ionicons name="eye-outline" size={14} color={Colors.primaryDark} />
                <Text style={desktopStyles.previewLinkText}>Voir mon profil public</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.primaryDark} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={desktopStyles.signOutBtn}
            onPress={handleSignOut}
            activeOpacity={0.75}
          >
            <Ionicons name="log-out-outline" size={16} color="#DC2626" />
            <Text style={desktopStyles.signOutText}>Déconnexion</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[desktopStyles.rightCol, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <ScrollView
            contentContainerStyle={desktopStyles.rightScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={desktopStyles.sectionLabel}>VOTRE COMPTE</Text>
            <MenuSection rows={accountRows} isDesktop />
            <Text style={[desktopStyles.sectionLabel, { marginTop: 24 }]}>AIDE</Text>
            <MenuSection rows={supportRows} isDesktop />
            {isAdmin && (
              <>
                <Text style={[desktopStyles.sectionLabel, { marginTop: 24 }]}>ADMINISTRATION</Text>
                <MenuSection rows={adminRows} isDesktop />
              </>
            )}
          </ScrollView>
        </Animated.View>
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
          <View style={styles.header}>
            <View style={styles.avatarRing}>
              {profile?.photo_url ? (
                <Image source={{ uri: profile.photo_url }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person-outline" size={36} color={Colors.primaryDark} />
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
                      <Ionicons name="checkmark-outline" size={18} color={Colors.primaryDark} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={cancelEditingUsername} style={styles.iconBtn} activeOpacity={0.7}>
                      <Ionicons name="close-outline" size={18} color={Colors.textMuted} />
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
                <Text style={styles.displayName}>@{profile?.username ?? 'utilisateur'}</Text>
                <Ionicons name="pencil-outline" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
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
                <Ionicons name="location-outline" size={12} color={Colors.primaryDark} />
                <Text style={styles.cityText}>{profileCity}</Text>
              </View>
            )}

            {user?.id && (
              <TouchableOpacity
                style={styles.previewLink}
                onPress={() => router.push(`/owner/${user.id}` as any)}
                activeOpacity={0.7}
              >
                <Ionicons name="eye-outline" size={14} color={Colors.primaryDark} />
                <Text style={styles.previewLinkText}>Voir mon profil public</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.primaryDark} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.sectionLabel}>Votre compte</Text>
          <MenuSection rows={accountRows} />
          <Text style={styles.sectionLabel}>Aide</Text>
          <MenuSection rows={supportRows} />
          {isAdmin && (
            <>
              <Text style={styles.sectionLabel}>Administration</Text>
              <MenuSection rows={adminRows} />
            </>
          )}
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
            activeOpacity={0.75}
          >
            <Ionicons name="log-out-outline" size={16} color={Colors.white} />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  previewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: Colors.primaryLight + '40',
  },
  previewLinkText: {
    fontFamily: 'Inter-SemiBold',
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
  cardDesktop: {
    borderRadius: 12,
    marginBottom: 0,
    ...Platform.select({
      web: { boxShadow: 'none' },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
  },
  rowDesktop: {
    height: 56,
    paddingHorizontal: 20,
    paddingVertical: 0,
    borderRadius: 12,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
      },
    }),
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDesktop: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  label: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.text,
  },
  labelDesktop: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
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
    backgroundColor: Colors.white,
  },
  leftCol: {
    width: 320,
    backgroundColor: BEIGE,
    paddingHorizontal: 32,
    paddingVertical: 40,
    justifyContent: 'space-between',
    borderRightWidth: 1,
    borderRightColor: '#f0ede3',
  },
  avatarSection: {
    alignItems: 'center',
    flex: 1,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2.5,
    borderColor: Colors.primary,
    padding: 3,
    marginBottom: 16,
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(142,152,120,0.2)' },
    }),
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
  },
  avatarPlaceholder: {
    flex: 1,
    borderRadius: 46,
    backgroundColor: Colors.primaryLight + '50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  username: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#2f3a2f',
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  metaText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  previewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: Colors.primaryLight + '40',
  },
  previewLinkText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.primaryDark,
  },
  signOutBtn: {
    borderWidth: 1.5,
    borderColor: '#DC2626',
    borderRadius: 999,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 'auto' as any,
    ...Platform.select({
      web: { cursor: 'pointer', transition: 'background-color 0.15s ease' },
    }),
  },
  signOutText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#DC2626',
    letterSpacing: 0.1,
  },
  rightCol: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  rightScroll: {
    paddingHorizontal: 48,
    paddingVertical: 40,
    maxWidth: 680,
  },
  sectionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginLeft: 4,
  },
});
