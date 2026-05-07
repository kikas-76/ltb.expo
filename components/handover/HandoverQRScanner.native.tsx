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
import { CameraView, useCameraPermissions } from 'expo-camera';
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
  const [permission, requestPermission] = useCameraPermissions();
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const handlingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      handlingRef.current = false;
      setManualMode(false);
      setManualCode('');
      setError(null);
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
      // Allow retry after a brief debounce
      setTimeout(() => { handlingRef.current = false; }, 1500);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
    onSuccess?.();
    setTimeout(() => onClose(), 2400);
  };

  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (handlingRef.current || submitting || success) return;
    redeem(extractScannedToken(data));
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-outline" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {!success && permission?.granted && !manualMode && (
          <View style={styles.disclaimer}>
            <Ionicons name="alert-circle-outline" size={16} color="#FFB454" />
            <Text style={styles.disclaimerText}>
              {eventType === 'handover'
                ? 'Vérifiez l\'état de l\'objet ensemble avant de scanner. Une fois validé, la location démarre.'
                : 'Vérifiez l\'état de l\'objet ensemble avant de scanner. Une fois validé, le retour est entériné.'}
            </Text>
          </View>
        )}

        {success ? (
          <View style={styles.successWrap}>
            <HandoverSuccessAnimation eventType={eventType} />
          </View>
        ) : !permission ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        ) : !permission.granted && !manualMode ? (
          <View style={styles.centerBlock}>
            <Ionicons name="camera-outline" size={56} color="#FFFFFF" />
            <Text style={styles.permText}>
              L'accès à la caméra est nécessaire pour scanner le QR.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
              <Text style={styles.primaryBtnText}>Autoriser la caméra</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setManualMode(true)}>
              <Text style={styles.secondaryBtnText}>Saisir le code à 6 chiffres</Text>
            </TouchableOpacity>
          </View>
        ) : manualMode ? (
          <View style={styles.manualBlock}>
            <Ionicons name="keypad-outline" size={48} color="#FFFFFF" />
            <Text style={styles.manualLabel}>Code à 6 chiffres</Text>
            <TextInput
              value={manualCode}
              onChangeText={(v) => setManualCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor="rgba(255,255,255,0.3)"
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
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setManualMode(false)}>
              <Text style={styles.secondaryBtnText}>Revenir au scan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraBlock}>
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={submitting ? undefined : onBarcodeScanned}
            />
            <View style={styles.overlayFrame} pointerEvents="none">
              <View style={styles.scanFrame} />
            </View>
            <View style={styles.cameraFooter}>
              <Text style={styles.cameraHint}>
                Aligne le QR dans le cadre — la validation est instantanée.
              </Text>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setManualMode(true)}>
                <Ionicons name="keypad-outline" size={16} color="#FFFFFF" />
                <Text style={styles.secondaryBtnText}>Saisir le code à 6 chiffres</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  cameraBlock: { flex: 1 },
  camera: { ...StyleSheet.absoluteFillObject },
  overlayFrame: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 22,
  },
  cameraFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 24,
    gap: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  cameraHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    padding: 32,
  },
  permText: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  manualBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 32,
  },
  manualLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#FFFFFF',
  },
  manualInput: {
    width: 220,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 36,
    letterSpacing: 6,
    color: '#FFFFFF',
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#FFFFFF',
    paddingBottom: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    gap: 6,
  },
  secondaryBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 22,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(254,243,199,0.95)',
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    zIndex: 5,
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
    color: '#FCA5A5',
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
});
