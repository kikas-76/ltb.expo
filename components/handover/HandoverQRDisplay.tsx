import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import {
  buildHandoverUrl,
  type HandoverModalProps,
  type IssueTokenResult,
} from './types';

// Re-issue every 60s while the modal is open. The server-side TTL is 90s,
// so the displayed code is always valid for ≥30s when scanned.
const ROTATION_MS = 60_000;

export default function HandoverQRDisplay({
  visible,
  onClose,
  bookingId,
  eventType,
  onSuccess,
}: HandoverModalProps) {
  const [token, setToken] = useState<string | null>(null);
  const [numericCode, setNumericCode] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const rotationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const issue = async () => {
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('issue_handover_token', {
      p_booking_id: bookingId,
      p_event_type: eventType,
    });
    const result = (data ?? {}) as IssueTokenResult;
    if (rpcError || result.error) {
      setError(result.error ?? rpcError?.message ?? 'Impossible de générer le QR');
      setLoading(false);
      return;
    }
    setToken(result.token ?? null);
    setNumericCode(result.numeric_code ?? null);
    setSecondsRemaining(60);
    setLoading(false);
  };

  // Lifecycle: mount → issue + start rotation. Listen for status change.
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setDone(false);
    issue();

    rotationTimer.current = setInterval(issue, ROTATION_MS);
    tickTimer.current = setInterval(() => {
      setSecondsRemaining((s) => (s > 0 ? s - 1 : 60));
    }, 1000);

    const channel = supabase
      .channel(`handover-display-${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` },
        (payload) => {
          const newStatus = (payload.new as any)?.status;
          const expectedAfter =
            eventType === 'handover' ? 'in_progress' : 'pending_owner_validation';
          if (newStatus === expectedAfter) {
            setDone(true);
            onSuccess?.();
            // Auto-close after a brief success state
            setTimeout(() => onClose(), 1200);
          }
        },
      )
      .subscribe();

    return () => {
      if (rotationTimer.current) clearInterval(rotationTimer.current);
      if (tickTimer.current) clearInterval(tickTimer.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, bookingId, eventType]);

  const title = eventType === 'handover' ? 'QR de remise' : 'QR de retour';
  const instruction =
    eventType === 'handover'
      ? 'Le locataire scanne ce QR pour récupérer l\'objet.'
      : 'Le propriétaire scanne ce QR pour confirmer le retour.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, isDesktop && styles.overlayDesktop]}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, isDesktop && styles.sheetDesktop]}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-outline" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>{instruction}</Text>

          {done ? (
            <View style={styles.doneBlock}>
              <Ionicons name="checkmark-circle" size={64} color={Colors.primaryDark} />
              <Text style={styles.doneText}>
                {eventType === 'handover' ? 'Remise validée' : 'Retour validé'}
              </Text>
            </View>
          ) : loading || !token ? (
            <View style={styles.qrBlock}>
              <ActivityIndicator size="large" color={Colors.primaryDark} />
            </View>
          ) : (
            <>
              <View style={styles.qrBlock}>
                <View style={styles.qrFrame}>
                  <QRCode
                    value={buildHandoverUrl(bookingId, token)}
                    size={isDesktop ? 240 : 220}
                    backgroundColor="#FFFFFF"
                    color="#0F172A"
                  />
                </View>
              </View>

              <View style={styles.codeBlock}>
                <Text style={styles.codeLabel}>Code à dicter si la caméra ne marche pas</Text>
                <Text style={styles.codeValue}>{numericCode}</Text>
              </View>

              <View style={styles.rotationRow}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${(secondsRemaining / 60) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.rotationText}>Nouveau code dans {secondsRemaining}s</Text>
              </View>
            </>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayDesktop: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.55)' },
  sheet: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    gap: 16,
  },
  sheetDesktop: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    paddingBottom: 28,
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
  qrBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 240,
  },
  qrFrame: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  codeBlock: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  codeLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.textMuted,
  },
  codeValue: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 32,
    letterSpacing: 6,
    color: Colors.text,
    fontWeight: '700',
  },
  rotationRow: {
    gap: 6,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primaryDark,
  },
  rotationText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  doneBlock: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 32,
  },
  doneText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: Colors.primaryDark,
  },
  errorText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#C0392B',
    textAlign: 'center',
  },
});
