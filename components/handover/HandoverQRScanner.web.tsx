import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Scanner } from '@yudiel/react-qr-scanner';
import HandoverSuccessAnimation from './HandoverSuccessAnimation';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import {
  extractScannedToken,
  type HandoverModalProps,
  type RedeemTokenResult,
} from './types';

export default function HandoverQRScanner({
  visible,
  onClose,
  bookingId,
  eventType,
  onSuccess,
}: HandoverModalProps) {
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const handlingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      handlingRef.current = false;
      setManualMode(false);
      setManualCode('');
      setError(null);
      setCameraError(null);
      setSuccess(false);
      setSubmitting(false);
    }
  }, [visible]);

  const redeem = async (input: string) => {
    if (handlingRef.current) return;
    handlingRef.current = true;
    setSubmitting(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('redeem_handover_token', {
      p_booking_id: bookingId,
      p_event_type: eventType,
      p_input: input,
    });
    const result = (data ?? {}) as RedeemTokenResult;

    if (rpcError || result.error) {
      setError(result.error ?? rpcError?.message ?? 'Échec de la validation');
      setSubmitting(false);
      setTimeout(() => { handlingRef.current = false; }, 1500);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
    onSuccess?.();
    setTimeout(() => onClose(), 2400);
  };

  const handleScan = (codes: { rawValue?: string }[] | undefined) => {
    if (!codes || codes.length === 0 || handlingRef.current || submitting || success) return;
    const raw = codes[0]?.rawValue;
    if (!raw) return;
    redeem(extractScannedToken(raw));
  };

  const submitManual = () => {
    const code = manualCode.trim();
    if (code.length !== 6) {
      setError('Le code doit contenir 6 chiffres.');
      return;
    }
    redeem(code);
  };

  const title = eventType === 'handover' ? 'Scanner le QR de remise' : 'Scanner le QR de retour';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-outline" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {!success && (
            <View style={styles.disclaimer}>
              <Ionicons name="alert-circle-outline" size={16} color="#92400E" />
              <Text style={styles.disclaimerText}>
                {eventType === 'handover'
                  ? 'Vérifiez l\'état de l\'objet ensemble avant de scanner. Une fois validé, la location démarre.'
                  : 'Vérifiez l\'état de l\'objet ensemble avant de scanner. Une fois validé, le retour est entériné.'}
              </Text>
            </View>
          )}

          {success ? (
            <HandoverSuccessAnimation eventType={eventType} />
          ) : manualMode || cameraError ? (
            <View style={styles.manualBlock}>
              <Ionicons name="keypad-outline" size={36} color={Colors.primaryDark} />
              <Text style={styles.manualLabel}>Code à 6 chiffres</Text>
              <TextInput
                value={manualCode}
                onChangeText={(v) => setManualCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.manualInput}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.primaryBtn, (submitting || manualCode.length !== 6) && styles.btnDisabled]}
                onPress={submitManual}
                disabled={submitting || manualCode.length !== 6}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Valider</Text>
                )}
              </TouchableOpacity>
              {!cameraError && (
                <TouchableOpacity onPress={() => setManualMode(false)}>
                  <Text style={styles.linkText}>Revenir au scan</Text>
                </TouchableOpacity>
              )}
              {cameraError && (
                <Text style={styles.cameraErrorText}>{cameraError}</Text>
              )}
            </View>
          ) : (
            <>
              <View style={styles.scannerWrap}>
                <Scanner
                  onScan={handleScan}
                  onError={(e: unknown) => {
                    const msg = (e as { message?: string })?.message ?? '';
                    setCameraError(
                      msg.includes('permission') || msg.includes('NotAllowed')
                        ? 'Permission caméra refusée. Saisis le code à 6 chiffres ci-dessous.'
                        : 'Caméra indisponible. Saisis le code à 6 chiffres ci-dessous.',
                    );
                  }}
                  formats={['qr_code']}
                  styles={{
                    container: { width: '100%', height: '100%' },
                    video: { width: '100%', height: '100%', objectFit: 'cover' },
                  }}
                />
              </View>
              <Text style={styles.hint}>
                Pointe la caméra vers le QR — la validation est instantanée.
              </Text>
              <TouchableOpacity onPress={() => setManualMode(true)} style={styles.fallbackBtn}>
                <Ionicons name="keypad-outline" size={16} color={Colors.primaryDark} />
                <Text style={styles.fallbackBtnText}>Saisir le code à 6 chiffres</Text>
              </TouchableOpacity>
            </>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: Colors.cardBackground,
    borderRadius: 22,
    padding: 24,
    gap: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
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
  },
  scannerWrap: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  hint: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  fallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: Colors.primaryLight + '40',
  },
  fallbackBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.primaryDark,
  },
  manualBlock: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  manualLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  manualInput: {
    width: 240,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 32,
    letterSpacing: 6,
    color: Colors.text,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingBottom: 6,
  },
  primaryBtn: {
    backgroundColor: Colors.primaryDark,
    paddingVertical: 13,
    paddingHorizontal: 32,
    borderRadius: 999,
    alignItems: 'center',
    minWidth: 180,
  },
  primaryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  btnDisabled: { opacity: 0.5 },
  linkText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.primaryDark,
    textDecorationLine: 'underline',
  },
  cameraErrorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 10,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  errorText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#C0392B',
    textAlign: 'center',
  },
});
