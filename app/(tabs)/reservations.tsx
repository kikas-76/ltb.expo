import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { Ionicons } from '@expo/vector-icons';
import BookingBadge from '@/components/BookingBadge';
import { useUnread } from '@/contexts/UnreadContext';
import { Colors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router, useFocusEffect } from 'expo-router';
import { SkeletonConversationRow } from '@/components/Skeleton';


function describeMessageContent(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === 'file') return `📎 ${parsed.name ?? 'Fichier'}`;
  } catch {}
  if (
    raw.startsWith('private://') ||
    /\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/i.test(raw) ||
    /\/storage\/v1\/object\//.test(raw)
  ) {
    return '📷 Photo';
  }
  return raw;
}

function getReadIdsFromStorage(): Set<string> {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem('readConvIds');
      if (raw) return new Set(JSON.parse(raw));
    } catch {}
  }
  return new Set();
}

function persistReadId(id: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const existing = getReadIdsFromStorage();
      existing.add(id);
      window.sessionStorage.setItem('readConvIds', JSON.stringify([...existing]));
    } catch {}
  }
}

function isReadInStorage(id: string): boolean {
  if (Platform.OS === 'web') return getReadIdsFromStorage().has(id);
  return false;
}

const moduleReadIds = new Set<string>();
const pendingMarkReadIds = new Set<string>();

type ConvDisplayStatus = 'pending' | 'accepted' | 'refused' | 'pending_payment' | 'in_progress' | 'completed' | 'active' | 'pending_return' | 'pending_owner_validation' | 'disputed' | 'cancelled';

interface ConversationItem {
  id: string;
  listingId: string | null;
  listingTitle: string;
  listingThumb: string | null;
  otherUserId: string;
  otherUsername: string;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageTimestamp: number;
  lastMessageIsOwn: boolean;
  unreadCount: number;
  startDate: string;
  endDate: string;
  isIncomingRequest: boolean;
  hasUnreadDot: boolean;
  status: 'pending' | 'accepted' | 'refused' | string;
  displayStatus: ConvDisplayStatus;
  bookingId: string | null;
  bookingStatus: string | null;
  totalPrice: number | null;
  isRequester: boolean;
  listingCity: string | null;
  listingUnavailable: boolean;
  ownerStripeReady: boolean;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return days[date.getDay()];
  }
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function getConvSubtext(displayStatus: ConvDisplayStatus, isRequester: boolean): string | null {
  switch (displayStatus) {
    case 'pending':
      return null;
    case 'accepted':
      return isRequester
        ? 'Finalise ta réservation en payant'
        : 'En attente du paiement du locataire';
    case 'pending_payment':
      return isRequester
        ? 'Paiement en cours de traitement'
        : 'Paiement du locataire en cours';
    case 'active':
      return isRequester
        ? 'Confirme la remise sur place avec le loueur'
        : 'Confirme la remise sur place avec le locataire';
    case 'in_progress':
      return 'Location en cours';
    case 'pending_return':
      return isRequester
        ? 'Confirme le retour sur place avec le loueur'
        : 'Confirme le retour sur place avec le locataire';
    case 'pending_owner_validation':
      return isRequester
        ? 'En attente de la validation du propriétaire'
        : 'Validez l\'état de l\'objet rendu (24h)';
    case 'completed':
      return 'Location terminée';
    case 'refused':
      return 'Demande refusée';
    case 'cancelled':
      return 'Annulée';
    case 'disputed':
      return 'Litige en cours';
    default:
      return null;
  }
}

function PaymentDeadlineBanner({
  stripeReady,
  bookingId,
  totalPrice,
  convId,
}: {
  stripeReady: boolean;
  bookingId: string | null;
  totalPrice: number | null;
  convId: string;
}) {
  const handlePayPress = () => {
    if (bookingId) {
      router.push(`/payment/${bookingId}` as any);
    } else {
      router.push(`/chat/${convId}` as any);
    }
  };

  if (!stripeReady) {
    return (
      <View style={styles.payBannerOrange}>
        <View style={styles.payBannerIconWrap}>
          <Ionicons name="alert-circle-outline" size={13} color="#92400E" />
        </View>
        <Text style={styles.payBannerTextOrange} numberOfLines={2}>
          Le propriétaire n'a pas encore activé son compte de paiement
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.payBannerGreen}
      onPress={handlePayPress}
      activeOpacity={0.85}
    >
      <View style={styles.payBannerIconWrapGreen}>
        <Ionicons name="checkmark-outline" size={13} color="#FFFFFF" />
      </View>
      <View style={styles.payBannerGreenBody}>
        <Text style={styles.payBannerTextGreenBold} numberOfLines={1}>
          Payer maintenant
        </Text>
        {totalPrice != null && (
          <Text style={styles.payBannerTextGreenSub} numberOfLines={1}>
            {totalPrice} € + caution
          </Text>
        )}
      </View>
      <Text style={styles.payBannerArrowGreen}>→</Text>
    </TouchableOpacity>
  );
}

interface ConversationRowProps {
  item: ConversationItem;
  index: number;
  onPress: (id: string) => void | Promise<void>;
  onUserPress: (userId: string) => void;
  onDeleteRequest: (id: string) => void;
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

import { extractCityFromAddress } from '@/lib/address';

function ConversationRow({ item, index, onPress, onUserPress, onDeleteRequest }: ConversationRowProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 60),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const isUnread = item.unreadCount > 0 || item.hasUnreadDot;
  // Anything that's reached a terminal state can be wiped from the
  // user's list. Without 'cancelled' here, an auto-expired
  // pending_payment booking lingered forever because the trash icon
  // never showed up.
  const isDeletable =
    item.displayStatus === 'completed' ||
    item.displayStatus === 'cancelled' ||
    item.status === 'refused' ||
    item.status === 'cancelled' ||
    item.listingUnavailable;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        style={[styles.card, item.isIncomingRequest && styles.cardIncoming, item.listingUnavailable && styles.cardUnavailable]}
        activeOpacity={0.78}
        onPress={() => !item.listingUnavailable && onPress(item.id)}
        onLongPress={isDeletable ? () => onDeleteRequest(item.id) : undefined}
        delayLongPress={500}
      >
        <View style={styles.imageWrap}>
          {item.listingThumb ? (
            <Image source={{ uri: item.listingThumb }} style={styles.listingImage} />
          ) : (
            <View style={styles.listingImageFallback}>
              <Ionicons name="chatbubble-outline" size={22} color={Colors.primary} />
            </View>
          )}
          {item.isIncomingRequest && (
            <View style={styles.incomingDot} />
          )}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={styles.cardTopLeft}>
              {item.isIncomingRequest && (
                <View style={styles.newRequestBadge}>
                  <Ionicons name="notifications-outline" size={9} color="#fff" />
                  <Text style={styles.newRequestBadgeText}>Nouvelle demande</Text>
                </View>
              )}
              <Text style={styles.listingTitle} numberOfLines={1}>
                {item.listingTitle}
              </Text>
            </View>
            <View style={styles.cardTopRight}>
              <Text style={[styles.timeText, isUnread && styles.timeTextUnread]}>
                {item.lastMessageTime}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.ownerName} numberOfLines={1}>
              {item.otherUsername}
            </Text>
            {item.listingCity && (
              <View style={styles.cityBadge}>
                <Ionicons name="location-outline" size={9} color={Colors.primaryDark} />
                <Text style={styles.cityBadgeText}>{item.listingCity}</Text>
              </View>
            )}
          </View>

          <View style={styles.datesRow}>
            <Ionicons name="calendar-outline" size={10} color={Colors.primaryDark} />
            <Text style={styles.datesText}>
              {formatDateShort(item.startDate)} → {formatDateShort(item.endDate)}
            </Text>
            {item.totalPrice != null && (
              <View style={styles.totalPriceChip}>
                <Ionicons name="cash-outline" size={9} color={Colors.primaryDark} />
                <Text style={styles.totalPriceText}>{item.totalPrice}</Text>
              </View>
            )}
          </View>

          {item.listingUnavailable ? (
            <View style={styles.unavailableBanner}>
              <Ionicons name="eye-off-outline" size={13} color="#92400E" />
              <Text style={styles.unavailableBannerText}>
                Annonce supprimée ou masquée · Plus disponible
              </Text>
            </View>
          ) : (
            <>
              <BookingBadge status={item.displayStatus} />
              {(() => {
                const subtext = getConvSubtext(item.displayStatus, item.isRequester);
                if (!subtext) return null;
                return <Text style={styles.statusSubtext}>{subtext}</Text>;
              })()}
              {item.isRequester && item.displayStatus === 'accepted' && item.bookingStatus !== 'active' && item.bookingStatus !== 'cancelled' && (
                <PaymentDeadlineBanner
                  stripeReady={item.ownerStripeReady}
                  bookingId={item.bookingId}
                  totalPrice={item.totalPrice}
                  convId={item.id}
                />
              )}
            </>
          )}

          <View style={styles.cardBottom}>
            <View style={styles.lastMessageRow}>
              {item.lastMessageIsOwn && (
                <Ionicons name="checkmark-done-outline" size={12} color={Colors.primaryDark} />
              )}
              <Text
                style={[styles.lastMessage, isUnread && styles.lastMessageUnread]}
                numberOfLines={1}
              >
                {item.lastMessage}
              </Text>
            </View>
            <View style={styles.cardBottomRight}>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                </View>
              )}
              {isDeletable && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={(e) => { e.stopPropagation?.(); onDeleteRequest(item.id); }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={13} color="#C0392B" />
                  <Text style={styles.deleteBtnLabel}>Supprimer</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MessagesScreen() {
  const { user } = useAuth();
  const { refresh: refreshUnread } = useUnread();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  // stripeReady removed: now computed per-item as ownerStripeReady in buildConversationItem
  const insets = useSafeAreaInsets();
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const { isDesktop } = useResponsive();

  const handleDeleteConversation = async () => {
    if (!deleteModalId) return;
    setDeleteLoading(true);
    setDeleteError(null);

    // Drop the explicit chat_messages DELETE: chat_messages.conversation_id
    // is FK ON DELETE CASCADE, so deleting the conversation auto-cleans the
    // messages. The previous two-step pattern could also race with an
    // incoming message, leaving a child row that broke the cascade.
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', deleteModalId);

    if (error) {
      // Don't optimistically wipe the row — that hid silent failures
      // (the row reappeared on the next refresh and made it look like
      // the delete didn't take). Keep it on screen, surface the error.
      setDeleteError(
        error.message?.includes('permission')
          ? "Tu n'as pas le droit de supprimer cette conversation."
          : 'Suppression impossible. Réessaie dans un instant.',
      );
      setDeleteLoading(false);
      return;
    }

    setConversations((prev) => prev.filter((c) => c.id !== deleteModalId));
    refreshUnread();
    setDeleteLoading(false);
    setDeleteModalId(null);
  };
  const buildConversationItem = useCallback((conv: any, userId: string, ownerStripeReadyMap: Map<string, boolean>): ConversationItem => {
    const listing = Array.isArray(conv.listing) ? conv.listing[0] : conv.listing;
    const requester = Array.isArray(conv.requester) ? conv.requester[0] : conv.requester;
    const owner = Array.isArray(conv.owner) ? conv.owner[0] : conv.owner;
    const msgs: any[] = conv.chat_messages ?? [];
    const booking = Array.isArray(conv.bookings) ? conv.bookings[0] : (conv.bookings ?? null);
    const sorted = [...msgs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const lastMsg = sorted[0];

    const isRequester = conv.requester_id === userId;
    const other = isRequester ? owner : requester;
    const otherUsername = other?.username ?? 'Utilisateur';
    const thumb = listing?.photos_url?.[0] ?? null;
    const lastContent = lastMsg
      ? describeMessageContent(lastMsg.content)
      : `Du ${conv.start_date} au ${conv.end_date}`;
    const lastTimestamp = lastMsg ? new Date(lastMsg.created_at).getTime() : new Date(conv.created_at).getTime();
    const lastTime = lastMsg ? formatTime(lastMsg.created_at) : formatTime(conv.created_at);
    const lastIsOwn = lastMsg ? lastMsg.sender_id === userId : false;

    const unreadMsgs = msgs.filter((m) => m.sender_id !== null && m.sender_id !== userId && !m.is_read);
    if (unreadMsgs.length === 0) {
      moduleReadIds.delete(conv.id);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
        try {
          const existing = getReadIdsFromStorage();
          existing.delete(conv.id);
          window.sessionStorage.setItem('readConvIds', JSON.stringify([...existing]));
        } catch {}
      }
    }
    const alreadyReadLocally = moduleReadIds.has(conv.id) || pendingMarkReadIds.has(conv.id) || isReadInStorage(conv.id);
    const hasUnread = !alreadyReadLocally && unreadMsgs.length > 0;

    const convStatus = (conv.status as 'pending' | 'accepted' | 'refused') ?? 'pending';
    const hasUnreadFromRequester = !isRequester && hasUnread && convStatus === 'pending';

    const rawStatus = (conv.status as string) ?? 'pending';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startD = new Date(conv.start_date);
    const endD = new Date(conv.end_date);
    const bookingStatusRaw = booking?.status ?? null;

    let displayStatus: ConvDisplayStatus;
    if (bookingStatusRaw && ['pending_payment', 'active', 'in_progress', 'pending_return', 'pending_owner_validation', 'completed', 'disputed', 'cancelled'].includes(bookingStatusRaw)) {
      displayStatus = bookingStatusRaw as ConvDisplayStatus;
    } else if (rawStatus === 'refused' || rawStatus === 'rejected') {
      displayStatus = 'refused';
    } else if (rawStatus === 'accepted') {
      displayStatus = 'accepted';
    } else {
      displayStatus = rawStatus as ConvDisplayStatus;
    }

    // Owner's location_data is no longer joinable (RGPD: revoked from
    // authenticated GRANT). City label is left blank in the conversation
    // list; the listing's exact address only appears via
    // get_listing_exact_location after a booking exists.
    const listingCity: string | null = null;

    // Owner Stripe readiness pulled from the batch-fetched map (filled in fetchConversations)
    const ownerStripeReady = isRequester && displayStatus === 'accepted'
      ? (ownerStripeReadyMap.get(conv.owner_id) ?? false)
      : true;

    return {
      id: conv.id,
      listingId: conv.listing_id,
      listingTitle: listing?.name ?? 'Annonce',
      listingThumb: thumb,
      otherUserId: isRequester ? conv.owner_id : conv.requester_id,
      otherUsername,
      lastMessage: lastContent,
      lastMessageTime: lastTime,
      lastMessageTimestamp: lastTimestamp,
      lastMessageIsOwn: lastIsOwn,
      unreadCount: hasUnread ? unreadMsgs.length : 0,
      startDate: conv.start_date,
      endDate: conv.end_date,
      isIncomingRequest: hasUnreadFromRequester,
      hasUnreadDot: hasUnread,
      status: rawStatus,
      displayStatus,
      bookingId: booking?.id ?? null,
      bookingStatus: booking?.status ?? null,
      totalPrice: booking?.total_price ?? null,
      isRequester,
      listingCity,
      listingUnavailable: rawStatus === 'pending' && (!listing || listing.is_active === false),
      ownerStripeReady,
    };
  }, []);

  // fetchStripeStatus removed: stripe readiness is now per-owner in buildConversationItem

  const fetchConversations = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        listing_id,
        requester_id,
        owner_id,
        start_date,
        end_date,
        created_at,
        status,
        listing:listings!conversations_listing_id_fkey(name, photos_url, is_active),
        requester:profiles!conversations_requester_id_fkey(username, photo_url, avatar_url),
        owner:profiles!conversations_owner_id_fkey(username, photo_url, avatar_url),
        chat_messages(id, content, sender_id, is_system, is_read, created_at),
        bookings(id, total_price, status, start_date, end_date)
      `)
      .or(`requester_id.eq.${user.id},owner_id.eq.${user.id}`);

    if (error || !data) { setLoading(false); return; }

    const ownerIdsToCheck = Array.from(new Set(
      data
        .filter((conv: any) => conv.requester_id === user.id && conv.status === 'accepted')
        .map((conv: any) => conv.owner_id)
    ));

    const ownerStripeReadyMap = new Map<string, boolean>();
    if (ownerIdsToCheck.length > 0) {
      // stripe_* columns aren't in the authenticated grant on profiles.
      // Resolve each accepted-conversation owner through the
      // get_owner_stripe_ready RPC (auth-checked: only counterparties
      // can ask). The list is bounded by the user's accepted requests,
      // which is small in practice.
      const results = await Promise.all(
        ownerIdsToCheck.map((ownerId) =>
          supabase
            .rpc('get_owner_stripe_ready', { p_owner_id: ownerId })
            .then(({ data }) => [ownerId, data === true] as const),
        ),
      );
      for (const [ownerId, ready] of results) {
        ownerStripeReadyMap.set(ownerId, ready);
      }
    }

    const items: ConversationItem[] = data
      .map((conv: any) => buildConversationItem(conv, user.id, ownerStripeReadyMap))
      .sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);

    setConversations(items);
    setLoading(false);
    refreshUnread();
  }, [user, refreshUnread, buildConversationItem]);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const convId = payload.new?.conversation_id;
          if (convId) moduleReadIds.delete(convId);
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings' },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings' },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  const handleConvPress = async (id: string) => {
    moduleReadIds.add(id);
    pendingMarkReadIds.add(id);
    persistReadId(id);
    setConversations((prev) =>
      prev.map((c) => c.id === id ? { ...c, isIncomingRequest: false, unreadCount: 0, hasUnreadDot: false } : c)
    );
    if (user?.id) {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('conversation_id', id)
        .neq('sender_id', user.id)
        .eq('is_read', false);
      pendingMarkReadIds.delete(id);
      await refreshUnread();
    }
    if (isDesktop && Platform.OS === 'web') {
      setSelectedConvId(id);
    } else {
      router.push(`/chat/${id}` as any);
    }
  };

  const conversationList = (
    <>
      <View style={[styles.infoBanner, isDesktop && { marginHorizontal: 0 }]}>
        <View style={styles.infoBannerLeft}>
          <View style={styles.infoBannerIconWrap}>
            <Ionicons name="calendar-outline" size={20} color="#fff" />
          </View>
          <View style={styles.infoBannerBody}>
            <Text style={styles.infoBannerTitle}>Organisez vos locations</Text>
            <Text style={styles.infoBannerText}>
              Coordonnez vos emprunts et mises en location directement ici.
            </Text>
          </View>
        </View>
        <View style={styles.infoBannerAccent}>
          <Ionicons name="chatbubble-outline" size={28} color="rgba(255,255,255,0.18)" />
        </View>
      </View>

      {!loading && conversations.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Ionicons name="cube-outline" size={14} color={Colors.primaryDark} />
            <Text style={styles.statChipText}>
              {conversations.length} échange{conversations.length > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      )}

      {loading ? (
        <View>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonConversationRow key={i} />)}
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="chatbubble-outline" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Aucun message</Text>
          <Text style={styles.emptySubtitle}>
            Vos échanges avec les locataires et propriétaires apparaîtront ici.
          </Text>
        </View>
      ) : (
        conversations.map((item, index) => (
          <ConversationRow
            key={item.id}
            item={item}
            index={index}
            onPress={handleConvPress}
            onUserPress={(userId) => router.push(`/owner/${userId}` as any)}
            onDeleteRequest={(id) => setDeleteModalId(id)}
          />
        ))
      )}
    </>
  );

  const deleteModal = (
    <Modal
      visible={deleteModalId !== null}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!deleteLoading) {
          setDeleteError(null);
          setDeleteModalId(null);
        }
      }}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => {
          if (!deleteLoading) {
            setDeleteError(null);
            setDeleteModalId(null);
          }
        }}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalIconWrap}>
            <Ionicons name="trash-outline" size={24} color="#C0392B" />
          </View>
          <Text style={styles.modalTitle}>Supprimer la conversation</Text>
          <Text style={styles.modalDesc}>
            Cette action supprimera définitivement la conversation et tous ses messages. Cette action est irréversible.
          </Text>
          {deleteError && (
            <Text style={styles.modalErrorText}>{deleteError}</Text>
          )}
          <TouchableOpacity
            style={[styles.modalBtnDelete, deleteLoading && { opacity: 0.65 }]}
            onPress={handleDeleteConversation}
            disabled={deleteLoading}
            activeOpacity={0.85}
          >
            {deleteLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={15} color="#fff" />
                <Text style={styles.modalBtnDeleteText}>Supprimer</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalBtnCancel}
            onPress={() => {
              setDeleteError(null);
              setDeleteModalId(null);
            }}
            disabled={deleteLoading}
            activeOpacity={0.75}
          >
            <Text style={styles.modalBtnCancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  if (isDesktop && Platform.OS === 'web') {
    return (
      <View style={desktopStyles.root}>
        <View style={desktopStyles.leftCol}>
          <View style={desktopStyles.leftHeader}>
            <Text style={desktopStyles.leftHeaderTitle}>Messages</Text>
            <Text style={desktopStyles.leftHeaderSub}>
              {conversations.length > 0
                ? `${conversations.length} échange${conversations.length > 1 ? 's' : ''}`
                : 'Retrouvez ici vos échanges'}
            </Text>
          </View>

          <View style={desktopStyles.infoBannerDesktop}>
            <View style={desktopStyles.infoBannerDesktopLeft}>
              <View style={desktopStyles.infoBannerDesktopIcon}>
                <Ionicons name="calendar-outline" size={16} color="#fff" />
              </View>
              <Text style={desktopStyles.infoBannerDesktopText}>Organisez vos locations</Text>
            </View>
            {conversations.length > 0 && (
              <View style={desktopStyles.exchangesBadge}>
                <Text style={desktopStyles.exchangesBadgeText}>
                  {conversations.length} échange{conversations.length > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={desktopStyles.listContent}
          >
            {loading ? (
              <View>
                {Array.from({ length: 6 }).map((_, i) => <SkeletonConversationRow key={i} />)}
              </View>
            ) : conversations.length === 0 ? (
              <View style={desktopStyles.emptyLeft}>
                <View style={desktopStyles.emptyLeftIcon}>
                  <Ionicons name="chatbubble-outline" size={32} color={Colors.primary} />
                </View>
                <Text style={desktopStyles.emptyLeftTitle}>Aucun message</Text>
                <Text style={desktopStyles.emptyLeftSub}>
                  Vos échanges apparaîtront ici.
                </Text>
              </View>
            ) : (
              conversations.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    desktopStyles.convRow,
                    selectedConvId === item.id && desktopStyles.convRowSelected,
                    item.isIncomingRequest && desktopStyles.convRowIncoming,
                  ]}
                  activeOpacity={0.78}
                  onPress={() => !item.listingUnavailable && handleConvPress(item.id)}
                  onLongPress={
                    (item.displayStatus === 'completed' || item.status === 'refused' || item.listingUnavailable)
                      ? () => setDeleteModalId(item.id)
                      : undefined
                  }
                  delayLongPress={500}
                >
                  <View style={desktopStyles.convRowImg}>
                    {item.listingThumb ? (
                      <Image source={{ uri: item.listingThumb }} style={desktopStyles.convRowImage} />
                    ) : (
                      <View style={desktopStyles.convRowImageFallback}>
                        <Ionicons name="cube-outline" size={20} color={Colors.primary} />
                      </View>
                    )}
                    {(item.unreadCount > 0 || item.hasUnreadDot) && (
                      <View style={desktopStyles.unreadDot} />
                    )}
                  </View>
                  <View style={desktopStyles.convRowBody}>
                    <View style={desktopStyles.convRowTop}>
                      <Text style={[desktopStyles.convRowTitle, (item.unreadCount > 0 || item.hasUnreadDot) && desktopStyles.convRowTitleUnread]} numberOfLines={1}>
                        {item.listingTitle}
                      </Text>
                      <Text style={desktopStyles.convRowTime}>{item.lastMessageTime}</Text>
                    </View>
                    <Text style={desktopStyles.convRowUser} numberOfLines={1}>{item.otherUsername}</Text>
                    <Text style={[desktopStyles.convRowLast, (item.unreadCount > 0 || item.hasUnreadDot) && desktopStyles.convRowLastUnread]} numberOfLines={1}>
                      {item.lastMessage}
                    </Text>
                    <View style={desktopStyles.convRowFooter}>
                      <BookingBadge status={item.displayStatus} />
                      {item.unreadCount > 0 && (
                        <View style={desktopStyles.unreadBadge}>
                          <Text style={desktopStyles.unreadBadgeText}>{item.unreadCount}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>

        <View style={desktopStyles.rightCol}>
          {selectedConvId ? (() => {
            const conv = conversations.find((c) => c.id === selectedConvId);
            if (!conv) return null;
            return (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={desktopStyles.detailContent}>
                {conv.listingThumb ? (
                  <Image source={{ uri: conv.listingThumb }} style={desktopStyles.detailBanner} resizeMode="cover" />
                ) : (
                  <View style={[desktopStyles.detailBanner, { backgroundColor: Colors.primarySurface }]} />
                )}
                <View style={desktopStyles.detailBody}>
                  <Text style={desktopStyles.detailTitle}>{conv.listingTitle}</Text>
                  <Text style={desktopStyles.detailWith}>Avec {conv.otherUsername}</Text>
                  <BookingBadge status={conv.displayStatus} />
                  <View style={desktopStyles.detailDates}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.primaryDark} />
                    <Text style={desktopStyles.detailDatesText}>
                      {new Date(conv.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {' → '}
                      {new Date(conv.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                  </View>
                  {conv.totalPrice != null && (
                    <View style={desktopStyles.detailPrice}>
                      <Ionicons name="cash-outline" size={16} color={Colors.primaryDark} />
                      <Text style={desktopStyles.detailPriceText}>{conv.totalPrice} € total</Text>
                    </View>
                  )}
                  <View style={desktopStyles.detailLastMsg}>
                    <Text style={desktopStyles.detailLastMsgLabel}>Dernier message</Text>
                    <Text style={desktopStyles.detailLastMsgText}>{conv.lastMessage}</Text>
                    <Text style={desktopStyles.detailLastMsgTime}>{conv.lastMessageTime}</Text>
                  </View>
                  <TouchableOpacity
                    style={desktopStyles.openChatBtn}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/chat/${selectedConvId}` as any)}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                    <Text style={desktopStyles.openChatBtnText}>Ouvrir la conversation</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            );
          })() : (
            <View style={desktopStyles.emptyRight}>
              <View style={desktopStyles.emptyRightIcon}>
                <Ionicons name="chatbubble-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={desktopStyles.emptyRightTitle}>Sélectionnez une conversation</Text>
              <Text style={desktopStyles.emptyRightSub}>
                Cliquez sur une conversation dans la liste pour l'afficher ici.
              </Text>
            </View>
          )}
        </View>
        {deleteModal}
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSubtitle}>
          {conversations.length > 0
            ? `${conversations.length} conversation${conversations.length > 1 ? 's' : ''} en cours`
            : 'Retrouvez ici vos échanges'}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
      >
        {conversationList}
      </ScrollView>
      {deleteModal}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 30,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    letterSpacing: -0.7,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
    marginTop: 3,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryDark,
    borderRadius: 18,
    padding: 16,
    marginBottom: 4,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 4 },
      web: { boxShadow: `0 4px 14px rgba(142,152,120,0.35)` },
    }),
  },
  infoBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  infoBannerAccent: {
    marginLeft: 8,
  },
  infoBannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoBannerBody: { flex: 1, gap: 3 },
  infoBannerTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    letterSpacing: -0.2,
  },
  infoBannerText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 17,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primarySurface,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  statChipText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: Colors.primaryDark,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
    }),
  },
  cardIncoming: {
    borderColor: '#C8B28A',
    backgroundColor: '#FFFBF3',
    ...Platform.select({
      ios: { shadowColor: '#C8913A', shadowOpacity: 0.12, shadowRadius: 10 },
      android: { elevation: 3 },
      web: { boxShadow: '0 2px 10px rgba(200,145,58,0.14)' },
    }),
  },
  cardUnavailable: {
    opacity: 0.6,
    borderColor: '#D0CCC0',
    backgroundColor: '#F2F0E8',
  },
  unavailableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  unavailableBannerText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: '#92400E',
    flex: 1,
  },
  progressContainer: {
    marginTop: 6,
    marginBottom: 2,
  },
  imageWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  incomingDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.notification,
    borderWidth: 2,
    borderColor: '#FFFBF3',
  },
  cardTopLeft: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  cardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primaryDark,
  },
  newRequestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.notification,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  newRequestBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    letterSpacing: 0.2,
  },
  listingImage: {
    width: 64,
    height: 64,
    borderRadius: 14,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#E8E4D6',
  },
  listingImageFallback: {
    width: 64,
    height: 64,
    borderRadius: 14,
    flexShrink: 0,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  cardBody: { flex: 1, gap: 3, minWidth: 0 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  listingTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  timeText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
    marginTop: 1,
  },
  timeTextUnread: { color: Colors.primaryDark, fontFamily: 'Inter-SemiBold' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  ownerName: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: Colors.primaryDark,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  cityBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: Colors.primaryDark,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  lastMessage: { fontSize: 13, fontFamily: 'Inter-Regular', color: Colors.textMuted, flex: 1 },
  lastMessageUnread: { color: '#3A3A3A', fontFamily: 'Inter-Medium' },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    flexShrink: 0,
  },
  unreadBadgeText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#fff' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginBottom: 2,
    borderWidth: 1,
  },
  statusPillAccepted: {
    backgroundColor: '#F0FBF2',
    borderColor: '#B7DFC0',
  },
  statusPillRefused: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusPillPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginBottom: 2,
    borderWidth: 1,
    backgroundColor: '#FBF3E0',
    borderColor: '#F0D898',
  },
  statusPillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
  },
  statusPillTextAccepted: { color: '#2A7A3A' },
  statusPillTextRefused: { color: Colors.error },
  statusPillTextPending: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: '#8B6A3A',
  },
  statusPillInProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginBottom: 2,
    borderWidth: 1,
    backgroundColor: '#EDF4FF',
    borderColor: '#AECEF5',
  },
  statusPillTextInProgress: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: '#1A5FAD',
  },
  statusPillCompleted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginBottom: 2,
    borderWidth: 1,
    backgroundColor: '#F4F4F4',
    borderColor: '#D0D0D0',
  },
  statusPillTextCompleted: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: Colors.textSecondary,
  },
  statusSubtext: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 2,
    lineHeight: 15,
  },
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
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
  emptyTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: Colors.text, marginBottom: 8 },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  cardBottomRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteBtnLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: '#C0392B',
    letterSpacing: 0.1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20 },
      android: { elevation: 10 },
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.15)' },
    }),
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.text,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  modalDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 4,
  },
  modalBtnDelete: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  modalBtnDeleteText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#fff',
  },
  modalBtnCancel: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#F0EDE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancelText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.textSecondary,
  },
  modalErrorText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#C0392B',
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 8,
  },
  payBannerOrange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 4,
    marginBottom: 2,
  },
  payBannerIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  payBannerTextOrange: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },
  payBannerArrow: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    color: '#92400E',
    flexShrink: 0,
  },
  payBannerRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 4,
    marginBottom: 2,
  },
  payBannerIconWrapRed: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  payBannerTextRed: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: '#991B1B',
    lineHeight: 15,
  },
  payBannerArrowRed: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    color: '#991B1B',
    flexShrink: 0,
  },
  payBannerGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.primaryDark,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 2,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6 },
      android: { elevation: 3 },
      web: { boxShadow: '0 2px 8px rgba(27,67,50,0.3)' },
    }),
  },
  payBannerIconWrapGreen: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  payBannerGreenBody: {
    flex: 1,
    gap: 1,
  },
  payBannerTextGreenBold: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    color: '#FFFFFF',
    lineHeight: 16,
  },
  payBannerTextGreenSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 14,
  },
  payBannerArrowGreen: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    color: '#FFFFFF',
    flexShrink: 0,
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  datesText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.primaryDark,
    flex: 1,
  },
  totalPriceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.primarySurface,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  totalPriceText: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    color: Colors.primaryDark,
  },
});

const desktopStyles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FDFBF5',
  },
  leftCol: {
    width: 420,
    flexShrink: 0,
    borderRightWidth: 1,
    borderRightColor: '#e8e4d8',
    backgroundColor: Colors.background,
    ...Platform.select({ web: { height: '100vh' as any, overflow: 'hidden' as any } }),
    flexDirection: 'column',
  },
  leftHeader: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e4d8',
  },
  leftHeaderTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 26,
    color: Colors.text,
    letterSpacing: -0.6,
  },
  leftHeaderSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 3,
  },
  infoBannerDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryDark,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  infoBannerDesktopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  infoBannerDesktopIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBannerDesktopText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#fff',
  },
  exchangesBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  exchangesBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: '#fff',
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 32,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyLeft: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyLeftIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4DAC4',
    marginBottom: 16,
  },
  emptyLeftTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.text,
    marginBottom: 6,
  },
  emptyLeftSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0ede3',
    backgroundColor: 'transparent',
    ...Platform.select({ web: { cursor: 'pointer' as any } }),
  },
  convRowSelected: {
    backgroundColor: '#eef2df',
    borderBottomColor: '#d8e0c4',
  },
  convRowIncoming: {
    backgroundColor: '#FFFBF3',
    borderBottomColor: '#F0D898',
  },
  convRowImg: {
    position: 'relative',
    flexShrink: 0,
  },
  convRowImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E4D6',
  },
  convRowImageFallback: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2f3a2f',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  convRowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  convRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  convRowTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
    flex: 1,
    letterSpacing: -0.1,
  },
  convRowTitleUnread: {
    fontFamily: 'Inter-Bold',
  },
  convRowTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    flexShrink: 0,
  },
  convRowUser: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.primaryDark,
  },
  convRowLast: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  convRowLastUnread: {
    color: '#3A3A3A',
    fontFamily: 'Inter-Medium',
  },
  convRowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2f3a2f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    color: '#fff',
  },
  rightCol: {
    flex: 1,
    backgroundColor: '#FDFBF5',
    ...Platform.select({ web: { height: '100vh' as any } }),
  },
  detailContent: {
    paddingBottom: 40,
  },
  detailBanner: {
    width: '100%',
    height: 220,
  },
  detailBody: {
    padding: 28,
    gap: 16,
  },
  detailTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  detailWith: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.primaryDark,
    marginTop: -8,
  },
  detailDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primarySurface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  detailDatesText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.text,
    flex: 1,
    lineHeight: 20,
  },
  detailPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailPriceText: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  detailLastMsg: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
    }),
  },
  detailLastMsgLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailLastMsgText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  detailLastMsgTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  openChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2f3a2f',
    borderRadius: 999,
    height: 52,
    marginTop: 8,
    ...Platform.select({
      web: { boxShadow: '0 4px 14px rgba(47,58,47,0.3)', cursor: 'pointer' as any },
    }),
  },
  openChatBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#fff',
  },
  emptyRight: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 48,
  },
  emptyRightIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4DAC4',
    marginBottom: 8,
  },
  emptyRightTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.text,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  emptyRightSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
});
