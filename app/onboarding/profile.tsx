import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

const BG = '#F5F0E8';
const GREEN = '#B7BF9C';

function Stepper({ active }: { active: number }) {
  return (
    <View style={styles.stepper}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View key={n} style={[styles.stepDot, active === n && styles.stepDotActive]} />
      ))}
    </View>
  );
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  if (digits.startsWith('33')) {
    const local = digits.slice(2);
    const groups = local.match(/.{1,2}/g) ?? [];
    return '+33 ' + groups.join(' ');
  }

  if (digits.startsWith('0') && digits.length <= 10) {
    const groups = digits.match(/.{1,2}/g) ?? [];
    return groups.join(' ');
  }

  if (digits.length > 10) {
    const cc = '+' + digits.slice(0, digits.length - 9);
    const rest = digits.slice(digits.length - 9);
    const groups = rest.match(/.{1,3}/g) ?? [];
    return cc + ' ' + groups.join(' ');
  }

  return digits;
}


export default function OnboardingProfileScreen() {
  const params = useLocalSearchParams<{
    email: string;
    password: string;
  }>();

  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length === 0) {
      setPhone('');
      return;
    }
    setPhone(formatPhone(digits));
  };

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarUri) return null;

    setAvatarUploading(true);
    try {
      const response = await fetch(avatarUri);
      const blob = await response.blob();
      const ext = avatarUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const path = `${userId}/avatar.${safeExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: `image/${safeExt}` });

      if (uploadError) return null;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return null;
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleContinue = async () => {
    setError(null);
    const cleanUsername = username.trim().toLowerCase().replace(/\s/g, '');
    if (!cleanUsername) {
      setError("Un nom d'utilisateur est obligatoire.");
      return;
    }
    if (cleanUsername.length < 3) {
      setError("Le nom d'utilisateur doit contenir au moins 3 caractères.");
      return;
    }
    if (!/^[a-z0-9_.-]+$/.test(cleanUsername)) {
      setError("Uniquement des lettres, chiffres, _ . ou - sont autorisés.");
      return;
    }

    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existingUser) {
      setError("Ce nom d'utilisateur est déjà pris. Choisis-en un autre.");
      return;
    }

    setSubmitting(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: { username: cleanUsername },
      },
    });

    if (signUpError || !data.user) {
      setSubmitting(false);
      setError(signUpError?.message ?? "Erreur lors de l'inscription.");
      return;
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: params.email,
      password: params.password,
    });

    if (signInError || !signInData.user) {
      setSubmitting(false);
      setError('Compte créé mais connexion échouée. Veuillez vous connecter manuellement.');
      return;
    }

    const userId = signInData.user.id;
    const photoUrl = await uploadAvatar(userId);

    const updates: Record<string, string | null> = {
      username: cleanUsername,
      email: params.email,
      phone_number: phone.trim() || null,
      photo_url: photoUrl,
    };

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (updateError) {
      setSubmitting(false);
      setError('Erreur lors de la mise à jour du profil: ' + updateError.message);
      return;
    }

    setSubmitting(false);
    router.replace({ pathname: '/onboarding/account-type', params: { userId } });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back-outline" size={22} color="#1C1C18" />
          </TouchableOpacity>
          <Image
            source={require('@/assets/images/logoLTBwhitoutbaground.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Stepper active={2} />
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>Complète ton profil</Text>
          <Text style={styles.subtitle}>
            Un dernier détail avant de louer ou prêter en toute confiance
          </Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarCircle} activeOpacity={0.75} onPress={handlePickAvatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="camera-outline" size={30} color={GREEN} />
              )}
            </TouchableOpacity>
            <Text style={styles.avatarLabel}>
              {avatarUri ? (
                <Text style={styles.avatarLabelGreen}>Photo sélectionnée</Text>
              ) : (
                <>
                  Photo de profil{' '}
                  <Text style={styles.avatarLabelGreen}>(recommandée)</Text>
                </>
              )}
            </Text>
            {avatarUri && (
              <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.7}>
                <Text style={styles.changePhotoText}>Changer la photo</Text>
              </TouchableOpacity>
            )}
          </View>

          <View>
            <View style={[styles.inputRow, styles.inputRowUsername]}>
              <Ionicons name="at-outline" size={18} color="#A8A8A0" style={styles.inputIcon} />
              <TextInput
                style={styles.inputFlex}
                placeholder="nom_utilisateur"
                placeholderTextColor="#A8A8A0"
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {username.trim().length >= 3 && (
                <View style={styles.usernameCheckBadge}>
                  <Text style={styles.usernameCheckText}>✓</Text>
                </View>
              )}
            </View>
            <Text style={styles.usernameHint}>
              C'est votre identité visible sur la plateforme. Votre vrai nom n'est jamais partagé.
            </Text>
          </View>

          <View style={styles.inputRow}>
            <Ionicons name="call-outline" size={18} color="#A8A8A0" style={styles.inputIcon} />
            <TextInput
              style={styles.inputFlex}
              placeholder="+33 6 XX XX XX XX"
              placeholderTextColor="#A8A8A0"
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.optionalNote}>
            Le numéro de téléphone facilite la prise de contact avec les autres utilisateurs.
          </Text>

          <TouchableOpacity
            style={[styles.btn, (submitting || avatarUploading) && { opacity: 0.65 }]}
            onPress={handleContinue}
            disabled={submitting || avatarUploading}
            activeOpacity={0.85}
          >
            {submitting || avatarUploading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Continuer</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 8,
    gap: 20,
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    top: 60,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 52,
  },
  stepper: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D5CEBC',
  },
  stepDotActive: {
    width: 28,
    borderRadius: 5,
    backgroundColor: GREEN,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 16,
    maxWidth: 390,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1C1C18',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#7A7A70',
    marginTop: -4,
    lineHeight: 22,
  },
  errorBox: {
    backgroundColor: '#FDECEA',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: '#C0392B',
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: GREEN,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECEEE6',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#7A7A70',
  },
  avatarLabelGreen: {
    color: GREEN,
    fontFamily: 'Inter-Medium',
  },
  changePhotoText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#A8A8A0',
    textDecorationLine: 'underline',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E0D8C8',
    height: 54,
    paddingHorizontal: 22,
    gap: 10,
  },
  inputIcon: {
    flexShrink: 0,
  },
  inputFlex: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1C1C18',
  },
  inputRowUsername: {
    borderColor: '#B7BF9C',
  },
  usernameCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#B7BF9C',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  usernameCheckText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  usernameHint: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#A8A8A0',
    marginTop: 6,
    marginLeft: 4,
    lineHeight: 16,
  },
  optionalNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#A8A8A0',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: -4,
  },
  btn: {
    backgroundColor: GREEN,
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
  },
});
