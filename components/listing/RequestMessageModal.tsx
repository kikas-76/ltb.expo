import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

const SURFACE = '#FFFFFF';
const TEXT = '#1C2018';
const TEXT_SUB = '#6B6B6B';
const BORDER = '#E2DED0';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (message: string) => void;
  listingTitle: string;
  listingThumb: string | null;
  ownerUsername: string;
  ownerAvatarUrl: string | null;
  startDate: Date;
  endDate: Date;
  days: number;
  totalPrice: number;
  sending: boolean;
}

function formatShort(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatFull(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function RequestMessageModal({
  visible,
  onClose,
  onConfirm,
  listingTitle,
  listingThumb,
  ownerUsername,
  ownerAvatarUrl,
  startDate,
  endDate,
  days,
  totalPrice,
  sending,
}: Props) {
  const slideAnim = useRef(new Animated.Value(700)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  const defaultMessage = `Bonjour ${ownerUsername}, je souhaite louer "${listingTitle}" du ${formatFull(startDate)} au ${formatFull(endDate)}. Est-ce disponible ?`;
  const [message, setMessage] = useState(defaultMessage);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setMessage(defaultMessage);
    setFocused(false);
  }, [visible, ownerUsername, listingTitle]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 85, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 700, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const ownerInitial = (ownerUsername ?? 'U')[0].toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.backdrop, { opacity: bgOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Confirmer la demande</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close-outline" size={17} color={TEXT_SUB} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {/* Listing recap */}
            <View style={styles.recapCard}>
              {listingThumb ? (
                <Image source={{ uri: listingThumb }} style={styles.recapImage} />
              ) : (
                <View style={styles.recapImageFallback}>
                  <Text style={styles.recapImageFallbackText}>{listingTitle[0]?.toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.recapContent}>
                <Text style={styles.recapTitle} numberOfLines={2}>{listingTitle}</Text>
                <View style={styles.recapMeta}>
                  <View style={styles.recapMetaItem}>
                    <Ionicons name="calendar-outline" size={12} color={Colors.primaryDark} />
                    <Text style={styles.recapMetaText}>
                      {formatShort(startDate)} — {formatShort(endDate)}
                    </Text>
                  </View>
                  <View style={styles.recapDot} />
                  <View style={styles.recapMetaItem}>
                    <Ionicons name="time-outline" size={12} color={Colors.primaryDark} />
                    <Text style={styles.recapMetaText}>{days} jour{days > 1 ? 's' : ''}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.recapPriceBox}>
                <Text style={styles.recapPriceAmount}>{totalPrice}</Text>
                <Text style={styles.recapPriceCurrency}>€</Text>
              </View>
            </View>

            {/* Owner */}
            <View style={styles.toRow}>
              <Text style={styles.toLabel}>Pour</Text>
              <View style={styles.ownerPill}>
                {ownerAvatarUrl ? (
                  <Image source={{ uri: ownerAvatarUrl }} style={styles.ownerAvatar} />
                ) : (
                  <View style={styles.ownerAvatarFallback}>
                    <Text style={styles.ownerAvatarInitial}>{ownerInitial}</Text>
                  </View>
                )}
                <Text style={styles.ownerName}>{ownerUsername}</Text>
              </View>
            </View>

            {/* Message input */}
            <View style={styles.messageWrap}>
              <View style={styles.messageLabelRow}>
                <Text style={styles.messageLabel}>Votre message</Text>
                <Text style={[
                  styles.charCount,
                  message.length > 450 && styles.charCountWarn
                ]}>
                  {message.length}/500
                </Text>
              </View>
              <TextInput
                style={[styles.messageInput, focused && styles.messageInputFocused]}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={500}
                placeholder="Écrivez votre message..."
                placeholderTextColor={Colors.textMuted}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                textAlignVertical="top"
              />
              <Text style={styles.messageHint}>
                Tapez pour personnaliser le message par défaut.
              </Text>
            </View>

            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { paddingBottom: Platform.OS === 'ios' ? 36 : 20 }]}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.75}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, (sending || !message.trim()) && styles.sendBtnDisabled]}
              onPress={() => onConfirm(message.trim())}
              activeOpacity={0.85}
              disabled={sending || !message.trim()}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="send-outline" size={15} color="#fff" />
                  <Text style={styles.sendBtnText}>Envoyer la demande</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,22,16,0.55)',
  },
  sheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '90%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.14, shadowRadius: 20 },
      android: { elevation: 18 },
      web: { boxShadow: '0 -6px 32px rgba(0,0,0,0.14)' },
    }),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0CCBf',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: TEXT,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  body: {
    paddingHorizontal: 22,
    paddingTop: 18,
    gap: 18,
  },

  /* Recap */
  recapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 1 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
    }),
  },
  recapImage: {
    width: 70,
    height: 70,
    borderRadius: 14,
    flexShrink: 0,
  },
  recapImageFallback: {
    width: 70,
    height: 70,
    borderRadius: 14,
    backgroundColor: Colors.primarySurface,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recapImageFallbackText: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.primaryDark,
  },
  recapContent: {
    flex: 1,
    gap: 7,
  },
  recapTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: TEXT,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  recapMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  recapMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recapMetaText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: TEXT_SUB,
  },
  recapDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: BORDER,
  },
  recapPriceBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    flexShrink: 0,
    backgroundColor: Colors.primaryDark,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recapPriceAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#fff',
    letterSpacing: -0.5,
  },
  recapPriceCurrency: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 1,
  },

  /* To row */
  toRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: TEXT_SUB,
  },
  ownerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primarySurface,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  ownerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  ownerAvatarFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerAvatarInitial: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    color: '#fff',
  },
  ownerName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.primaryDark,
  },

  /* Message */
  messageWrap: {
    gap: 8,
  },
  messageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messageLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: TEXT,
  },
  charCount: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  charCountWarn: {
    color: '#C06828',
  },
  messageInput: {
    backgroundColor: Colors.background,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: TEXT,
    lineHeight: 22,
    minHeight: 130,
    borderWidth: 1.5,
    borderColor: BORDER,
    textAlignVertical: 'top',
  },
  messageInputFocused: {
    borderColor: Colors.primaryDark,
    backgroundColor: '#FDFBF5',
  },
  messageHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: SURFACE,
  },
  cancelBtn: {
    paddingHorizontal: 22,
    height: 52,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: Colors.background,
  },
  cancelBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: TEXT_SUB,
  },
  sendBtn: {
    flex: 1,
    height: 52,
    borderRadius: 100,
    backgroundColor: Colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 16px rgba(142,152,120,0.4)' },
    }),
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.1,
  },
});
