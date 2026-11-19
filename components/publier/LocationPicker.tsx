import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { getCurrentPosition, geoErrorMessage } from '@/lib/geolocation';
import { searchFrenchAddresses, reverseFrenchAddress, type FrenchAddress } from '@/lib/frenchAddress';

export interface PickedLocation {
  address: string;
  city: string | null;
  postcode: string | null;
  lat: number;
  lng: number;
}

function fromFrench(a: FrenchAddress): PickedLocation {
  return { address: a.label, city: a.city, postcode: a.postcode, lat: a.lat, lng: a.lng };
}

/** Lieu de l'objet : adresse ou ville en France, ou position actuelle. */
export default function LocationPicker({
  value,
  onChange,
}: {
  value: PickedLocation | null;
  onChange: (location: PickedLocation | null) => void;
}) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<FrenchAddress[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (value) return;
    const q = text.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      try {
        const results = await searchFrenchAddresses(q, controller.signal);
        if (!controller.signal.aborted) {
          setSuggestions(results);
          setError(results.length === 0 ? 'Aucune adresse trouvée. Essayez avec la ville ou le code postal.' : null);
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') setError('Recherche indisponible pour le moment. Réessayez.');
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [text, value]);

  const useMyPosition = async () => {
    setError(null);
    setLocating(true);
    try {
      const { latitude, longitude } = await getCurrentPosition();
      const found = await reverseFrenchAddress(latitude, longitude);
      if (!found) {
        setError('Position hors de France ou introuvable. Saisissez votre ville.');
        return;
      }
      onChange(fromFrench(found));
    } catch (e) {
      setError(geoErrorMessage(e));
    } finally {
      setLocating(false);
    }
  };

  if (value) {
    return (
      <View style={styles.selected}>
        <View style={styles.pin}>
          <Ionicons name="location" size={20} color={Colors.white} />
        </View>
        <View style={styles.selectedBody}>
          <Text style={styles.selectedLabel}>{value.address}</Text>
          <Text style={styles.selectedHint}>
            {value.city ? `Affiché sur l'annonce : ${value.city}, zone approximative` : 'Zone approximative sur l\'annonce'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            onChange(null);
            setText('');
            setSuggestions([]);
          }}
          style={styles.changeBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.changeText}>Modifier</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.inputWrap}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="Adresse, rue ou ville"
          placeholderTextColor={Colors.textMuted}
          value={text}
          onChangeText={(t) => {
            setText(t);
            setError(null);
          }}
          autoComplete="street-address"
          autoCorrect={false}
        />
        {searching && <ActivityIndicator size="small" color={Colors.primary} />}
      </View>

      {suggestions.length > 0 && (
        <View style={styles.list}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={`${s.label}-${i}`}
              style={[styles.item, i > 0 && styles.itemBorder]}
              onPress={() => {
                onChange(fromFrench(s));
                setSuggestions([]);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={16} color={Colors.primaryDark} />
              <Text style={styles.itemText}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.gpsBtn} onPress={useMyPosition} disabled={locating} activeOpacity={0.8}>
        {locating ? (
          <ActivityIndicator size="small" color={Colors.primaryDark} />
        ) : (
          <Ionicons name="navigate" size={16} color={Colors.primaryDark} />
        )}
        <Text style={styles.gpsText}>Utiliser ma position actuelle</Text>
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.tips}>
        <Ionicons name="shield-checkmark-outline" size={14} color={Colors.primaryDark} />
        <Text style={styles.tipsText}>
          Votre adresse exacte n'est jamais affichée : l'annonce montre seulement une zone approximative. Le lieu de remise se décide ensuite avec le locataire, dans la messagerie.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 54,
    paddingHorizontal: 16,
  },
  input: { flex: 1, height: '100%', fontSize: 15, fontFamily: 'Inter-Regular', color: Colors.text },
  list: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  itemBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  itemText: { flex: 1, fontSize: 14, fontFamily: 'Inter-Regular', color: Colors.text },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: Colors.primary + '1F',
  },
  gpsText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: Colors.primaryDark },
  error: { fontSize: 13, fontFamily: 'Inter-Regular', color: Colors.error },
  tips: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.primaryLight + '35',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  tipsText: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.primaryDark, lineHeight: 18 },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    padding: 14,
  },
  pin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBody: { flex: 1, gap: 2 },
  selectedLabel: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: Colors.text },
  selectedHint: { fontSize: 12, fontFamily: 'Inter-Regular', color: Colors.textSecondary },
  changeBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  changeText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: Colors.primaryDark, textDecorationLine: 'underline' },
});
