import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Section = 'menu' | 'photo' | 'username' | 'bio' | 'email' | 'phone' | 'password' | 'delete';

function SuccessBanner({ message }: { message: string }) {
  return (
    <View style={styles.successBox}>
      <Ionicons name="checkmark-outline" size={15} color="#5A8C5A" />
      <Text style={styles.successText}>{message}</Text>
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle-outline" size={15} color={Colors.error} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function SectionHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
        <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export default function AccountSettingsScreen() {
  const { profile, user, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>('menu');

  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameSuccess, setUsernameSuccess] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneSuccess, setPhoneSuccess] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [bio, setBio] = useState('');
  const [bioSaving, setBioSaving] = useState(false);
  const [bioSuccess, setBioSuccess] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openSection = (s: Section) => {
    setPhotoSuccess(false); setPhotoError(null);
    setUsernameSuccess(false); setUsernameError(null);
    setBioSuccess(false); setBioError(null);
    setEmailSuccess(false); setEmailError(null);
    setPhoneSuccess(false); setPhoneError(null);
    setPasswordSuccess(false); setPasswordError(null);
    setDeleteError(null); setDeleteConfirm('');
    if (s === 'username') setUsername(profile?.username ?? '');
    if (s === 'bio') setBio(profile?.bio ?? '');
    if (s === 'email') setEmail(profile?.email ?? user?.email ?? '');
    if (s === 'phone') setPhone(profile?.phone_number ?? '');
    if (s === 'password') {
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    }
    setSection(s);
  };

  const handleSaveBio = async () => {
    const trimmed = bio.trim();
    if (trimmed.length > 300) {
      setBioError('La bio ne peut pas dépasser 300 caractères.');
      return;
    }
    setBioSaving(true);
    setBioError(null);
    const { error } = await supabase.from('profiles').update({ bio: trimmed || null }).eq('id', user!.id);
    setBioSaving(false);
    if (error) { setBioError('Une erreur est survenue.'); return; }
    await refreshProfile();
    setBioSuccess(true);
    setTimeout(() => setSection('menu'), 1200);
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setPhotoError("Permission d'accès à la galerie refusée.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPhotoLoading(true);
    setPhotoError(null);
    setPhotoSuccess(false);
    try {
      const uriParts = asset.uri.split('.');
      const ext = uriParts[uriParts.length - 1]?.toLowerCase().split('?')[0] ?? 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const fileName = `${user!.id}/avatar_${Date.now()}.${ext}`;
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, { contentType: mimeType, upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const photoUrl = urlData.publicUrl;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo_url: photoUrl })
        .eq('id', user!.id);
      if (updateError) throw updateError;
      await refreshProfile();
      setPhotoSuccess(true);
    } catch (e: any) {
      setPhotoError("Erreur lors de l'upload de la photo.");
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoLoading(true);
    setPhotoError(null);
    setPhotoSuccess(false);
    const { error } = await supabase
      .from('profiles')
      .update({ photo_url: null })
      .eq('id', user!.id);
    if (error) {
      setPhotoError('Erreur lors de la suppression.');
    } else {
      await refreshProfile();
      setPhotoSuccess(true);
    }
    setPhotoLoading(false);
  };

  const handleSaveUsername = async () => {
    const trimmed = username.trim();
    if (!trimmed) { setUsernameError("Le nom d'utilisateur ne peut pas être vide."); return; }
    if (!/^[a-zA-Z0-9_]{2,30}$/.test(trimmed)) {
      setUsernameError('2-30 caractères, lettres, chiffres ou _');
      return;
    }
    if (trimmed === profile?.username) { setSection('menu'); return; }
    setUsernameSaving(true);
    setUsernameError(null);
    const { error } = await supabase.from('profiles').update({ username: trimmed }).eq('id', user!.id);
    setUsernameSaving(false);
    if (error) {
      setUsernameError(error.code === '23505' ? 'Ce nom est déjà pris.' : 'Une erreur est survenue.');
      return;
    }
    await refreshProfile();
    setUsernameSuccess(true);
    setTimeout(() => setSection('menu'), 1200);
  };

  const handleSaveEmail = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Veuillez entrer un email valide.');
      return;
    }
    if (trimmed === (profile?.email ?? user?.email ?? '')) { setSection('menu'); return; }
    setEmailSaving(true);
    setEmailError(null);
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    setEmailSaving(false);
    if (error) {
      setEmailError("Erreur : " + error.message);
      return;
    }
    await supabase.from('profiles').update({ email: trimmed }).eq('id', user!.id);
    await refreshProfile();
    setEmailSuccess(true);
    setTimeout(() => setSection('menu'), 1500);
  };

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 10);
    return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  };

  const handleSavePhone = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setPhoneError('Numéro de téléphone invalide.');
      return;
    }
    setPhoneSaving(true);
    setPhoneError(null);
    const { error } = await supabase.from('profiles').update({ phone_number: phone.trim() }).eq('id', user!.id);
    setPhoneSaving(false);
    if (error) { setPhoneError('Une erreur est survenue.'); return; }
    await refreshProfile();
    setPhoneSuccess(true);
    setTimeout(() => setSection('menu'), 1200);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas.');
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile?.email ?? user?.email ?? '',
      password: currentPassword,
    });
    if (signInError) {
      setPasswordError('Mot de passe actuel incorrect.');
      setPasswordSaving(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) { setPasswordError('Erreur : ' + error.message); return; }
    setPasswordSuccess(true);
    setTimeout(() => {
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setSection('menu');
    }, 1400);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'SUPPRIMER') {
      setDeleteError('Veuillez taper SUPPRIMER pour confirmer.');
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await supabase.from('profiles').delete().eq('id', user!.id);
      await supabase.auth.signOut();
      router.replace('/onboarding/welcome');
    } catch {
      setDeleteError('Une erreur est survenue. Contactez le support.');
      setDeleteLoading(false);
    }
  };

  const bioText: string = profile?.bio ?? '';
  const bioPreview = bioText
    ? bioText.slice(0, 50) + (bioText.length > 50 ? '...' : '')
    : 'Ajouter une bio';

  const menuItems = [
    {
      icon: <Ionicons name="camera-outline" size={18} color={Colors.primaryDark} />,
      label: 'Photo de profil',
      value: profile?.photo_url ? 'Modifier' : 'Ajouter',
      preview: undefined as string | undefined,
      onPress: () => openSection('photo'),
    },
    {
      icon: <Ionicons name="at-outline" size={18} color={Colors.primaryDark} />,
      label: "Nom d'utilisateur",
      value: profile?.username ? `@${profile.username}` : '—',
      preview: undefined as string | undefined,
      onPress: () => openSection('username'),
    },
    {
      icon: <Ionicons name="document-text-outline" size={18} color={Colors.primaryDark} />,
      label: 'Bio',
      value: undefined as string | undefined,
      preview: bioPreview,
      onPress: () => openSection('bio'),
    },
    {
      icon: <Ionicons name="mail-outline" size={18} color={Colors.primaryDark} />,
      label: 'Adresse email',
      value: profile?.email ?? user?.email ?? '—',
      preview: undefined as string | undefined,
      onPress: () => openSection('email'),
    },
    {
      icon: <Ionicons name="call-outline" size={18} color={Colors.primaryDark} />,
      label: 'Numéro de téléphone',
      value: profile?.phone_number ?? 'Non renseigné',
      preview: undefined as string | undefined,
      onPress: () => openSection('phone'),
    },
    {
      icon: <Ionicons name="location-outline" size={18} color={Colors.primaryDark} />,
      label: 'Mon adresse',
      value: profile?.location_data?.address ?? 'Non renseignée',
      preview: undefined as string | undefined,
      onPress: () => router.push('/edit-address'),
    },
    {
      icon: <Ionicons name="lock-closed-outline" size={18} color={Colors.primaryDark} />,
      label: 'Mot de passe',
      value: '••••••••',
      preview: undefined as string | undefined,
      onPress: () => openSection('password'),
    },
  ];

  if (section === 'photo') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <SectionHeader onBack={() => setSection('menu')} title="Photo de profil" />
        <ScrollView contentContainerStyle={styles.sectionBody} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarCenter}>
            <View style={styles.avatarRingLarge}>
              {profile?.photo_url ? (
                <Image source={{ uri: profile.photo_url }} style={styles.avatarImgLarge} />
              ) : (
                <View style={styles.avatarPlaceholderLarge}>
                  <Ionicons name="person-outline" size={48} color={Colors.primaryDark} />
                </View>
              )}
            </View>
          </View>

          {photoSuccess && <SuccessBanner message="Photo mise à jour avec succès !" />}
          {photoError && <ErrorBanner message={photoError} />}

          <TouchableOpacity
            style={[styles.btnPrimary, photoLoading && { opacity: 0.65 }]}
            onPress={handlePickPhoto}
            disabled={photoLoading}
            activeOpacity={0.85}
          >
            {photoLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="camera-outline" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>
                  {profile?.photo_url ? 'Changer la photo' : 'Choisir une photo'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {profile?.photo_url && (
            <TouchableOpacity
              style={[styles.btnDanger, photoLoading && { opacity: 0.65 }]}
              onPress={handleRemovePhoto}
              disabled={photoLoading}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
              <Text style={styles.btnDangerText}>Supprimer la photo</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }

  if (section === 'username') {
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ paddingTop: insets.top }}>
          <SectionHeader onBack={() => setSection('menu')} title="Nom d'utilisateur" />
        </View>
        <ScrollView contentContainerStyle={styles.sectionBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.fieldDescription}>
            Votre nom d'utilisateur est visible par les autres membres. 2 à 30 caractères, lettres, chiffres et _.
          </Text>
          {usernameSuccess && <SuccessBanner message="Nom d'utilisateur mis à jour !" />}
          {usernameError && <ErrorBanner message={usernameError} />}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nom d'utilisateur</Text>
            <View style={styles.inputRow}>
              <Ionicons name="at-outline" size={17} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="votre_pseudo"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
              />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btnPrimary, usernameSaving && { opacity: 0.65 }]}
            onPress={handleSaveUsername}
            disabled={usernameSaving}
            activeOpacity={0.85}
          >
            {usernameSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Enregistrer</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (section === 'bio') {
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ paddingTop: insets.top }}>
          <SectionHeader onBack={() => setSection('menu')} title="Bio" />
        </View>
        <ScrollView contentContainerStyle={styles.sectionBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.fieldDescription}>
            Présentez-vous en quelques mots. Votre bio est visible sur votre profil public (300 caractères max).
          </Text>
          {bioSuccess && <SuccessBanner message="Bio mise à jour !" />}
          {bioError && <ErrorBanner message={bioError} />}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Votre bio</Text>
            <View style={styles.textAreaRow}>
              <TextInput
                style={styles.textArea}
                value={bio}
                onChangeText={setBio}
                placeholder="Ex : Passionné de bricolage, je loue mes outils avec soin..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={5}
                maxLength={300}
                textAlignVertical="top"
              />
            </View>
            <Text style={styles.charCount}>{bio.trim().length}/300</Text>
          </View>
          <TouchableOpacity
            style={[styles.btnPrimary, bioSaving && { opacity: 0.65 }]}
            onPress={handleSaveBio}
            disabled={bioSaving}
            activeOpacity={0.85}
          >
            {bioSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Enregistrer</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (section === 'email') {
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ paddingTop: insets.top }}>
          <SectionHeader onBack={() => setSection('menu')} title="Adresse email" />
        </View>
        <ScrollView contentContainerStyle={styles.sectionBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.fieldDescription}>
            Un email de confirmation sera envoyé à la nouvelle adresse.
          </Text>
          {emailSuccess && <SuccessBanner message="Email mis à jour ! Vérifiez votre boîte mail." />}
          {emailError && <ErrorBanner message={emailError} />}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nouvelle adresse email</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={17} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="exemple@email.com"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btnPrimary, emailSaving && { opacity: 0.65 }]}
            onPress={handleSaveEmail}
            disabled={emailSaving}
            activeOpacity={0.85}
          >
            {emailSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Enregistrer</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (section === 'phone') {
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ paddingTop: insets.top }}>
          <SectionHeader onBack={() => setSection('menu')} title="Numéro de téléphone" />
        </View>
        <ScrollView contentContainerStyle={styles.sectionBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.fieldDescription}>
            Votre numéro est utilisé pour faciliter les échanges. Il n'est pas visible publiquement.
          </Text>
          {phoneSuccess && <SuccessBanner message="Numéro mis à jour !" />}
          {phoneError && <ErrorBanner message={phoneError} />}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Numéro de téléphone</Text>
            <View style={styles.inputRow}>
              <Ionicons name="call-outline" size={17} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(v) => setPhone(formatPhone(v))}
                placeholder="06 12 34 56 78"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                maxLength={14}
              />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btnPrimary, phoneSaving && { opacity: 0.65 }]}
            onPress={handleSavePhone}
            disabled={phoneSaving}
            activeOpacity={0.85}
          >
            {phoneSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Enregistrer</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (section === 'password') {
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ paddingTop: insets.top }}>
          <SectionHeader onBack={() => setSection('menu')} title="Mot de passe" />
        </View>
        <ScrollView contentContainerStyle={styles.sectionBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.fieldDescription}>
            Choisissez un mot de passe fort d'au moins 8 caractères.
          </Text>
          {passwordSuccess && <SuccessBanner message="Mot de passe modifié avec succès !" />}
          {passwordError && <ErrorBanner message={passwordError} />}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Mot de passe actuel</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={17} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showCurrentPw}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowCurrentPw(!showCurrentPw)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {showCurrentPw ? <Ionicons name="eye-off-outline" size={17} color={Colors.textMuted} /> : <Ionicons name="eye-outline" size={17} color={Colors.textMuted} />}
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nouveau mot de passe</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={17} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showNewPw}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowNewPw(!showNewPw)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {showNewPw ? <Ionicons name="eye-off-outline" size={17} color={Colors.textMuted} /> : <Ionicons name="eye-outline" size={17} color={Colors.textMuted} />}
              </TouchableOpacity>
            </View>
            {newPassword.length > 0 && (
              <View style={styles.strengthRow}>
                {[1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor:
                          newPassword.length >= i * 3
                            ? newPassword.length >= 12
                              ? '#5A8C5A'
                              : newPassword.length >= 8
                              ? Colors.primaryDark
                              : '#D4A843'
                            : Colors.borderLight,
                      },
                    ]}
                  />
                ))}
                <Text style={styles.strengthLabel}>
                  {newPassword.length < 6 ? 'Faible' : newPassword.length < 8 ? 'Moyen' : newPassword.length < 12 ? 'Fort' : 'Très fort'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirmer le nouveau mot de passe</Text>
            <View style={[styles.inputRow, confirmPassword.length > 0 && newPassword !== confirmPassword && styles.inputRowError]}>
              <Ionicons name="lock-closed-outline" size={17} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showConfirmPw}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirmPw(!showConfirmPw)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {showConfirmPw ? <Ionicons name="eye-off-outline" size={17} color={Colors.textMuted} /> : <Ionicons name="eye-outline" size={17} color={Colors.textMuted} />}
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btnPrimary, passwordSaving && { opacity: 0.65 }]}
            onPress={handleChangePassword}
            disabled={passwordSaving}
            activeOpacity={0.85}
          >
            {passwordSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Modifier le mot de passe</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (section === 'delete') {
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ paddingTop: insets.top }}>
          <SectionHeader onBack={() => setSection('menu')} title="Supprimer le compte" />
        </View>
        <ScrollView contentContainerStyle={styles.sectionBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.deleteWarning}>
            <Ionicons name="alert-circle-outline" size={28} color={Colors.error} />
            <Text style={styles.deleteWarningTitle}>Action irréversible</Text>
            <Text style={styles.deleteWarningText}>
              La suppression de votre compte effacera définitivement toutes vos données, annonces et messages. Cette action ne peut pas être annulée.
            </Text>
          </View>
          {deleteError && <ErrorBanner message={deleteError} />}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tapez <Text style={{ fontFamily: 'Inter-Bold', color: Colors.error }}>SUPPRIMER</Text> pour confirmer</Text>
            <View style={[styles.inputRow, styles.inputRowError]}>
              <TextInput
                style={styles.input}
                value={deleteConfirm}
                onChangeText={setDeleteConfirm}
                placeholder="SUPPRIMER"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btnDeleteFinal, deleteLoading && { opacity: 0.65 }]}
            onPress={handleDeleteAccount}
            disabled={deleteLoading}
            activeOpacity={0.85}
          >
            {deleteLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={styles.btnDeleteFinalText}>Supprimer définitivement</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Paramètres du compte</Text>
      </View>

      <ScrollView contentContainerStyle={styles.menuScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSummary}>
          <View style={styles.avatarRingSmall}>
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.avatarImgSmall} />
            ) : (
              <View style={styles.avatarPlaceholderSmall}>
                <Ionicons name="person-outline" size={26} color={Colors.primaryDark} />
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>@{profile?.username ?? 'utilisateur'}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{profile?.email ?? user?.email ?? ''}</Text>
          </View>
        </View>

        <Text style={styles.menuSectionLabel}>Informations personnelles</Text>
        <View style={styles.menuCard}>
          {menuItems.map((item, i) => (
            <View key={item.label}>
              <TouchableOpacity style={styles.menuRow} onPress={item.onPress} activeOpacity={0.7}>
                <View style={styles.menuIconWrap}>{item.icon}</View>
                <View style={styles.menuRowContent}>
                  <Text style={styles.menuRowLabel}>{item.label}</Text>
                  {item.preview !== undefined ? (
                    <Text style={[styles.menuRowValue, !bioText && styles.menuRowValueEmpty]} numberOfLines={1}>{item.preview}</Text>
                  ) : (
                    <Text style={styles.menuRowValue} numberOfLines={1}>{item.value}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward-outline" size={15} color={Colors.textMuted} />
              </TouchableOpacity>
              {i < menuItems.length - 1 && <View style={styles.menuDivider} />}
            </View>
          ))}
        </View>

        <Text style={styles.menuSectionLabel}>Zone de danger</Text>
        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuRow} onPress={() => openSection('delete')} activeOpacity={0.7}>
            <View style={[styles.menuIconWrap, styles.menuIconDanger]}>
              <Ionicons name="trash-outline" size={18} color={Colors.error} />
            </View>
            <View style={styles.menuRowContent}>
              <Text style={[styles.menuRowLabel, { color: Colors.error }]}>Supprimer mon compte</Text>
              <Text style={styles.menuRowValue}>Cette action est irréversible</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={15} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  sectionBody: {
    padding: 20,
    gap: 16,
  },
  menuScroll: {
    padding: 20,
    paddingBottom: 48,
    gap: 8,
  },
  profileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    }),
  },
  avatarRingSmall: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Colors.primary,
    padding: 2,
  },
  avatarImgSmall: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  avatarPlaceholderSmall: {
    flex: 1,
    borderRadius: 26,
    backgroundColor: Colors.primaryLight + '50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  profileEmail: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  menuSectionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 8,
  },
  menuCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    }),
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight + '40',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuIconDanger: {
    backgroundColor: Colors.errorLight,
  },
  menuRowContent: {
    flex: 1,
    gap: 2,
  },
  menuRowLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  menuRowValue: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  menuRowValueEmpty: {
    fontStyle: 'italic',
    opacity: 0.6,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 62,
  },
  fieldDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
    marginLeft: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    height: 52,
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
    }),
  },
  inputRowError: {
    borderColor: Colors.error + '60',
  },
  textAreaRow: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 130,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
    }),
  },
  textArea: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.text,
    minHeight: 100,
    lineHeight: 22,
  },
  charCount: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
    marginRight: 2,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.text,
    height: '100%',
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  strengthBar: {
    height: 4,
    flex: 1,
    borderRadius: 2,
  },
  strengthLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginLeft: 4,
    minWidth: 50,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EBF5EB',
    borderRadius: 12,
    padding: 12,
  },
  successText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#5A8C5A',
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.error,
    flex: 1,
  },
  btnPrimary: {
    backgroundColor: Colors.primaryDark,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 12px rgba(142,152,120,0.35)' },
    }),
  },
  btnPrimaryText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.white,
    letterSpacing: 0.1,
  },
  btnDanger: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.error + '50',
    backgroundColor: Colors.errorLight,
    marginTop: 4,
  },
  btnDangerText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.error,
  },
  avatarCenter: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  avatarRingLarge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2.5,
    borderColor: Colors.primary,
    padding: 3,
  },
  avatarImgLarge: {
    width: '100%',
    height: '100%',
    borderRadius: 52,
  },
  avatarPlaceholderLarge: {
    flex: 1,
    borderRadius: 52,
    backgroundColor: Colors.primaryLight + '50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteWarning: {
    backgroundColor: Colors.errorLight,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  deleteWarningTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.error,
  },
  deleteWarningText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.85,
  },
  btnDeleteFinal: {
    backgroundColor: Colors.error,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  btnDeleteFinalText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.white,
  },
});
