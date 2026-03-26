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
import { MessageCircle, CheckCheck, CalendarDays, Package, Bell, Check, CircleX, Clock, CirclePlay as PlayCircle, CircleCheck as CheckCircle2, Trash2, CircleAlert as AlertCircle, Euro, Wallet, MapPin } from 'lucide-react-native';
import { useUnread } from '@/contexts/UnreadContext';
import { Colors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router, useFocusEffect } from 'expo-router';

const BG = '#F5F2E3';
const GREEN = '#B7BF9C';
const GREEN_DARK = '#8E9878';
const GREEN_LIGHT = '#ECEEE6';
const CREAM = '#FFFDF7';

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

type ConvDisplayStatus = 'pending' | 'accepted' | 'refused' | 'in_progress' | 'completed';

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
  status: 'pending' | 'accepted' | 'refused';
  displayStatus: ConvDisplayStatus;
  bookingId: string | null;
  bookingStatus: string | null;
  totalPrice: number | null;
  isRequester: boolean;
  listingCity: string | null;
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

function StatusPill({ displayStatus }: { displayStatus: ConvDisplayStatus }) {
  const configs: Record<ConvDisplayStatus, { icon: React.ReactNode; label: string; containerStyle: any; textStyle: any }> = {
    pending: {
      icon: <Clock size={9} color="#8B6A3A" strokeWidth={2.5} />,
      label: 'En attente',
      containerStyle: styles.statusPillPending,
      textStyle: styles.statusPillTextPending,
    },
    accepted: {
      icon: <Check size={9} color="#2A7A3A" strokeWidth={3} />,
      label: 'Acceptée',
      containerStyle: [styles.statusPill, styles.statusPillAccepted],
      textStyle: [styles.statusPillText, styles.statusPillTextAccepted],
    },
    refused: {
      icon: <CircleX size={9} color="#C0392B" strokeWidth={2.5} />,
      label: 'Refusée',
      containerStyle: [styles.statusPill, styles.statusPillRefused],
      textStyle: [styles.statusPillText, styles.statusPillTextRefused],
    },
    in_progress: {
      icon: <PlayCircle size={9} color="#1A5FAD" strokeWidth={2.5} />,
      label: 'En cours',
      containerStyle: styles.statusPillInProgress,
      textStyle: styles.statusPillTextInProgress,
    },
    completed: {
      icon: <CheckCircle2 size={9} color="#5A5A5A" strokeWidth={2.5} />,
      label: 'Terminée',
      containerStyle: styles.statusPillCompleted,
      textStyle: styles.statusPillTextCompleted,
    },
  };
  const cfg = configs[displayStatus];
  return (
    <View style={cfg.containerStyle}>
      {cfg.icon}
      <Text style={cfg.textStyle}>{cfg.label}</Text>
    </View>
  );
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
      <TouchableOpacity
        style={styles.payBannerOrange}
        onPress={() => router.push('/wallet' as any)}
        activeOpacity={0.85}
      >
        <View style={styles.payBannerIconWrap}>
          <Wallet size={13} color="#92400E" strokeWidth={2.5} />
        </View>
        <Text style={styles.payBannerTextOrange} numberOfLines={2}>
          Active ton compte pour procéder au paiement
        </Text>
        <Text style={styles.payBannerArrow}>→</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.payBannerGreen}
      onPress={handlePayPress}
      activeOpacity={0.85}
    >
      <View style={styles.payBannerIconWrapGreen}>
        <Check size={13} color="#FFFFFF" strokeWidth={3} />
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
  stripeReady: boolean;
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function extractCityFromAddress(address?: string | null): string | null {
  if (!address) return null;
  const parts = address.split(',');
  if (parts.length >= 2) {
    const cityPart = parts[parts.length - 2].trim();
    const match = cityPart.match(/^\d{4,6}\s+(.+)$/);
    if (match) return match[1].trim();
    return cityPart;
  }
  return null;
}

function ConversationRow({ item, index, onPress, onUserPress, onDeleteRequest, stripeReady }: ConversationRowProps) {
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
  const isDeletable = item.displayStatus === 'completed' || item.status === 'refused';

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        style={[styles.card, item.isIncomingRequest && styles.cardIncoming]}
        activeOpacity={0.78}
        onPress={() => onPress(item.id)}
        onLongPress={isDeletable ? () => onDeleteRequest(item.id) : undefined}
        delayLongPress={500}
      >
        <View style={styles.imageWrap}>
          {item.listingThumb ? (
            <Image source={{ uri: item.listingThumb }} style={styles.listingImage} />
          ) : (
            <View style={styles.listingImageFallback}>
              <MessageCircle size={22} color={GREEN} strokeWidth={1.5} />
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
                  <Bell size={9} color="#fff" strokeWidth={2.5} />
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
                <MapPin size={9} color={GREEN_DARK} strokeWidth={2.5} />
                <Text style={styles.cityBadgeText}>{item.listingCity}</Text>
              </View>
            )}
          </View>

          <View style={styles.datesRow}>
            <CalendarDays size={10} color={GREEN_DARK} strokeWidth={2} />
            <Text style={styles.datesText}>
              {formatDateShort(item.startDate)} → {formatDateShort(item.endDate)}
            </Text>
            {item.totalPrice != null && (
              <View style={styles.totalPriceChip}>
                <Euro size={9} color={GREEN_DARK} strokeWidth={2.5} />
                <Text style={styles.totalPriceText}>{item.totalPrice}</Text>
              </View>
            )}
          </View>

          <StatusPill displayStatus={item.displayStatus} />

          {item.isRequester && item.displayStatus === 'accepted' && item.bookingStatus !== 'active' && (
            <PaymentDeadlineBanner
              stripeReady={stripeReady}
              bookingId={item.bookingId}
              totalPrice={item.totalPrice}
              convId={item.id}
            />
          )}

          <View style={styles.cardBottom}>
            <View style={styles.lastMessageRow}>
              {item.lastMessageIsOwn && (
                <CheckCheck size={12} color={GREEN_DARK} strokeWidth={2} />
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
                  <Trash2 size={14} color="#C0392B" strokeWidth={2} />
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
  const [stripeReady, setStripeReady] = useState(false);
  const insets = useSafeAreaInsets();
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const { isDesktop } = useResponsive();

  const handleDeleteConversation = async () => {
    if (!deleteModalId) return;
    setDeleteLoading(true);
    await supabase.from('chat_messages').delete().eq('conversation_id', deleteModalId);
    await supabase.from('conversations').delete().eq('id', deleteModalId);
    setConversations((prev) => prev.filter((c) => c.id !== deleteModalId));
    refreshUnread();
    setDeleteLoading(false);
    setDeleteModalId(null);
  };
  const buildConversationItem = useCallback((conv: any, userId: string): ConversationItem => {
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
    const lastContent = lastMsg?.content ?? `Du ${conv.start_date} au ${conv.end_date}`;
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

    const rawStatus = (conv.status as 'pending' | 'accepted' | 'refused') ?? 'pending';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startD = new Date(conv.start_date);
    const endD = new Date(conv.end_date);
    let displayStatus: ConvDisplayStatus = rawStatus;
    if (rawStatus === 'accepted') {
      if (today > endD) displayStatus = 'completed';
      else if (today >= startD) displayStatus = 'in_progress';
      else displayStatus = 'accepted';
    }

    const listingCity =
      listing?.location_data?.city ||
      extractCityFromAddress(listing?.location_data?.address) ||
      null;

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
    };
  }, []);

  const fetchStripeStatus = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('stripe_onboarding_complete')
      .eq('id', user.id)
      .maybeSingle();
    setStripeReady(data?.stripe_onboarding_complete === true);
  }, [user]);

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
        listing:listings!conversations_listing_id_fkey(name, photos_url, location_data),
        requester:profiles!conversations_requester_id_fkey(username, photo_url, avatar_url),
        owner:profiles!conversations_owner_id_fkey(username, photo_url, avatar_url),
        chat_messages(id, content, sender_id, is_system, is_read, created_at),
        bookings(id, total_price, status, start_date, end_date)
      `)
      .or(`requester_id.eq.${user.id},owner_id.eq.${user.id}`);

    if (error || !data) { setLoading(false); return; }

    const items: ConversationItem[] = data
      .map((conv: any) => buildConversationItem(conv, user.id))
      .sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);

    setConversations(items);
    setLoading(false);
    refreshUnread();
  }, [user, refreshUnread, buildConversationItem]);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
      fetchStripeStatus();
    }, [fetchConversations, fetchStripeStatus])
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
            <CalendarDays size={20} color="#fff" strokeWidth={2} />
          </View>
          <View style={styles.infoBannerBody}>
            <Text style={styles.infoBannerTitle}>Organisez vos locations</Text>
            <Text style={styles.infoBannerText}>
              Coordonnez vos emprunts et mises en location directement ici.
            </Text>
          </View>
        </View>
        <View style={styles.infoBannerAccent}>
          <MessageCircle size={28} color="rgba(255,255,255,0.18)" strokeWidth={1.5} />
        </View>
      </View>

      {!loading && conversations.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Package size={14} color={GREEN_DARK} strokeWidth={2} />
            <Text style={styles.statChipText}>
              {conversations.length} échange{conversations.length > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <MessageCircle size={36} color={GREEN} strokeWidth={1.5} />
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
            stripeReady={stripeReady}
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
      onRequestClose={() => !deleteLoading && setDeleteModalId(null)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => !deleteLoading && setDeleteModalId(null)}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalIconWrap}>
            <Trash2 size={24} color="#C0392B" strokeWidth={2} />
          </View>
          <Text style={styles.modalTitle}>Supprimer la conversation</Text>
          <Text style={styles.modalDesc}>
            Cette action supprimera définitivement la conversation et tous ses messages. Cette action est irréversible.
          </Text>
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
                <Trash2 size={15} color="#fff" strokeWidth={2} />
                <Text style={styles.modalBtnDeleteText}>Supprimer</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalBtnCancel}
            onPress={() => setDeleteModalId(null)}
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
      <View style={[desktopStyles.root, { backgroundColor: BG }]}>
        <View style={desktopStyles.leftCol}>
          <View style={desktopStyles.leftHeader}>
            <Text style={styles.headerTitle}>Messages</Text>
            <Text style={styles.headerSubtitle}>
              {conversations.length > 0
                ? `${conversations.length} conversation${conversations.length > 1 ? 's' : ''} en cours`
                : 'Retrouvez ici vos échanges'}
            </Text>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[desktopStyles.listContent]}
          >
            {conversationList}
          </ScrollView>
        </View>

        <View style={desktopStyles.rightCol}>
          {selectedConvId ? (() => {
            const conv = conversations.find((c) => c.id === selectedConvId);
            if (!conv) return null;
            return (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={desktopStyles.detailContent}>
                {conv.listingThumb ? (
                  <Image source={{ uri: conv.listingThumb }} style={desktopStyles.detailBanner} />
                ) : (
                  <View style={[desktopStyles.detailBanner, { backgroundColor: GREEN_LIGHT }]} />
                )}
                <View style={desktopStyles.detailBody}>
                  <Text style={desktopStyles.detailTitle}>{conv.listingTitle}</Text>
                  <Text style={desktopStyles.detailWith}>Avec {conv.otherUsername}</Text>
                  <StatusPill displayStatus={conv.displayStatus} />
                  <View style={desktopStyles.detailDates}>
                    <CalendarDays size={14} color={GREEN_DARK} strokeWidth={2} />
                    <Text style={desktopStyles.detailDatesText}>
                      {new Date(conv.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {' → '}
                      {new Date(conv.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                  </View>
                  {conv.totalPrice != null && (
                    <View style={desktopStyles.detailPrice}>
                      <Euro size={16} color={GREEN_DARK} strokeWidth={2} />
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
                    <MessageCircle size={18} color="#fff" strokeWidth={2} />
                    <Text style={desktopStyles.openChatBtnText}>Ouvrir la conversation</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            );
          })() : (
            <View style={desktopStyles.emptyRight}>
              <View style={desktopStyles.emptyRightIcon}>
                <MessageCircle size={40} color={GREEN} strokeWidth={1.5} />
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
    <View style={[styles.root, { backgroundColor: BG }]}>
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
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 30,
    fontFamily: 'Inter-Bold',
    color: '#1A1F17',
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
    backgroundColor: GREEN_DARK,
    borderRadius: 18,
    padding: 16,
    marginBottom: 4,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: GREEN_DARK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
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
    backgroundColor: GREEN_LIGHT,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  statChipText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: GREEN_DARK,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CREAM,
    borderRadius: 18,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: '#EAE6D8',
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
    backgroundColor: '#E05252',
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
    backgroundColor: GREEN_DARK,
  },
  newRequestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E05252',
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
    backgroundColor: GREEN_LIGHT,
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
    color: '#1A1F17',
    letterSpacing: -0.2,
  },
  timeText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
    marginTop: 1,
  },
  timeTextUnread: { color: GREEN_DARK, fontFamily: 'Inter-SemiBold' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  ownerName: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: GREEN_DARK,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: GREEN_LIGHT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  cityBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: GREEN_DARK,
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
    backgroundColor: GREEN,
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
  statusPillTextRefused: { color: '#C0392B' },
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
    color: '#5A5A5A',
  },
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: GREEN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1A1F17', marginBottom: 8 },
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
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalSheet: {
    backgroundColor: CREAM,
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
    color: '#1A1F17',
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
    backgroundColor: '#C0392B',
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
    color: '#5A5A5A',
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
    backgroundColor: '#1B4332',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 2,
    ...Platform.select({
      ios: { shadowColor: '#1B4332', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6 },
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
    color: GREEN_DARK,
    flex: 1,
  },
  totalPriceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  totalPriceText: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    color: GREEN_DARK,
  },
});

const desktopStyles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  leftCol: {
    width: '38%',
    maxWidth: 420,
    borderRightWidth: 1,
    borderRightColor: '#E0DDD0',
    backgroundColor: BG,
  },
  leftHeader: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0DDD0',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 10,
  },
  rightCol: {
    flex: 1,
    backgroundColor: '#FDFBF5',
  },
  detailContent: {
    paddingBottom: 40,
  },
  detailBanner: {
    width: '100%',
    height: 220,
    resizeMode: 'cover',
  },
  detailBody: {
    padding: 32,
    gap: 16,
  },
  detailTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: '#1A1F17',
    letterSpacing: -0.4,
  },
  detailWith: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: GREEN_DARK,
    marginTop: -8,
  },
  detailDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  detailDatesText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#1A1F17',
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
    fontSize: 20,
    color: '#1A1F17',
    letterSpacing: -0.4,
  },
  detailLastMsg: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#EAE6D8',
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
    color: '#1A1F17',
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
    backgroundColor: GREEN_DARK,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
    ...Platform.select({
      web: { boxShadow: '0 4px 14px rgba(142,152,120,0.4)', cursor: 'pointer' },
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
    backgroundColor: GREEN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4DAC4',
    marginBottom: 8,
  },
  emptyRightTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#1A1F17',
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
