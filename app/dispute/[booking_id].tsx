import { useState } from 'react';
import { sendEmail } from '@/lib/sendEmail';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BG = '#F5F2E3';
const RED = '#C0392B';
const RED_LIGHT = '#FDF2F2';
const RED_BORDER = '#F5C6CB';

export default function DisputePage() {
  const { booking_id, conversation_id } = useLocalSearchParams<{ booking_id: string; conversation_id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    setError(null);
    try {
      const ext = (asset.uri.split('.').pop() ?? 'jpg').split('?')[0].toLowerCase();
      const path = `disputes/${booking_id}/${Date.now()}.${ext}`;

      if (Platform.OS === 'web') {
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        const { error: upErr } = await supabase.storage
          .from('listing-photos')
          .upload(path, blob, { contentType: `image/${ext}` });
        if (upErr) throw upErr;
      } else {
        const formData = new FormData();
        formData.append('file', { uri: asset.uri, name: `photo.${ext}`, type: `image/${ext}` } as any);
        const { error: upErr } = await supabase.storage
          .from('listing-photos')
          .upload(path, formData);
        if (upErr) throw upErr;
      }

      const { data: urlData } = supabase.storage.from('listing-photos').getPublicUrl(path);
      setPhotos((prev) => [...prev, urlData.publicUrl]);
    } catch (e: any) {
      setError('Erreur lors du chargement de la photo.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Veuillez décrire le problème.');
      return;
    }
    if (!user || !booking_id) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: insertErr } = await supabase.from('disputes').insert({
        booking_id,
        conversation_id: conversation_id ?? null,
        reporter_id: user.id,
        description: description.trim(),
        photo_urls: photos,
        status: 'open',
      });
      if (insertErr) throw insertErr;

      await supabase.from('bookings').update({ status: 'disputed' }).eq('id', booking_id);

      const { data: bookingData } = await supabase
        .from('bookings')
        .select('stripe_payment_intent_id')
        .eq('id', booking_id)
        .maybeSingle();

      if (bookingData?.stripe_payment_intent_id) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/manage-deposit`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                action: 'capture',
                booking_id,
                payment_intent_id: bookingData.stripe_payment_intent_id,
              }),
            }
          );
        }
      }

      if (conversation_id) {
        await supabase.from('chat_messages').insert({
          conversation_id,
          sender_id: null,
          content: 'Un litige a été ouvert par le propriétaire — La caution reste bloquée jusqu\'à résolution',
          is_system: true,
        });
      }

      const { data: bookingInfo } = await supabase
        .from('bookings')
        .select('renter_id, owner_id, deposit_amount, start_date, end_date, listing:listings(name)')
        .eq('id', booking_id)
        .maybeSingle();

      if (bookingInfo) {
        const disputeData = {
          listing_name: (bookingInfo.listing as any)?.name ?? 'Location',
          start_date: new Date(bookingInfo.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
          end_date: new Date(bookingInfo.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
          deposit: bookingInfo.deposit_amount ?? 0,
          dispute_id: booking_id,
        };
        const { data: renterP } = await supabase.from('profiles').select('email').eq('id', bookingInfo.renter_id).maybeSingle();
        if (renterP?.email) sendEmail(renterP.email, 'dispute_opened', disputeData);
        const { data: ownerP } = await supabase.from('profiles').select('email').eq('id', bookingInfo.owner_id).maybeSingle();
        if (ownerP?.email) sendEmail(ownerP.email, 'dispute_opened', disputeData);
      }

      setSubmitted(true);
    } catch (e: any) {
      setError('Une erreur est survenue. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Litige</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="shield-checkmark" size={40} color={RED} />
          </View>
          <Text style={styles.successTitle}>Litige ouvert</Text>
          <Text style={styles.successSub}>
            Votre litige a été enregistré. La caution reste bloquée jusqu'à résolution. L'emprunteur a été notifié dans la conversation.
          </Text>
          <TouchableOpacity
            style={styles.successBtn}
            activeOpacity={0.85}
            onPress={() => {
              if (conversation_id) {
                router.replace(`/chat/${conversation_id}` as any);
              } else {
                router.back();
              }
            }}
          >
            <Text style={styles.successBtnText}>Retour à la conversation</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Signaler un litige</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.alertBanner}>
          <Ionicons name="warning-outline" size={18} color={RED} />
          <Text style={styles.alertText}>
            En ouvrant un litige, la caution restera bloquée jusqu'à résolution par notre équipe.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Décrivez le problème *</Text>
        <TextInput
          style={styles.textarea}
          value={description}
          onChangeText={setDescription}
          placeholder="Ex : l'objet a été rendu avec une rayure sur le dessus..."
          placeholderTextColor="#aaa"
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <Text style={styles.sectionLabel}>Photos justificatives</Text>
        <Text style={styles.sectionHint}>Joignez des photos pour appuyer votre signalement.</Text>

        <View style={styles.photosGrid}>
          {photos.map((uri, idx) => (
            <View key={uri} style={styles.photoThumbWrap}>
              <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
              <TouchableOpacity
                style={styles.photoRemoveBtn}
                onPress={() => removePhoto(idx)}
              >
                <Ionicons name="close-circle" size={20} color={RED} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={styles.addPhotoBtn}
            activeOpacity={0.8}
            onPress={pickPhoto}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={RED} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={24} color={RED} />
                <Text style={styles.addPhotoText}>Ajouter</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={15} color={RED} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="alert-circle-outline" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Ouvrir le litige</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4D4',
    backgroundColor: BG,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#1A1A1A',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: RED_LIGHT,
    borderWidth: 1,
    borderColor: RED_BORDER,
    borderRadius: 12,
    padding: 14,
  },
  alertText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#7B1010',
    lineHeight: 19,
  },
  sectionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#1A1A1A',
    marginTop: 4,
  },
  sectionHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#888',
    marginTop: -10,
  },
  textarea: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0DDD0',
    padding: 14,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#1A1A1A',
    minHeight: 120,
    lineHeight: 20,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoThumbWrap: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'visible',
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#eee',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: RED_BORDER,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RED_LIGHT,
    gap: 4,
  },
  addPhotoText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: RED,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: RED,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: RED,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
  },
  submitBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: '#fff',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: RED_LIGHT,
    borderWidth: 1,
    borderColor: RED_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  successSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 21,
  },
  successBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 12,
  },
  successBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: '#fff',
  },
});
