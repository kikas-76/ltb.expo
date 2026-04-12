import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
  Modal,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


interface Listing {
  id: string;
  name: string;
  price: number;
  photos_url: string[];
  category_name: string | null;
  location_data: { address?: string } | null;
  is_active: boolean;
  created_at: string;
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBadge}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface DeleteModalProps {
  visible: boolean;
  listingName: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}

function DeleteModal({ visible, listingName, onConfirm, onCancel, deleting }: DeleteModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={[styles.modalBackdrop, { opacity: opacityAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <Animated.View style={[styles.modalCard, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <View style={styles.modalIconWrap}>
            <Ionicons name="warning-outline" size={28} color={Colors.error} />
          </View>

          <Text style={styles.modalTitle}>Supprimer l'annonce ?</Text>
          <Text style={styles.modalBody}>
            L'annonce <Text style={styles.modalBold}>"{listingName}"</Text> sera définitivement supprimée et ne pourra pas être récupérée.
          </Text>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalDeleteBtn, deleting && styles.modalDeleteBtnDisabled]}
              onPress={onConfirm}
              activeOpacity={0.8}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={14} color="#fff" />
                  <Text style={styles.modalDeleteText}>Supprimer</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

interface ListingCardProps {
  item: Listing;
  index: number;
  onEdit: (id: string) => void;
  onToggle: (id: string, current: boolean) => void;
  onDelete: (item: Listing) => void;
  togglingId: string | null;
}

function ListingCard({ item, index, onEdit, onToggle, onDelete, togglingId }: ListingCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const isToggling = togglingId === item.id;
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 80),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const photo = item.photos_url?.[0] ?? null;
  const address = item.location_data?.address ?? null;

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity activeOpacity={0.92} onPress={() => router.push(`/listing/${item.id}` as any)}>
        <View style={styles.cardInner}>
          <View style={[styles.cardImageWrap, isDesktop && desktopStyles.cardImageDesktop]}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.cardImage} resizeMode="cover" />
            ) : (
              <View style={styles.cardImagePlaceholder}>
                <Ionicons name="megaphone-outline" size={24} color={Colors.primary} />
              </View>
            )}
            <View style={[styles.statusPill, item.is_active ? styles.statusPillActive : styles.statusPillInactive]}>
              <View style={[styles.statusDot, item.is_active ? styles.statusDotActive : styles.statusDotInactive]} />
              <Text style={[styles.statusPillText, item.is_active ? styles.statusPillTextActive : styles.statusPillTextInactive]}>
                {item.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
            </View>

            <View style={styles.cardMeta}>
              {item.category_name && (
                <View style={styles.metaTag}>
                  <Ionicons name="pricetag-outline" size={10} color={Colors.primaryDark} />
                  <Text style={styles.metaTagText}>{item.category_name}</Text>
                </View>
              )}
              {address && (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={10} color={Colors.textMuted} />
                  <Text style={styles.metaText} numberOfLines={1}>{address}</Text>
                </View>
              )}
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.cardPrice}>
                {parseFloat(String(item.price)).toFixed(2)} €
                <Text style={styles.cardPriceUnit}> / jour</Text>
              </Text>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  activeOpacity={0.75}
                  onPress={() => onEdit(item.id)}
                >
                  <Ionicons name="pencil-outline" size={14} color={Colors.primaryDark} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnToggle, isToggling && styles.actionBtnDisabled]}
                  activeOpacity={0.75}
                  onPress={() => onToggle(item.id, item.is_active)}
                  disabled={isToggling}
                >
                  {isToggling ? (
                    <ActivityIndicator size="small" color={Colors.textMuted} />
                  ) : item.is_active ? (
                    <Ionicons name="eye-off-outline" size={14} color={Colors.textMuted} />
                  ) : (
                    <Ionicons name="eye-outline" size={14} color={Colors.primaryDark} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnDelete]}
                  activeOpacity={0.75}
                  onPress={() => onDelete(item)}
                >
                  <Ionicons name="trash-outline" size={14} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

type TabKey = 'active' | 'inactive';

export default function MesAnnoncesScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [blockingError, setBlockingError] = useState<string | null>(null);
  const tabIndicator = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const hasActiveBooking = async (listingId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('bookings')
      .select('id')
      .eq('listing_id', listingId)
      .not('status', 'in', '("completed","cancelled","refused")')
      .limit(1)
      .maybeSingle();
    return !!data;
  };

  const notifyPendingConversations = async (listingId: string) => {
    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .eq('listing_id', listingId)
      .eq('status', 'pending');
    if (!convs || convs.length === 0) return;
    const msgs = convs.map((c: any) => ({
      conversation_id: c.id,
      sender_id: null,
      content: "L'annonce a été supprimée ou masquée — Cette demande n'est plus disponible",
      is_system: true,
    }));
    await supabase.from('chat_messages').insert(msgs);
  };

  const fetchListings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('listings')
      .select('id, name, price, photos_url, category_name, location_data, is_active, created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    setListings(data ?? []);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchListings();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchListings();
  };

  const handleEdit = (id: string) => {
    router.push(`/create-listing?editId=${id}` as any);
  };

  const handleToggle = async (id: string, current: boolean) => {
    if (current) {
      const blocked = await hasActiveBooking(id);
      if (blocked) {
        setBlockingError("Impossible de masquer cette annonce : une location est en cours ou validée.");
        return;
      }
    }
    setTogglingId(id);
    const { error } = await supabase
      .from('listings')
      .update({ is_active: !current })
      .eq('id', id);

    if (!error) {
      setListings((prev) =>
        prev.map((l) => (l.id === id ? { ...l, is_active: !current } : l))
      );
      if (current) {
        await notifyPendingConversations(id);
      }
    }
    setTogglingId(null);
  };

  const handleDeleteRequest = async (item: Listing) => {
    const blocked = await hasActiveBooking(item.id);
    if (blocked) {
      setBlockingError("Impossible de supprimer cette annonce : des demandes sont en cours.");
      return;
    }
    setDeleteTarget(item);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await notifyPendingConversations(deleteTarget.id);
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', deleteTarget.id);

    if (!error) {
      setListings((prev) => prev.filter((l) => l.id !== deleteTarget.id));
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    Animated.spring(tabIndicator, {
      toValue: tab === 'active' ? 0 : 1,
      tension: 70,
      friction: 10,
      useNativeDriver: false,
    }).start();
  };

  const activeListings = listings.filter((l) => l.is_active);
  const inactiveListings = listings.filter((l) => !l.is_active);
  const displayed = activeTab === 'active' ? activeListings : inactiveListings;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }, isDesktop && desktopStyles.listContentDesktop]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <View style={[styles.pageHeader, { paddingTop: insets.top + 20 }, isDesktop && desktopStyles.pageHeaderDesktop]}>
          <View>
            <Text style={styles.pageTitle}>Mes annonces</Text>
            <Text style={styles.pageSubtitle}>Gérez vos objets en location</Text>
          </View>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => router.push('/create-listing')}
            activeOpacity={0.85}
          >
            <Ionicons name="add-outline" size={16} color="#fff" />
            <Text style={styles.newBtnText}>Nouvelle</Text>
          </TouchableOpacity>
        </View>

        {listings.length > 0 && (
          <View style={styles.statsRow}>
            <StatBadge label="Total" value={String(listings.length)} />
            <View style={styles.statsDivider} />
            <StatBadge label="Actives" value={String(activeListings.length)} />
            <View style={styles.statsDivider} />
            <StatBadge label="Inactives" value={String(inactiveListings.length)} />
          </View>
        )}

        {listings.length > 0 && (
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]}
              onPress={() => switchTab('active')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="trending-up-outline"
                size={14}
                color={activeTab === 'active' ? Colors.primaryDark : Colors.textMuted}
              />
              <Text style={[styles.tabBtnText, activeTab === 'active' && styles.tabBtnTextActive]}>
                Actives
              </Text>
              <View style={[styles.tabBadge, activeTab === 'active' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'active' && styles.tabBadgeTextActive]}>
                  {activeListings.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'inactive' && styles.tabBtnInactiveSelected]}
              onPress={() => switchTab('inactive')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="eye-off-outline"
                size={14}
                color={activeTab === 'inactive' ? Colors.textSecondary : Colors.textMuted}
              />
              <Text style={[styles.tabBtnText, activeTab === 'inactive' && styles.tabBtnTextInactive]}>
                Inactives
              </Text>
              <View style={[styles.tabBadge, activeTab === 'inactive' && styles.tabBadgeInactive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'inactive' && styles.tabBadgeTextInactive]}>
                  {inactiveListings.length}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {displayed.length > 0 ? (
          <View style={[activeTab === 'inactive' && styles.inactiveSection, isDesktop && desktopStyles.grid]}>
            {displayed.map((item, i) => (
              <View key={item.id} style={isDesktop ? desktopStyles.gridItem : undefined}>
                <ListingCard
                  item={item}
                  index={i}
                  onEdit={handleEdit}
                  onToggle={handleToggle}
                  onDelete={handleDeleteRequest}
                  togglingId={togglingId}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.tabEmptyState}>
            {activeTab === 'active' ? (
              <>
                <Ionicons name="trending-up-outline" size={32} color={Colors.primary} />
                <Text style={styles.tabEmptyTitle}>Aucune annonce active</Text>
                <Text style={styles.tabEmptySubtitle}>
                  Activez une annonce existante ou créez-en une nouvelle.
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="eye-off-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.tabEmptyTitle}>Aucune annonce inactive</Text>
                <Text style={styles.tabEmptySubtitle}>
                  Toutes vos annonces sont actuellement actives.
                </Text>
              </>
            )}
          </View>
        )}

        {listings.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="megaphone-outline" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Aucune annonce</Text>
            <Text style={styles.emptySubtitle}>
              Publiez votre premier objet à louer et commencez à gagner de l'argent.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/create-listing')}
              activeOpacity={0.85}
            >
              <Ionicons name="add-outline" size={16} color="#fff" />
              <Text style={styles.emptyBtnText}>Créer une annonce</Text>
              <Ionicons name="chevron-forward-outline" size={14} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <DeleteModal
        visible={deleteTarget !== null}
        listingName={deleteTarget?.name ?? ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        deleting={deleting}
      />

      <Modal visible={!!blockingError} transparent animationType="fade" onRequestClose={() => setBlockingError(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBlockingError(null)}>
          <Pressable>
            <View style={styles.modalCard}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="lock-closed-outline" size={28} color="#C0392B" />
              </View>
              <Text style={styles.modalTitle}>Action impossible</Text>
              <Text style={styles.modalBody}>{blockingError}</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalDeleteBtn, { flex: 1 }]} onPress={() => setBlockingError(null)} activeOpacity={0.8}>
                  <Text style={styles.modalDeleteText}>Compris</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    letterSpacing: -0.6,
  },
  pageSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
    marginTop: 2,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    ...Platform.select({
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 12px rgba(183,191,156,0.4)' },
    }),
  },
  newBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
    }),
  },
  statBadge: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
  },
  statsDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E8E4D6',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
  },
  tabBtnActive: {
    backgroundColor: Colors.primarySurface,
    ...Platform.select({
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 6px rgba(183,191,156,0.2)' },
    }),
  },
  tabBtnInactiveSelected: {
    backgroundColor: '#F0EDE3',
  },
  tabBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: Colors.textMuted,
  },
  tabBtnTextActive: {
    color: Colors.primaryDark,
  },
  tabBtnTextInactive: {
    color: Colors.textSecondary,
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E8E4D6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeActive: {
    backgroundColor: Colors.primary,
  },
  tabBadgeInactive: {
    backgroundColor: '#D8D4C8',
  },
  tabBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: Colors.textMuted,
  },
  tabBadgeTextActive: {
    color: '#fff',
  },
  tabBadgeTextInactive: {
    color: Colors.textSecondary,
  },
  inactiveSection: {
    opacity: 0.65,
  },
  tabEmptyState: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 40,
    gap: 12,
  },
  tabEmptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
    textAlign: 'center',
  },
  tabEmptySubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#8E9878', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 12 },
      android: { elevation: 3 },
      web: { boxShadow: '0 4px 12px rgba(142,152,120,0.1)' },
    }),
  },
  cardInner: {
    flexDirection: 'row',
  },
  cardImageWrap: {
    width: 110,
    height: 130,
    position: 'relative',
    flexShrink: 0,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    position: 'absolute',
    bottom: 8,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 100,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusPillActive: {
    backgroundColor: 'rgba(183,191,156,0.95)',
  },
  statusPillInactive: {
    backgroundColor: 'rgba(200,200,200,0.9)',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusDotActive: {
    backgroundColor: '#4A7C45',
  },
  statusDotInactive: {
    backgroundColor: '#999',
  },
  statusPillText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
  },
  statusPillTextActive: {
    color: '#3A5C35',
  },
  statusPillTextInactive: {
    color: '#777',
  },
  cardBody: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardName: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
    lineHeight: 20,
  },
  cardMeta: {
    gap: 4,
    marginTop: 6,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  metaTagText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: Colors.primaryDark,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cardPrice: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
  },
  cardPriceUnit: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnToggle: {
    backgroundColor: '#F0EDE3',
  },
  actionBtnDelete: {
    backgroundColor: Colors.errorLight,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 100,
    ...Platform.select({
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 12px rgba(183,191,156,0.4)' },
    }),
  },
  emptyBtnText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.18, shadowRadius: 32 },
      android: { elevation: 16 },
      web: { boxShadow: '0 16px 48px rgba(0,0,0,0.18)' },
    }),
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  modalBold: {
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F0EDE3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
  },
  modalDeleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: Colors.error, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 12px rgba(194,84,80,0.35)' },
    }),
  },
  modalDeleteBtnDisabled: {
    opacity: 0.7,
  },
  modalDeleteText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
  },
});

const desktopStyles = StyleSheet.create({
  listContentDesktop: {
    maxWidth: 960,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 32,
  },
  pageHeaderDesktop: {
    paddingHorizontal: 0,
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  gridItem: {
    flex: 1,
    flexBasis: '48%',
    minWidth: 0,
  },
  cardImageDesktop: {
    width: 160,
    height: 160,
  },
});
