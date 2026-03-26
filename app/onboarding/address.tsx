import { useState, useRef, useEffect } from 'react';
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
  Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MapPin, Navigation, X } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { supabase } from '@/lib/supabase';
import {
  fetchPlaceSuggestions,
  fetchPlaceDetails,
  reverseGeocode,
  PlaceSuggestion,
} from '@/lib/googleMaps';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY as string;

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

function DynamicMap({ lat, lng }: { lat: number | null; lng: number | null }) {
  const pinScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (lat !== null && lng !== null) {
      pinScale.setValue(0);
      Animated.spring(pinScale, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }).start();
    }
  }, [lat, lng]);

  if (lat === null || lng === null) {
    return (
      <View style={styles.mapContainer}>
        <View style={styles.mapEmptyOverlay}>
          <View style={styles.mapEmptyPin}>
            <MapPin size={26} color="#fff" />
          </View>
          <View style={styles.mapPinShadow} />
          <Text style={styles.mapEmptyText}>Entrez une adresse pour la localiser</Text>
        </View>
      </View>
    );
  }

  const embedUrl =
    `https://www.google.com/maps/embed/v1/view` +
    `?key=${GOOGLE_MAPS_KEY}` +
    `&center=${lat},${lng}` +
    `&zoom=15` +
    `&maptype=roadmap`;

  const mapHtml = `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>* { margin:0; padding:0; } html,body,iframe { width:100%; height:100%; border:none; }</style>
    </head><body>
    <iframe src="${embedUrl}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>
    </body></html>`;

  return (
    <View style={styles.mapContainer}>
      {Platform.OS === 'web' ? (
        <iframe src={embedUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="map" />
      ) : (
        <WebView source={{ html: mapHtml }} style={styles.webview} scrollEnabled={false} pointerEvents="none" />
      )}
      <View style={styles.mapConfirmBadge}>
        <MapPin size={13} color={GREEN} />
        <Text style={styles.mapConfirmText}>Position localisée</Text>
      </View>
    </View>
  );
}

export default function OnboardingAddressScreen() {
  const params = useLocalSearchParams<{ isPro: string }>();
  const isPro = params.isPro === 'true';

  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [usingGPS, setUsingGPS] = useState(false);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAddressChange = (v: string) => {
    setAddress(v);
    setLat(null);
    setLng(null);
    setUsingGPS(false);
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    if (v.trim().length >= 3) {
      geocodeTimer.current = setTimeout(async () => {
        setGeocoding(true);
        const results = await fetchPlaceSuggestions(v);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        setGeocoding(false);
      }, 400);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = async (s: PlaceSuggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setGeocoding(true);
    const details = await fetchPlaceDetails(s.place_id);
    setGeocoding(false);
    if (details) {
      setAddress(details.address);
      setLat(details.lat);
      setLng(details.lng);
    } else {
      setAddress(s.description);
    }
    setUsingGPS(false);
  };

  const handleClear = () => {
    setAddress('');
    setLat(null);
    setLng(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setUsingGPS(false);
  };

  const handleUseLocation = () => {
    setGeoError(null);
    if (!navigator?.geolocation) {
      setGeoError("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const result = await reverseGeocode(latitude, longitude);
        setLat(latitude);
        setLng(longitude);
        setAddress(result?.address ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        setUsingGPS(true);
        setSuggestions([]);
        setShowSuggestions(false);
        setGeoLoading(false);
      },
      () => {
        setGeoError("Impossible d'obtenir votre position. Vérifiez les permissions.");
        setGeoLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const handleSave = async () => {
    setError(null);
    if (!address.trim()) {
      setError('Veuillez entrer une adresse.');
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('Session expirée. Veuillez recommencer.');
      setSubmitting(false);
      return;
    }

    let updates: Record<string, any>;
    if (isPro) {
      updates = {
        business_address: address.trim(),
        business_lat: lat ?? null,
        business_lng: lng ?? null,
      };
    } else {
      updates = {
        location_data: { address: address.trim(), lat: lat ?? null, lng: lng ?? null },
      };
    }

    const { error: updateError } = await supabase.from('profiles').update(updates).eq('id', user.id);

    if (updateError) {
      setError('Erreur lors de la sauvegarde : ' + updateError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    if (isPro) {
      router.replace('/onboarding/business-hours');
    } else {
      router.replace('/onboarding/welcome');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#1C1C18" />
          </TouchableOpacity>
          <Image
            source={require('@/assets/images/logoLTBwhitoutbaground.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Stepper active={4} />
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>
            {isPro ? "Adresse de ton commerce" : "Définis ton adresse principale"}
          </Text>
          <Text style={styles.subtitle}>
            {isPro
              ? "L'adresse de ton établissement sera affichée sur ton profil professionnel"
              : "Cette adresse facilitera les échanges d'objets avec les autres utilisateurs"}
          </Text>

          {(error || geoError) && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error ?? geoError}</Text>
            </View>
          )}

          <DynamicMap lat={lat} lng={lng} />

          <View style={styles.inputWrapper}>
            {usingGPS ? (
              <View style={[styles.inputRow, styles.inputRowGPS]}>
                <Navigation size={18} color={GREEN} style={styles.inputIcon} />
                <Text style={styles.gpsLabel}>Ma position actuelle</Text>
                <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color="#A8A8A0" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.inputRow}>
                {geocoding ? (
                  <ActivityIndicator size="small" color={GREEN} style={styles.inputIcon} />
                ) : (
                  <MapPin size={18} color={address ? GREEN : '#A8A8A0'} style={styles.inputIcon} />
                )}
                <TextInput
                  style={styles.inputFlex}
                  placeholder={isPro ? "Adresse du commerce..." : "Rechercher une adresse..."}
                  placeholderTextColor="#A8A8A0"
                  value={address}
                  onChangeText={handleAddressChange}
                  autoCorrect={false}
                  returnKeyType="search"
                  onFocus={() => address.length >= 3 && suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                />
                {address.length > 0 && (
                  <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={16} color="#A8A8A0" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggestionsBox}>
                {suggestions.map((s, i) => (
                  <TouchableOpacity
                    key={s.place_id}
                    style={[styles.suggestionItem, i < suggestions.length - 1 && styles.suggestionItemBorder]}
                    onPress={() => handleSelectSuggestion(s)}
                    activeOpacity={0.7}
                  >
                    <MapPin size={14} color={GREEN} style={styles.suggestionIcon} />
                    <View style={styles.suggestionTextWrap}>
                      <Text style={styles.suggestionMainText} numberOfLines={1}>
                        {s.structured_formatting.main_text}
                      </Text>
                      {s.structured_formatting.secondary_text ? (
                        <Text style={styles.suggestionSecondText} numberOfLines={1}>
                          {s.structured_formatting.secondary_text}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {!usingGPS && (
            <TouchableOpacity
              style={[styles.btnOutline, geoLoading && { opacity: 0.65 }]}
              onPress={handleUseLocation}
              disabled={geoLoading}
              activeOpacity={0.82}
            >
              {geoLoading ? (
                <ActivityIndicator color={GREEN} size="small" />
              ) : (
                <>
                  <Navigation size={17} color={GREEN} strokeWidth={2} />
                  <Text style={styles.btnOutlineText}>Utiliser ma position actuelle</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.btnPrimary, submitting && { opacity: 0.65 }]}
            onPress={handleSave}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Enregistrer</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, paddingBottom: 48 },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 8, gap: 20 },
  backBtn: { position: 'absolute', left: 20, top: 60, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 200, height: 52 },
  stepper: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D5CEBC' },
  stepDotActive: { width: 28, height: 10, borderRadius: 5, backgroundColor: GREEN },
  body: { paddingHorizontal: 24, paddingTop: 28, gap: 16, maxWidth: 390, width: '100%', alignSelf: 'center' },
  title: { fontSize: 26, fontFamily: 'Inter-Bold', color: '#1C1C18', letterSpacing: -0.5, lineHeight: 32 },
  subtitle: { fontSize: 15, fontFamily: 'Inter-Regular', color: '#7A7A70', marginTop: -4, lineHeight: 22 },
  errorBox: { backgroundColor: '#FDECEA', borderRadius: 12, padding: 12 },
  errorText: { color: '#C0392B', fontSize: 13, fontFamily: 'Inter-Regular', textAlign: 'center' },
  mapContainer: {
    height: 190,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D5CEBC',
    backgroundColor: '#E8E4DC',
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
  mapConfirmBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapConfirmText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: GREEN },
  mapEmptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(232,228,220,0.75)',
  },
  mapEmptyPin: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  mapPinShadow: { width: 16, height: 6, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.12)', marginTop: 2 },
  mapEmptyText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#7A7A70', marginTop: 4 },
  inputWrapper: { position: 'relative', zIndex: 10 },
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
  inputRowGPS: { borderColor: GREEN, backgroundColor: '#ECEEE6' },
  gpsLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter-SemiBold', color: GREEN },
  inputIcon: { flexShrink: 0 },
  inputFlex: { flex: 1, height: '100%', fontSize: 15, fontFamily: 'Inter-Regular', color: '#1C1C18' },
  suggestionsBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0D8C8',
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 10,
  },
  suggestionItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F0EBE0' },
  suggestionIcon: { marginTop: 2, flexShrink: 0 },
  suggestionTextWrap: { flex: 1 },
  suggestionMainText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#1C1C18', lineHeight: 20 },
  suggestionSecondText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#7A7A70', lineHeight: 17, marginTop: 1 },
  btnOutline: {
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 2,
    borderColor: GREEN,
  },
  btnOutlineText: { color: GREEN, fontSize: 15, fontFamily: 'Inter-SemiBold', letterSpacing: 0.1 },
  btnPrimary: { backgroundColor: GREEN, height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontFamily: 'Inter-SemiBold', letterSpacing: 0.2 },
});
