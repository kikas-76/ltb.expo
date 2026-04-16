import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  TextInput,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import ListingCard from '@/components/explore/ListingCard';
import SkeletonCard from '@/components/explore/SkeletonCard';
import CategoryEmptyState from '@/components/explore/CategoryEmptyState';
import FilterPanel, {
  FilterState,
  DEFAULT_FILTERS,
  CITIES,
  SortKey,
  CategoryOption,
} from '@/components/explore/FilterPanel';
import { useResponsive } from '@/hooks/useResponsive';

interface Listing {
  id: string;
  name: string;
  price: number;
  photos_url: string[] | null;
  category_name: string | null;
  category_id: string | null;
  latitude: number | null;
  longitude: number | null;
  owner_type: string | null;
  location_data?: { address?: string; city?: string } | null;
  rank?: number;
  owner: {
    id?: string;
    username: string | null;
    photo_url: string | null;
    is_pro?: boolean;
    location_data?: { address?: string; city?: string } | null;
  } | null;
}

interface Suggestion {
  suggestion: string;
  category: string | null;
}

const HISTORY_KEY = 'ltb_search_history';
const MAX_HISTORY = 3;
const PAGE_SIZE = 20;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function highlightMatch(text: string, query: string): { parts: { text: string; bold: boolean }[] } {
  if (!query.trim()) return { parts: [{ text, bold: false }] };
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const rawParts = text.split(regex);
  return {
    parts: rawParts.map((p) => ({
      text: p,
      bold: regex.test(p),
    })),
  };
}

function HighlightedText({ text, query, style, boldStyle }: {
  text: string;
  query: string;
  style?: any;
  boldStyle?: any;
}) {
  const { parts } = highlightMatch(text, query);
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.bold ? (
          <Text key={i} style={boldStyle}>{p.text}</Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        )
      )}
    </Text>
  );
}

function getLocalHistory(): string[] {
  if (Platform.OS !== 'web') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToLocalHistory(query: string) {
  if (Platform.OS !== 'web' || !query.trim()) return;
  try {
    const prev = getLocalHistory().filter((q) => q.toLowerCase() !== query.toLowerCase());
    const next = [query.trim(), ...prev].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {}
}

function removeFromLocalHistory(query: string) {
  if (Platform.OS !== 'web') return;
  try {
    const next = getLocalHistory().filter((q) => q.toLowerCase() !== query.toLowerCase());
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {}
}

const SORT_LABEL: Record<SortKey, string> = {
  recent: 'Plus récentes',
  nearest: 'Plus proches',
  price_asc: 'Prix croissant',
  price_desc: 'Prix décroissant',
};

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const inputRef = useRef<TextInput>(null);
  const { isDesktop, width: windowWidth } = useResponsive();

  const [searchQuery, setSearchQuery] = useState(params.q ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(params.q ?? '');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showPanel, setShowPanel] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoRequested, setGeoRequested] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [localHistory, setLocalHistory] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;
  const filterBadgeScale = useRef(new Animated.Value(1)).current;
  const suggestionsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    setTimeout(() => inputRef.current?.focus(), 150);
    setLocalHistory(getLocalHistory());
  }, []);

  const requestGeo = useCallback(() => {
    if (geoRequested) return;
    setGeoRequested(true);
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, [geoRequested]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name, value').order('order');
    setCategories(data ?? []);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      fetchSuggestions(debouncedQuery);
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery]);

  const queryMatchesListingName = (q: string): boolean => {
    if (q.trim().length < 3) return false;
    return suggestions.length > 0;
  };

  const fetchSuggestions = async (q: string) => {
    const { data } = await supabase.rpc('get_search_suggestions', {
      prefix: q.trim(),
      lim: 6,
    });
    setSuggestions(data ?? []);
  };

  const animateSuggestions = (visible: boolean) => {
    Animated.timing(suggestionsAnim, {
      toValue: visible ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const showHistoryInDropdown = showSuggestions &&
    searchQuery.trim().length >= 3 &&
    queryMatchesListingName(searchQuery) &&
    localHistory.length > 0;

  useEffect(() => {
    const hasSugg = suggestions.length > 0 || showHistoryInDropdown;
    animateSuggestions(hasSugg && showSuggestions);
  }, [suggestions, showSuggestions, showHistoryInDropdown]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      let ownersMap: Record<string, any> = {};

      const { data: ftsData } = await supabase.rpc('search_listings', {
        search_query: debouncedQuery.trim(),
        lim: 200,
      });

      if (!ftsData || ftsData.length === 0) {
        setListings([]);
        setLoading(false);
        return;
      }

      let results: any[] = ftsData ?? [];

      if (selectedCategoryIds.length > 0) {
        results = results.filter((l: any) => selectedCategoryIds.includes(l.category_id));
      }

      if (appliedFilters.ownerType !== 'all') {
        results = results.filter((l: any) => l.owner_type === appliedFilters.ownerType);
      }

      if (appliedFilters.priceMin !== '') {
        results = results.filter((l: any) => Number(l.price) >= Number(appliedFilters.priceMin));
      }
      if (appliedFilters.priceMax !== '') {
        results = results.filter((l: any) => Number(l.price) <= Number(appliedFilters.priceMax));
      }

      if (appliedFilters.sortKey === 'price_asc') {
        results.sort((a, b) => Number(a.price) - Number(b.price));
      } else if (appliedFilters.sortKey === 'price_desc') {
        results.sort((a, b) => Number(b.price) - Number(a.price));
      }

      const ids = results.map((l: any) => l.id);
      if (ids.length > 0) {
        const { data: ownersData } = await supabase
          .from('listings')
          .select('id, owner:profiles!listings_owner_id_fkey(id, username, photo_url, is_pro, location_data)')
          .in('id', ids);

        if (ownersData) {
          ownersData.forEach((row: any) => {
            ownersMap[row.id] = Array.isArray(row.owner) ? (row.owner[0] ?? null) : row.owner;
          });
        }
      }

      const mapped: Listing[] = results.map((l: any) => ({
        id: l.id,
        name: l.name,
        price: l.price,
        photos_url: l.photos_url,
        category_name: l.category_name,
        category_id: l.category_id,
        latitude: l.latitude,
        longitude: l.longitude,
        location_data: l.location_data,
        owner_type: l.owner_type,
        rank: l.rank,
        owner: ownersMap[l.id] ?? null,
      }));

      setListings(mapped);

      if (debouncedQuery.trim()) {
        saveToLocalHistory(debouncedQuery.trim());
        setLocalHistory(getLocalHistory());
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('search_history').insert({
            user_id: user.id,
            query: debouncedQuery.trim(),
            result_count: mapped.length,
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, selectedCategoryIds, appliedFilters]);

  useEffect(() => {
    setPage(0);
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    if (appliedFilters.locationMode === 'around_me') {
      requestGeo();
    }
  }, [appliedFilters.locationMode, requestGeo]);

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const pulseBadge = () => {
    Animated.sequence([
      Animated.timing(filterBadgeScale, { toValue: 1.3, duration: 120, useNativeDriver: true }),
      Animated.timing(filterBadgeScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const handleApply = () => {
    setAppliedFilters({ ...filters });
    pulseBadge();
    setShowPanel(false);
  };

  const openPanel = () => {
    setFilters(appliedFilters);
    setShowPanel(true);
  };

  const getRefCoords = (): { lat: number; lng: number } | null => {
    if (appliedFilters.locationMode === 'around_me') return userCoords;
    if (appliedFilters.locationMode === 'city') {
      const city = CITIES.find((c) => c.value === appliedFilters.selectedCity);
      return city ? { lat: city.lat, lng: city.lng } : null;
    }
    return null;
  };

  const applyClientFilters = (items: Listing[]): Listing[] => {
    let result = [...items];
    const ref = getRefCoords();
    if (ref && appliedFilters.locationMode !== 'none') {
      result = result.filter((l) => {
        if (!l.latitude || !l.longitude) return true;
        return haversineKm(ref.lat, ref.lng, l.latitude, l.longitude) <= appliedFilters.radiusKm;
      });
    }
    if (appliedFilters.sortKey === 'nearest' && ref) {
      result.sort((a, b) => {
        const dA = a.latitude && a.longitude ? haversineKm(ref.lat, ref.lng, a.latitude, a.longitude) : 9999;
        const dB = b.latitude && b.longitude ? haversineKm(ref.lat, ref.lng, b.latitude, b.longitude) : 9999;
        return dA - dB;
      });
    }
    return result;
  };

  const filtered = applyClientFilters(listings);

  const activeFiltersCount = [
    appliedFilters.sortKey !== 'recent',
    appliedFilters.ownerType !== 'all',
    appliedFilters.priceMin !== '' || appliedFilters.priceMax !== '',
    selectedCategoryIds.length > 0,
    appliedFilters.locationMode !== 'none',
  ].filter(Boolean).length;

  const locationChipLabel = () => {
    if (appliedFilters.locationMode === 'around_me') return `Autour de moi · ${appliedFilters.radiusKm}km`;
    if (appliedFilters.locationMode === 'city') {
      const city = CITIES.find((c) => c.value === appliedFilters.selectedCity);
      return city ? `${city.label} · ${appliedFilters.radiusKm}km` : 'Ville';
    }
    return 'Zone';
  };

  const locationChipActive = appliedFilters.locationMode !== 'none';

  const handleSelectSuggestion = (q: string) => {
    setSearchQuery(q);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const handleRemoveHistory = (q: string) => {
    removeFromLocalHistory(q);
    setLocalHistory(getLocalHistory());
  };

  const showHistoryList = showHistoryInDropdown;
  const showSuggestionList = showSuggestions && searchQuery.trim().length >= 2 && suggestions.length > 0;

  const pagedFiltered = filtered.slice(0, (page + 1) * PAGE_SIZE);
  const hasMore = filtered.length > pagedFiltered.length;

  const renderItem = ({ item }: { item: Listing }) => (
    <View style={styles.gridItem}>
      <ListingCard listing={item} variant="grid" />
    </View>
  );

  const renderListHeader = () => (
    <View style={styles.resultRow}>
      <Text style={styles.resultCount}>
        <Text style={styles.resultCountNum}>{filtered.length}</Text>
        {' '}annonce{filtered.length !== 1 ? 's' : ''}
        {debouncedQuery.trim() ? (
          <Text style={styles.resultCountQuery}> pour "{debouncedQuery.trim()}"</Text>
        ) : null}
      </Text>
      {locationChipActive && (
        <View style={styles.locationChip}>
          <Ionicons name="location-outline" size={11} color={Colors.primaryDark} />
          <Text style={styles.locationChipText}>{locationChipLabel()}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/')} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={15} color={Colors.primary} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Rechercher un objet…"
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoFocus={false}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onSubmitEditing={() => {
              setShowSuggestions(false);
              inputRef.current?.blur();
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Suggestions / History dropdown */}
      {(showHistoryList || showSuggestionList) && (
        <Animated.View
          style={[
            styles.suggestionsContainer,
            { opacity: suggestionsAnim, transform: [{ translateY: suggestionsAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] },
          ]}
        >
          {showHistoryList && (
            <>
              <View style={styles.suggestionsSectionHeader}>
                <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.suggestionsSectionTitle}>Recherches récentes</Text>
              </View>
              {localHistory.map((q, i) => (
                <View key={i} style={styles.suggestionRow}>
                  <TouchableOpacity
                    style={styles.suggestionMain}
                    onPress={() => handleSelectSuggestion(q)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.suggestionText}>{q}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRemoveHistory(q)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.suggestionRemove}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="close-outline" size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {showSuggestionList && (
            <>
              <View style={styles.suggestionsSectionHeader}>
                <Ionicons name="search-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.suggestionsSectionTitle}>Suggestions</Text>
              </View>
              {suggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.suggestionRow}
                  onPress={() => handleSelectSuggestion(s.suggestion)}
                  activeOpacity={0.7}
                >
                  <View style={styles.suggestionMain}>
                    <Ionicons name="search-outline" size={14} color={Colors.primary} />
                    <View style={styles.suggestionContent}>
                      <HighlightedText
                        text={s.suggestion}
                        query={searchQuery}
                        style={styles.suggestionText}
                        boldStyle={styles.suggestionTextBold}
                      />
                      {s.category ? (
                        <Text style={styles.suggestionCategory}>{s.category}</Text>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </Animated.View>
      )}

      <Animated.View style={[styles.chipsBar, { opacity: fadeAnim }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
          <TouchableOpacity
            style={[styles.filterChip, activeFiltersCount > 0 && styles.filterChipActive]}
            onPress={openPanel}
            activeOpacity={0.75}
          >
            <Ionicons name="options-outline" size={13} color={activeFiltersCount > 0 ? Colors.white : Colors.primary} />
            <Text style={[styles.filterChipText, activeFiltersCount > 0 && styles.filterChipTextActive]}>
              Filtres
            </Text>
            {activeFiltersCount > 0 && (
              <Animated.View style={[styles.filterBadge, { transform: [{ scale: filterBadgeScale }] }]}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </Animated.View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, appliedFilters.sortKey !== 'recent' && styles.chipActive]}
            onPress={openPanel}
            activeOpacity={0.75}
          >
            <Ionicons name="swap-vertical-outline" size={12} color={appliedFilters.sortKey !== 'recent' ? Colors.white : Colors.primary} />
            <Text style={[styles.chipText, appliedFilters.sortKey !== 'recent' && styles.chipTextActive]}>
              {SORT_LABEL[appliedFilters.sortKey]}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, locationChipActive && styles.chipActive]}
            onPress={openPanel}
            activeOpacity={0.75}
          >
            <Ionicons name="location-outline" size={12} color={locationChipActive ? Colors.white : Colors.primary} />
            <Text style={[styles.chipText, locationChipActive && styles.chipTextActive]}>
              {locationChipLabel()}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, (appliedFilters.priceMin !== '' || appliedFilters.priceMax !== '') && styles.chipActive]}
            onPress={openPanel}
            activeOpacity={0.75}
          >
            <Ionicons
              name="cash-outline"
              size={12}
              color={(appliedFilters.priceMin !== '' || appliedFilters.priceMax !== '') ? Colors.white : Colors.primary}
            />
            <Text style={[styles.chipText, (appliedFilters.priceMin !== '' || appliedFilters.priceMax !== '') && styles.chipTextActive]}>
              {appliedFilters.priceMin !== '' || appliedFilters.priceMax !== ''
                ? `${appliedFilters.priceMin || '0'} – ${appliedFilters.priceMax || '∞'} €`
                : 'Prix'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, appliedFilters.ownerType !== 'all' && styles.chipActive]}
            onPress={openPanel}
            activeOpacity={0.75}
          >
            <Ionicons
              name={appliedFilters.ownerType === 'professionnel' ? 'business-outline' : 'person-outline'}
              size={12}
              color={appliedFilters.ownerType !== 'all' ? Colors.white : Colors.primary}
            />
            <Text style={[styles.chipText, appliedFilters.ownerType !== 'all' && styles.chipTextActive]}>
              {appliedFilters.ownerType === 'all' ? 'Tous' : appliedFilters.ownerType === 'particulier' ? 'Particulier' : 'Pro'}
            </Text>
          </TouchableOpacity>

          {activeFiltersCount > 0 && (
            <TouchableOpacity
              style={styles.resetChip}
              onPress={() => {
                setFilters(DEFAULT_FILTERS);
                setAppliedFilters(DEFAULT_FILTERS);
                setSelectedCategoryIds([]);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close-outline" size={12} color={Colors.error} />
              <Text style={styles.resetChipText}>Effacer</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </Animated.View>

      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        {loading ? (
          <View style={[styles.skeletonGrid, isDesktop && styles.skeletonGridDesktop]}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <View key={i} style={isDesktop ? styles.gridItemDesktop : styles.gridItem}>
                <SkeletonCard variant="grid" />
              </View>
            ))}
          </View>
        ) : filtered.length === 0 && hasSearched ? (
          <View style={styles.emptyWrap}>
            <CategoryEmptyState
              categoryName={
                selectedCategoryIds.length === 1
                  ? categories.find((c) => c.id === selectedCategoryIds[0])?.name ?? ''
                  : searchQuery || 'tous les objets'
              }
            />
          </View>
        ) : isDesktop ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, styles.listContentDesktop]}
          >
            {renderListHeader()}
            <View style={styles.desktopGrid}>
              {pagedFiltered.map((item) => (
                <View key={item.id} style={styles.gridItemDesktop}>
                  <ListingCard listing={item} variant="grid" />
                </View>
              ))}
            </View>
            {hasMore && (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => setPage((p) => p + 1)}
                activeOpacity={0.8}
              >
                <Text style={styles.loadMoreBtnText}>
                  Afficher plus ({filtered.length - pagedFiltered.length} restantes)
                </Text>
                <Ionicons name="chevron-down-outline" size={15} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </ScrollView>
        ) : (
          <FlatList
            data={pagedFiltered}
            keyExtractor={(item) => item.id}
            numColumns={2}
            renderItem={renderItem}
            ListHeaderComponent={renderListHeader}
            ListFooterComponent={
              hasMore ? (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={() => setPage((p) => p + 1)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.loadMoreBtnText}>
                    Afficher plus ({filtered.length - pagedFiltered.length} restantes)
                  </Text>
                  <Ionicons name="chevron-down-outline" size={15} color={Colors.primary} />
                </TouchableOpacity>
              ) : null
            }
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>

      <FilterPanel
        visible={showPanel}
        filters={filters}
        onFiltersChange={setFilters}
        onClose={() => setShowPanel(false)}
        onApply={handleApply}
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        onToggleCategory={toggleCategory}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    flexShrink: 0,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 },
      android: { elevation: 3 },
      web: { boxShadow: `0 2px 8px ${Colors.primary}30` } as any,
    }),
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: Colors.text,
    padding: 0,
  },
  suggestionsContainer: {
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16 },
      android: { elevation: 8 },
      web: { boxShadow: '0 8px 24px rgba(0,0,0,0.1)' } as any,
    }),
    zIndex: 100,
  },
  suggestionsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  suggestionsSectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  suggestionContent: {
    flex: 1,
    gap: 1,
  },
  suggestionText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.text,
  },
  suggestionTextBold: {
    fontFamily: 'Inter-SemiBold',
    color: Colors.primaryDark,
  },
  suggestionCategory: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  suggestionRemove: {
    paddingLeft: 8,
  },
  chipsBar: {
    backgroundColor: Colors.background,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.white,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  filterChipText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.primary,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  filterBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  filterBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    color: Colors.primaryDark,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.white,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.text,
  },
  chipTextActive: {
    color: Colors.white,
  },
  resetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.errorLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  resetChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.error,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 12,
    flexWrap: 'wrap',
    gap: 6,
  },
  resultCount: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    flex: 1,
  },
  resultCountNum: {
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
  },
  resultCountQuery: {
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  locationChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: Colors.primaryDark,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 12,
  },
  columnWrapper: {
    gap: 12,
  },
  gridItem: {
    width: '47.5%',
  },
  emptyWrap: {
    flex: 1,
  },
  skeletonGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 32,
    paddingTop: 16,
    gap: 16,
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
  },
  gridItemDesktop: {
    width: '23%',
  },
  listContentDesktop: {
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 32,
  },
  desktopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 13,
    paddingHorizontal: 24,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignSelf: 'center',
    minWidth: 220,
    ...Platform.select({
      web: { boxShadow: `0 2px 8px ${Colors.primary}20` } as any,
    }),
  },
  loadMoreBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.primary,
  },
});
