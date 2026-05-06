import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import RatingStars from './RatingStars';

interface ExistingReview {
  rating: number;
  comment: string | null;
  created_at: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  // What the renter is rating (the listing/owner side) vs the owner is
  // rating (the renter side) — only changes the title/copy.
  reviewedSide: 'owner' | 'renter';
  reviewedUsername?: string | null;
  // Pre-fill when the user is editing an existing review (still inside
  // the 7-day window). When null, the modal acts as create mode.
  existing?: ExistingReview | null;
  onSubmitted?: (review: { rating: number; comment: string | null }) => void;
}

const MAX_COMMENT = 1000;

export default function ReviewModal({
  visible,
  onClose,
  bookingId,
  reviewedSide,
  reviewedUsername,
  existing,
  onSubmitted,
}: Props) {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  useEffect(() => {
    if (visible) {
      setRating(existing?.rating ?? 0);
      setComment(existing?.comment ?? '');
      setError(null);
      setSubmitting(false);
    }
  }, [visible, existing]);

  const close = () => {
    if (submitting) return;
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) {
      setError('Choisis une note entre 1 et 5 étoiles.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('submit_review', {
      p_booking_id: bookingId,
      p_rating: rating,
      p_comment: comment.trim() || null,
    });

    if (rpcError) {
      // The RPC raises French-language messages we can pass through
      // verbatim. Generic fallback if it's something else.
      const raw = rpcError.message ?? '';
      setError(
        raw.includes('terminée') ||
        raw.includes('participant') ||
        raw.includes('verrouillée') ||
        raw.includes('1 et 5')
          ? raw
          : 'Envoi impossible. Réessaie dans un instant.',
      );
      setSubmitting(false);
      return;
    }

    // Notify the reviewed user. Fire-and-forget — review is already
    // saved, the email is best-effort.
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/chat-notify`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ event: 'review_received', booking_id: bookingId }),
          }
        ).catch((e) => console.error('chat-notify review_received failed:', e));
      }
    } catch {
      // ignore — notification failure shouldn't block the UI
    }

    onSubmitted?.({
      rating: data?.rating ?? rating,
      comment: data?.comment ?? null,
    });
    setSubmitting(false);
    onClose();
  };

  const subjectLabel = reviewedSide === 'owner'
    ? `${reviewedUsername ? `@${reviewedUsername}` : 'le propriétaire'} et l'objet`
    : `${reviewedUsername ? `@${reviewedUsername}` : 'le locataire'}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={[styles.overlay, isDesktop && styles.overlayDesktop]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={close} />
        <View style={[styles.sheet, isDesktop && styles.sheetDesktop]}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {existing ? 'Modifier ma note' : 'Note ta location'}
            </Text>
            <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-outline" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Quelle expérience as-tu eu avec {subjectLabel} ?
          </Text>

          <View style={styles.starsBlock}>
            <RatingStars value={rating} onChange={setRating} size={36} />
            <Text style={styles.starsHint}>
              {rating === 0
                ? 'Tape sur une étoile'
                : rating === 5
                  ? 'Excellent'
                  : rating === 4
                    ? 'Très bien'
                    : rating === 3
                      ? 'Correct'
                      : rating === 2
                        ? 'Décevant'
                        : 'Mauvaise expérience'}
            </Text>
          </View>

          <View style={styles.commentBlock}>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Un commentaire (optionnel) — qu'est-ce qui s'est bien ou moins bien passé ?"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              maxLength={MAX_COMMENT}
              textAlignVertical="top"
              style={styles.textArea}
            />
            <Text style={styles.counter}>{comment.length}/{MAX_COMMENT}</Text>
          </View>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          {existing && (
            <Text style={styles.editHint}>
              Tu peux éditer ta note pendant 7 jours après l'avoir publiée.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, (submitting || rating < 1) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting || rating < 1}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {existing ? 'Mettre à jour ma note' : 'Publier mon avis'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  sheet: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 16,
  },
  sheetDesktop: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 22,
    paddingBottom: 24,
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  starsBlock: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  starsHint: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.textMuted,
  },
  commentBlock: { gap: 4 },
  textArea: {
    minHeight: 96,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.text,
  },
  counter: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'right',
  },
  errorText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#C0392B',
    textAlign: 'center',
  },
  editHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: Colors.primaryDark,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.55 },
  submitBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.2,
  },
});
