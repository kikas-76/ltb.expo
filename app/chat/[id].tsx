import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BookingBadge from '@/components/BookingBadge';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUnread } from '@/contexts/UnreadContext';
import { Colors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BG = '#F5F2E3';
const GREEN = '#B7BF9C';
const GREEN_DARK = '#8E9878';
const GREEN_LIGHT = '#ECEEE6';
const CREAM = '#FFFDF7';

interface MessageItem {
  id: string;
  content: string;
  imageUrl?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  senderId: string | null;
  isSystem: boolean;
  createdAt: string;
  isOwn: boolean;
  pending?: boolean;
}

interface ConvMeta {
  listingId: string;
  listingTitle: string;
  listingThumb: string | null;
  listingCity: string | null;
  listingPrice: number | null;
  otherUsername: string;
  otherUserId: string;
  otherAvatarUrl: string | null;
  startDate: string;
  endDate: string;
  isOwner: boolean;
  requesterUsername: string;
  requesterUserId: string;
  ownerUsername: string;
  ownerUserId: string;
  status: 'pending' | 'accepted' | 'refused';
}

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

function getDayCount(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.round((e - s) / 86400000) + 1;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { refresh: refreshUnread } = useUnread();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const inputScale = useRef(new Animated.Value(1)).current;

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [meta, setMeta] = useState<ConvMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingTotal, setBookingTotal] = useState<number | null>(null);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id || !user) return;

    const { data: conv } = await supabase
      .from('conversations')
      .select(`
        listing_id,
        start_date,
        end_date,
        requester_id,
        owner_id,
        status,
        listing:listings!conversations_listing_id_fkey(name, photos_url, price),
        requester:profiles!conversations_requester_id_fkey(username, photo_url, avatar_url),
        owner:profiles!conversations_owner_id_fkey(username, photo_url, avatar_url, location_data)
      `)
      .eq('id', id)
      .maybeSingle();

    if (conv) {
      const listing = Array.isArray(conv.listing) ? conv.listing[0] : conv.listing;
      const requester = Array.isArray(conv.requester) ? conv.requester[0] : conv.requester;
      const owner = Array.isArray(conv.owner) ? conv.owner[0] : conv.owner;
      const isRequester = conv.requester_id === user.id;
      const other = isRequester ? owner : requester;
      const parseCity = (address: string | null | undefined): string | null => {
        if (!address) return null;
        const parts = address.split(',').map((p: string) => p.trim()).filter(Boolean);
        return parts[parts.length - 1] ?? null;
      };
      const city =
        owner?.location_data?.city ??
        parseCity(owner?.location_data?.address) ??
        null;

      setMeta({
        listingId: conv.listing_id ?? '',
        listingTitle: listing?.name ?? 'Annonce',
        listingThumb: listing?.photos_url?.[0] ?? null,
        listingCity: city,
        listingPrice: listing?.price ?? null,
        otherUsername: other?.username ?? 'Utilisateur',
        otherUserId: isRequester ? conv.owner_id : conv.requester_id,
        otherAvatarUrl: other?.avatar_url ?? other?.photo_url ?? null,
        startDate: conv.start_date,
        endDate: conv.end_date,
        isOwner: !isRequester,
        requesterUsername: requester?.username ?? 'Locataire',
        requesterUserId: conv.requester_id,
        ownerUsername: owner?.username ?? 'Propriétaire',
        ownerUserId: conv.owner_id,
        status: (conv.status as 'pending' | 'accepted' | 'refused') ?? 'pending',
      });

      if (conv.status === 'accepted' && isRequester) {
        const [{ data: booking }, { data: profile }] = await Promise.all([
          supabase
            .from('bookings')
            .select('id, total_price, status, renter_id')
            .eq('conversation_id', id)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('stripe_onboarding_complete')
            .eq('id', user.id)
            .maybeSingle(),
        ]);
        if (booking) {
          setBookingId(booking.id);
          setBookingTotal(booking.total_price ?? null);
          setBookingStatus(booking.status ?? null);
        }
        setStripeReady(profile?.stripe_onboarding_complete === true);
      }
    }

    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('id, content, sender_id, is_system, created_at, is_read')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (msgs) {
      setMessages(
        msgs.map((m: any) => {
          let content = m.content;
          let imageUrl: string | null = null;
          let fileUrl: string | null = null;
          let fileName: string | null = null;
          try {
            const parsed = JSON.parse(m.content);
            if (parsed?.type === 'file') {
              fileUrl = parsed.url;
              fileName = parsed.name;
              content = '';
            }
          } catch {}
          const looksLikeImage = !fileUrl && /\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/i.test(m.content);
          if (looksLikeImage) {
            imageUrl = m.content;
            content = '';
          }
          return {
            id: m.id,
            content,
            imageUrl,
            fileUrl,
            fileName,
            senderId: m.sender_id,
            isSystem: m.is_system,
            createdAt: m.created_at,
            isOwn: m.sender_id === user.id,
          };
        })
      );

      const unreadIds = msgs
        .filter((m: any) => m.sender_id !== user.id && !m.is_read)
        .map((m: any) => m.id);
      if (unreadIds.length > 0) {
        supabase
          .from('chat_messages')
          .update({ is_read: true })
          .in('id', unreadIds)
          .then(() => refreshUnread());
      }
    }
    setLoading(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 150);
  }, [id, user, refreshUnread]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`chat-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated?.status) {
            setMeta((prev) => prev ? { ...prev, status: updated.status } : prev);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const m = payload.new as any;
          const isOwn = m.sender_id === user?.id;
          setMessages((prev) => {
            const alreadyConfirmed = prev.some((msg) => msg.id === m.id && !msg.pending);
            if (alreadyConfirmed) return prev;
            const hasPending = isOwn && prev.some((msg) => msg.pending);
            if (hasPending) return prev;
            return [
              ...prev,
              {
                id: m.id,
                content: m.content,
                imageUrl: null,
                senderId: m.sender_id,
                isSystem: m.is_system,
                createdAt: m.created_at,
                isOwn,
              },
            ];
          });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
          if (!isOwn) {
            supabase
              .from('chat_messages')
              .update({ is_read: true })
              .eq('id', m.id)
              .then(() => refreshUnread());
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, user, refreshUnread]);

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user || !id || sending) return;

    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic: MessageItem = {
      id: tempId,
      content: trimmed,
      senderId: user.id,
      isSystem: false,
      createdAt: now,
      isOwn: true,
      pending: true,
    };

    setText('');
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 40);

    Animated.sequence([
      Animated.timing(inputScale, { toValue: 0.97, duration: 60, useNativeDriver: true }),
      Animated.timing(inputScale, { toValue: 1, duration: 60, useNativeDriver: true }),
    ]).start();

    const { data } = await supabase.from('chat_messages').insert({
      conversation_id: id,
      sender_id: user.id,
      content: trimmed,
      is_system: false,
    }).select('id, created_at').maybeSingle();

    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId
          ? { ...m, id: data?.id ?? tempId, createdAt: data?.created_at ?? now, pending: false }
          : m
      )
    );
  };

  const uploadAndSendImage = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user || !id) return;
    setUploading(true);
    setUploadError(null);
    const ext = (asset.uri.split('.').pop() ?? 'jpg').split('?')[0].toLowerCase();
    const path = `chat/${id}/${Date.now()}.${ext}`;

    const tempId = `temp-photo-${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic: MessageItem = {
      id: tempId,
      content: '',
      imageUrl: asset.uri,
      senderId: user.id,
      isSystem: false,
      createdAt: now,
      isOwn: true,
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 40);

    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const mimeType = asset.mimeType ?? `image/${ext}`;
      const { error: storageError } = await supabase.storage
        .from('listing-photos')
        .upload(path, blob, { contentType: mimeType });

      if (storageError) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setUploadError("Erreur lors de l'envoi de l'image.");
        return;
      }

      const { data: urlData } = supabase.storage.from('listing-photos').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { data } = await supabase.from('chat_messages').insert({
        conversation_id: id,
        sender_id: user.id,
        content: publicUrl,
        is_system: false,
      }).select('id, created_at').maybeSingle();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, id: data?.id ?? tempId, imageUrl: publicUrl, createdAt: data?.created_at ?? now, pending: false }
            : m
        )
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setUploadError("Erreur lors de l'envoi de l'image.");
    } finally {
      setUploading(false);
    }
  };

  const uploadAndSendFile = async (uri: string, name: string, mimeType: string) => {
    if (!user || !id) return;
    setUploading(true);
    setUploadError(null);
    const ext = name.split('.').pop() ?? 'bin';
    const path = `chat/${id}/${Date.now()}-${name}`;

    const tempId = `temp-file-${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic: MessageItem = {
      id: tempId,
      content: '',
      fileUrl: uri,
      fileName: name,
      senderId: user.id,
      isSystem: false,
      createdAt: now,
      isOwn: true,
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 40);

    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error: storageError } = await supabase.storage
        .from('listing-photos')
        .upload(path, blob, { contentType: mimeType });

      if (storageError) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setUploadError("Erreur lors de l'envoi du fichier.");
        return;
      }

      const { data: urlData } = supabase.storage.from('listing-photos').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const messageContent = JSON.stringify({ type: 'file', url: publicUrl, name });

      const { data } = await supabase.from('chat_messages').insert({
        conversation_id: id,
        sender_id: user.id,
        content: messageContent,
        is_system: false,
      }).select('id, created_at').maybeSingle();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, id: data?.id ?? tempId, fileUrl: publicUrl, fileName: name, createdAt: data?.created_at ?? now, pending: false }
            : m
        )
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setUploadError("Erreur lors de l'envoi du fichier.");
    } finally {
      setUploading(false);
    }
  };

  const sendFromGallery = async () => {
    setShowAttachMenu(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setUploadError("Permission d'accès à la galerie refusée.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
      allowsMultipleSelection: true,
    });
    if (result.canceled || !result.assets.length) return;
    for (const asset of result.assets) {
      await uploadAndSendImage(asset);
    }
  };

  const sendFromCamera = async () => {
    setShowAttachMenu(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setUploadError("Permission d'accès à la caméra refusée.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadAndSendImage(result.assets[0]);
  };

  const sendFromFiles = async () => {
    setShowAttachMenu(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.length) return;
    const file = result.assets[0];
    await uploadAndSendFile(file.uri, file.name, file.mimeType ?? 'application/octet-stream');
  };

  const handleStatusUpdate = async (newStatus: 'accepted' | 'refused') => {
    if (!id || !meta) return;
    setStatusUpdating(true);

    const { error } = await supabase
      .from('conversations')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      if (newStatus === 'accepted') {
        const days = getDayCount(meta.startDate, meta.endDate);
        const disc = days >= 7 ? 0.2 : days >= 3 ? 0.1 : 0;
        const totalPrice = meta.listingPrice != null
          ? Math.round(meta.listingPrice * days * (1 - disc))
          : 0;

        const { data: existingBooking } = await supabase
          .from('bookings')
          .select('id')
          .eq('conversation_id', id)
          .maybeSingle();

        if (!existingBooking) {
          const { data: listingData } = await supabase
            .from('listings')
            .select('deposit_amount')
            .eq('id', meta.listingId)
            .maybeSingle();

          await supabase.from('bookings').insert({
            listing_id: meta.listingId,
            renter_id: meta.requesterUserId,
            owner_id: meta.ownerUserId,
            status: 'accepted',
            start_date: new Date(meta.startDate + 'T00:00:00').toISOString(),
            end_date: new Date(meta.endDate + 'T23:59:59').toISOString(),
            total_price: totalPrice,
            deposit_amount: listingData?.deposit_amount ?? 0,
            conversation_id: id,
          });
        }
      } else if (newStatus === 'refused') {
        await supabase
          .from('bookings')
          .delete()
          .eq('conversation_id', id);
      }

      const systemMsg = newStatus === 'accepted'
        ? `Demande acceptée par ${meta.ownerUsername}`
        : `Demande refusée par ${meta.ownerUsername}`;
      await supabase.from('chat_messages').insert({
        conversation_id: id,
        sender_id: null,
        content: systemMsg,
        is_system: true,
      });
      setMeta((prev) => prev ? { ...prev, status: newStatus } : prev);
    }
    setStatusUpdating(false);
  };

  const handlePayPress = async () => {
    if (payLoading || !id || !meta || !user) return;

    if (bookingId) {
      router.push(`/payment/${bookingId}` as any);
      return;
    }

    setPayLoading(true);
    try {
      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id, total_price, status, deposit_amount')
        .eq('conversation_id', id)
        .maybeSingle();

      if (existingBooking) {
        if (!existingBooking.deposit_amount || existingBooking.deposit_amount === 0) {
          const { data: listingData } = await supabase
            .from('listings')
            .select('deposit_amount')
            .eq('id', meta.listingId)
            .maybeSingle();
          if (listingData?.deposit_amount) {
            await supabase
              .from('bookings')
              .update({ deposit_amount: listingData.deposit_amount })
              .eq('id', existingBooking.id);
          }
        }
        setBookingId(existingBooking.id);
        setBookingTotal(existingBooking.total_price ?? null);
        setBookingStatus(existingBooking.status ?? null);
        router.push(`/payment/${existingBooking.id}` as any);
        return;
      }

      const days = getDayCount(meta.startDate, meta.endDate);
      const disc = days >= 7 ? 0.2 : days >= 3 ? 0.1 : 0;
      const totalPrice = meta.listingPrice != null
        ? Math.round(meta.listingPrice * days * (1 - disc))
        : 0;

      const { data: listingDepositData } = await supabase
        .from('listings')
        .select('deposit_amount')
        .eq('id', meta.listingId)
        .maybeSingle();

      const { data: newBooking, error } = await supabase
        .from('bookings')
        .insert({
          listing_id: meta.listingId,
          renter_id: meta.requesterUserId,
          owner_id: meta.ownerUserId,
          status: 'accepted',
          start_date: new Date(meta.startDate + 'T00:00:00').toISOString(),
          end_date: new Date(meta.endDate + 'T23:59:59').toISOString(),
          total_price: totalPrice,
          deposit_amount: listingDepositData?.deposit_amount ?? 0,
          conversation_id: id,
        })
        .select('id, total_price, status')
        .single();

      if (!error && newBooking) {
        setBookingId(newBooking.id);
        setBookingTotal(newBooking.total_price ?? null);
        setBookingStatus(newBooking.status ?? null);
        router.push(`/payment/${newBooking.id}` as any);
      }
    } finally {
      setPayLoading(false);
    }
  };

  const renderMessage = ({ item, index }: { item: MessageItem; index: number }) => {
    if (item.isSystem) {
      return (
        <View style={styles.systemMsgWrap}>
          <View style={styles.systemMsg}>
            <Ionicons name="calendar-outline" size={12} color={GREEN_DARK} />
            <Text style={styles.systemMsgText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    const showTime =
      index === messages.length - 1 ||
      new Date(messages[index + 1]?.createdAt).getTime() -
        new Date(item.createdAt).getTime() > 60000;

    const prevMsg = messages[index - 1];
    const showDate =
      index === 0 ||
      new Date(item.createdAt).toDateString() !==
        new Date(prevMsg?.createdAt).toDateString();

    return (
      <>
        {showDate && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateSeparatorLine} />
            <Text style={styles.dateSeparatorText}>
              {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
            <View style={styles.dateSeparatorLine} />
          </View>
        )}
        <View style={[styles.msgRow, item.isOwn && styles.msgRowOwn]}>
          <View style={[styles.bubble, item.isOwn ? styles.bubbleOwn : styles.bubbleOther, item.pending && styles.bubblePending]}>
            {item.imageUrl ? (
              <View>
                <Image source={{ uri: item.imageUrl }} style={styles.bubbleImage} resizeMode="cover" />
                {item.pending && (
                  <View style={styles.imageUploadOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
              </View>
            ) : item.fileUrl ? (
              <View style={[styles.fileBubble, item.isOwn && styles.fileBubbleOwn]}>
                <View style={[styles.fileIconWrap, item.isOwn && styles.fileIconWrapOwn]}>
                  {item.pending ? (
                    <ActivityIndicator size="small" color={item.isOwn ? GREEN_DARK : GREEN_DARK} />
                  ) : (
                    <Ionicons name="document-text-outline" size={20} color={item.isOwn ? '#fff' : GREEN_DARK} />
                  )}
                </View>
                <View style={styles.fileInfo}>
                  <Text style={[styles.fileName, item.isOwn && styles.fileNameOwn]} numberOfLines={2}>
                    {item.fileName ?? 'Fichier'}
                  </Text>
                  <Text style={[styles.fileSubtitle, item.isOwn && styles.fileSubtitleOwn]}>
                    {item.pending ? 'Envoi en cours...' : 'Appuyer pour ouvrir'}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={[styles.bubbleText, item.isOwn && styles.bubbleTextOwn]}>
                {item.content}
              </Text>
            )}
          </View>
          {showTime && !item.pending && (
            <Text style={[styles.msgTime, item.isOwn && styles.msgTimeOwn]}>
              {formatMessageTime(item.createdAt)}
            </Text>
          )}
          {item.pending && !item.imageUrl && (
            <Text style={[styles.msgTime, styles.msgTimeOwn, { fontStyle: 'italic' }]}>
              envoi...
            </Text>
          )}
        </View>
      </>
    );
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  const days = meta ? getDayCount(meta.startDate, meta.endDate) : 0;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        {/* Row 1 : back · [avatar + username centré] · spacer */}
        <View style={styles.topBarRow1}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/reservations' as any)} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topBarCenter}
            activeOpacity={0.7}
            onPress={() => meta?.otherUserId && router.push(`/owner/${meta.otherUserId}` as any)}
          >
            {meta?.otherAvatarUrl ? (
              <Image source={{ uri: meta.otherAvatarUrl }} style={styles.topBarAvatar} />
            ) : (
              <View style={styles.topBarAvatarFallback}>
                <Text style={styles.topBarAvatarInitial}>
                  {(meta?.otherUsername ?? '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.topBarTitle} numberOfLines={1}>
              {meta?.otherUsername ?? 'Conversation'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.75}
            onPress={() =>
              meta &&
              router.push({
                pathname: '/report',
                params: {
                  type: 'conversation',
                  targetId: id,
                  targetLabel: meta.otherUsername,
                },
              } as any)
            }
          >
            <Ionicons name="flag-outline" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Row 2 : listing mini-card */}
        {meta && (
          <TouchableOpacity
            style={styles.topBarListing}
            activeOpacity={0.75}
            onPress={() => meta.listingId && router.push(`/listing/${meta.listingId}` as any)}
          >
            {meta.listingThumb ? (
              <Image source={{ uri: meta.listingThumb }} style={styles.topBarListingImg} />
            ) : (
              <View style={styles.topBarListingImgFallback} />
            )}
            <View style={styles.topBarListingBody}>
              <Text style={styles.topBarListingTitle} numberOfLines={1}>{meta.listingTitle}</Text>
              <View style={styles.topBarListingRow}>
                <View style={styles.topBarDateChip}>
                  <Ionicons name="calendar-outline" size={10} color={GREEN_DARK} />
                  <Text style={styles.topBarDateText}>
                    {formatDateShort(meta.startDate)} → {formatDateShort(meta.endDate)}
                  </Text>
                  <View style={styles.topBarDaysChip}>
                    <Text style={styles.topBarDaysText}>{days}j</Text>
                  </View>
                </View>
                {meta.listingPrice != null && (
                  <Text style={styles.topBarPrice}>
                    {(meta.listingPrice * days).toFixed(0)} €
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Owner action bar: accept / refuse when status is pending */}
      {meta?.isOwner && meta.status === 'pending' && (
        <View style={styles.actionBar}>
          <Text style={styles.actionBarLabel}>Répondre à cette demande</Text>
          <View style={styles.actionBarButtons}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnRefuse]}
              activeOpacity={0.8}
              disabled={statusUpdating}
              onPress={() => handleStatusUpdate('refused')}
            >
              {statusUpdating ? (
                <ActivityIndicator size="small" color="#C0392B" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={16} color="#C0392B" />
                  <Text style={styles.actionBtnRefuseText}>Refuser</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnAccept]}
              activeOpacity={0.8}
              disabled={statusUpdating}
              onPress={() => handleStatusUpdate('accepted')}
            >
              {statusUpdating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-outline" size={16} color="#fff" />
                  <Text style={styles.actionBtnAcceptText}>Accepter</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Status badge banner */}
      {meta && meta.status !== 'pending' && (
        <View style={styles.statusBadgeRow}>
          <BookingBadge status={bookingStatus ?? meta.status} />
        </View>
      )}

      {/* Active confirmation card */}
      {bookingStatus === 'active' && (
        <View style={styles.activeConfirmCard}>
          <Text style={styles.activeConfirmText}>
            Paiement confirmé — Vous pouvez vous retrouver pour la remise
          </Text>
        </View>
      )}

      {/* Payment action banner for renter when booking is accepted and not yet paid */}
      {meta && meta.status === 'accepted' && !meta.isOwner && bookingStatus !== 'active' && (
        stripeReady ? (
          <TouchableOpacity
            style={styles.payBannerGreen}
            activeOpacity={0.88}
            onPress={handlePayPress}
            disabled={payLoading}
          >
            <View style={styles.payBannerGreenLeft}>
              <Text style={styles.payBannerGreenTitle}>
                Demande acceptée — Finalise ta réservation
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.payBannerGreenBtn, payLoading && { opacity: 0.7 }]}
              activeOpacity={0.85}
              onPress={handlePayPress}
              disabled={payLoading}
            >
              {payLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.payBannerGreenBtnText}>
                  Payer {bookingTotal != null ? `${bookingTotal} €` : ''} →
                </Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.payBannerOrange}
            activeOpacity={0.88}
            onPress={() => router.push('/wallet' as any)}
          >
            <View style={styles.payBannerOrangeLeft}>
              <Text style={styles.payBannerOrangeTitle}>
                Active ton compte Stripe pour payer
              </Text>
            </View>
            <TouchableOpacity
              style={styles.payBannerOrangeBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/wallet' as any)}
            >
              <Text style={styles.payBannerOrangeBtnText}>Activer →</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )
      )}

      {/* Messages + recap card scrollable ensemble */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[styles.messagesList, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListHeaderComponent={meta ? (
          <TouchableOpacity
            style={styles.recapCard}
            activeOpacity={0.88}
            onPress={() => meta.listingId && router.push(`/listing/${meta.listingId}` as any)}
          >
            {meta.listingThumb ? (
              <Image source={{ uri: meta.listingThumb }} style={styles.recapBannerImage} />
            ) : (
              <View style={styles.recapBannerFallback} />
            )}
            <View style={styles.recapCardBody}>
              <View style={styles.recapCardHeader}>
                <Text style={styles.recapTitle} numberOfLines={2}>{meta.listingTitle}</Text>
                {meta.listingPrice != null && (
                  <View style={styles.recapPriceTag}>
                    <Text style={styles.recapPriceText}>{(meta.listingPrice * days).toFixed(0)} €</Text>
                  </View>
                )}
              </View>
              {meta.listingCity && (
                <View style={styles.recapMeta}>
                  <Ionicons name="location-outline" size={12} color={GREEN_DARK} />
                  <Text style={styles.recapMetaText}>{meta.listingCity}</Text>
                </View>
              )}
              <View style={styles.recapDivider} />
              <View style={styles.recapDatesRow}>
                <View style={styles.recapDateBlock}>
                  <Text style={styles.recapDateLabel}>Début</Text>
                  <Text style={styles.recapDateValue}>{formatDateFull(meta.startDate)}</Text>
                </View>
                <View style={styles.recapDateArrow}>
                  <Text style={styles.recapDateArrowText}>→</Text>
                </View>
                <View style={[styles.recapDateBlock, { alignItems: 'flex-end' }]}>
                  <Text style={styles.recapDateLabel}>Fin</Text>
                  <Text style={styles.recapDateValue}>{formatDateFull(meta.endDate)}</Text>
                </View>
              </View>
              <View style={styles.recapFooter}>
                <View style={styles.recapDaysChip}>
                  <Ionicons name="calendar-outline" size={12} color="#fff" />
                  <Text style={styles.recapDaysText}>{days} jour{days > 1 ? 's' : ''}</Text>
                </View>
                {meta.listingCity && (
                  <View style={styles.recapCityChip}>
                    <Ionicons name="location-outline" size={12} color={GREEN_DARK} />
                    <Text style={styles.recapCityText}>{meta.listingCity}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ) : null}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatText}>Aucun message pour l'instant.</Text>
            <Text style={styles.emptyChatSub}>Démarrez la conversation !</Text>
          </View>
        }
      />

      {/* Upload error banner */}
      {uploadError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={14} color="#E05252" />
          <Text style={styles.errorBannerText}>{uploadError}</Text>
          <TouchableOpacity onPress={() => setUploadError(null)} activeOpacity={0.7}>
            <Ionicons name="close-outline" size={14} color="#E05252" />
          </TouchableOpacity>
        </View>
      )}

      {/* Upload progress banner */}
      {uploading && (
        <View style={styles.uploadingBanner}>
          <ActivityIndicator size="small" color={GREEN_DARK} />
          <Text style={styles.uploadingBannerText}>Envoi en cours...</Text>
        </View>
      )}

      {/* Input */}
      <Animated.View
        style={[
          styles.inputBar,
          { paddingBottom: insets.bottom + 8, transform: [{ scale: inputScale }] },
        ]}
      >
        <TouchableOpacity style={styles.attachBtn} onPress={() => setShowAttachMenu(true)} activeOpacity={0.7}>
          <Ionicons name="add-outline" size={20} color={GREEN_DARK} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Écrire un message..."
          placeholderTextColor={Colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          activeOpacity={0.8}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Ionicons name="send-outline" size={18} color={Colors.white} />
          }
        </TouchableOpacity>
      </Animated.View>

      {/* Attach menu modal */}
      <Modal
        visible={showAttachMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttachMenu(false)}
      >
        <TouchableOpacity
          style={styles.attachOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachMenu(false)}
        >
          <View style={[styles.attachSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.attachHandle} />
            <Text style={styles.attachTitle}>Joindre un fichier</Text>
            <TouchableOpacity style={styles.attachOption} onPress={sendFromCamera} activeOpacity={0.75}>
              <View style={[styles.attachOptionIcon, { backgroundColor: '#E8F0E0' }]}>
                <Ionicons name="camera-outline" size={22} color={GREEN_DARK} />
              </View>
              <View style={styles.attachOptionBody}>
                <Text style={styles.attachOptionLabel}>Appareil photo</Text>
                <Text style={styles.attachOptionSub}>Prendre une photo maintenant</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={sendFromGallery} activeOpacity={0.75}>
              <View style={[styles.attachOptionIcon, { backgroundColor: '#E8F0E0' }]}>
                <Ionicons name="image-outline" size={22} color={GREEN_DARK} />
              </View>
              <View style={styles.attachOptionBody}>
                <Text style={styles.attachOptionLabel}>Galerie photo</Text>
                <Text style={styles.attachOptionSub}>Choisir depuis vos photos</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={sendFromFiles} activeOpacity={0.75}>
              <View style={[styles.attachOptionIcon, { backgroundColor: '#F0EBE0' }]}>
                <Ionicons name="document-text-outline" size={22} color="#8B6A3A" />
              </View>
              <View style={styles.attachOptionBody}>
                <Text style={styles.attachOptionLabel}>Fichiers</Text>
                <Text style={styles.attachOptionSub}>Documents et autres fichiers</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachCancel} onPress={() => setShowAttachMenu(false)} activeOpacity={0.75}>
              <Ionicons name="close-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.attachCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  centered: { alignItems: 'center', justifyContent: 'center' },

  topBar: {
    backgroundColor: CREAM,
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE6D8',
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 3 },
      web: { boxShadow: '0 2px 6px rgba(0,0,0,0.05)' },
    }),
  },
  topBarRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBarListing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  topBarListingImg: {
    width: 44,
    height: 44,
    borderRadius: 10,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#E0DDD0',
  },
  topBarListingImgFallback: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: GREEN,
    flexShrink: 0,
  },
  topBarListingBody: { flex: 1, gap: 4 },
  topBarListingTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#1A1F17',
    letterSpacing: -0.1,
  },
  topBarListingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  topBarDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topBarDateText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: GREEN_DARK,
  },
  topBarDaysChip: {
    backgroundColor: GREEN_DARK,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  topBarDaysText: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    color: '#fff',
  },
  topBarPrice: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: '#1A1F17',
    letterSpacing: -0.2,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  topBarTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#1A1F17',
    letterSpacing: -0.3,
  },
  topBarSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  topBarAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: GREEN,
    flexShrink: 0,
  },
  topBarAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GREEN_LIGHT,
    borderWidth: 2,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  topBarAvatarInitial: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: GREEN_DARK,
  },

  recapCard: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EAE6D8',
    backgroundColor: CREAM,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10 },
      android: { elevation: 3 },
      web: { boxShadow: '0 3px 10px rgba(0,0,0,0.08)' },
    }),
  },
  recapBannerImage: {
    width: '100%',
    height: 130,
  },
  recapBannerFallback: {
    width: '100%',
    height: 130,
    backgroundColor: GREEN_LIGHT,
  },
  recapCardBody: {
    padding: 14,
    gap: 8,
  },
  recapCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  recapTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: '#1A1F17',
    letterSpacing: -0.2,
    flex: 1,
  },
  recapPriceTag: {
    backgroundColor: GREEN_DARK,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  recapPriceText: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: '#fff',
    letterSpacing: -0.2,
  },
  recapMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recapMetaText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  recapDivider: {
    height: 1,
    backgroundColor: '#EAE6D8',
    marginVertical: 2,
  },
  recapDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recapDateBlock: {
    gap: 2,
  },
  recapDateLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  recapDateValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#1A1F17',
  },
  recapDateArrow: {
    alignItems: 'center',
  },
  recapDateArrowText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#C0BBA8',
  },
  recapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  recapDaysChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: GREEN_DARK,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  recapDaysText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#fff',
  },
  recapCityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  recapCityText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: GREEN_DARK,
    letterSpacing: -0.1,
  },

  messagesList: { paddingHorizontal: 14, paddingTop: 8 },

  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 14,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#DDD9CC',
  },
  dateSeparatorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'capitalize',
  },

  systemMsgWrap: { alignItems: 'center', marginVertical: 8 },
  systemMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  systemMsgText: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: GREEN_DARK },

  msgRow: { marginVertical: 2, alignItems: 'flex-start' },
  msgRowOwn: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOther: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 5,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
    }),
  },
  bubbleOwn: {
    backgroundColor: GREEN_DARK,
    borderBottomRightRadius: 5,
  },
  bubbleText: { fontFamily: 'Inter-Regular', fontSize: 15, color: Colors.text, lineHeight: 22 },
  bubbleTextOwn: { color: Colors.white },
  msgTime: { fontFamily: 'Inter-Regular', fontSize: 10, color: Colors.textMuted, marginTop: 2, marginLeft: 4 },
  msgTimeOwn: { marginLeft: 0, marginRight: 4 },

  emptyChat: { alignItems: 'center', paddingTop: 60 },
  emptyChatText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#1A1F17', marginBottom: 4 },
  emptyChatSub: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.textMuted },

  inputBar: {
    backgroundColor: CREAM,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EAE6D8',
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 4 },
      web: { boxShadow: '0 -2px 8px rgba(0,0,0,0.05)' },
    }),
  },
  input: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.text,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#DDD9CC',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GREEN_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: GREEN_DARK, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8 },
      android: { elevation: 4 },
      web: { boxShadow: '0 3px 10px rgba(142,152,120,0.4)' },
    }),
  },
  sendBtnDisabled: { opacity: 0.45 },

  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GREEN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4DAC4',
    flexShrink: 0,
  },
  attachOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  attachSheet: {
    backgroundColor: CREAM,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12 },
      android: { elevation: 12 },
      web: { boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' },
    }),
  },
  attachHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4D0C4',
    alignSelf: 'center',
    marginBottom: 14,
  },
  attachTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#1A1F17',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  attachOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
  },
  attachOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  attachOptionBody: { flex: 1 },
  attachOptionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#1A1F17',
    marginBottom: 2,
  },
  attachOptionSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  attachCancel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#EAE6D8',
  },
  attachCancelText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.textMuted,
  },
  actionBar: {
    backgroundColor: '#FFFDF7',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE6D8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 4 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
    }),
  },
  actionBarLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  actionBarButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionBtnRefuse: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  actionBtnRefuseText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#C0392B',
  },
  actionBtnAccept: {
    backgroundColor: GREEN_DARK,
    ...Platform.select({
      ios: { shadowColor: GREEN_DARK, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 3 },
      web: { boxShadow: '0 3px 10px rgba(142,152,120,0.35)' },
    }),
  },
  actionBtnAcceptText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#fff',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE6D8',
    backgroundColor: '#FFFDF7',
  },
  activeConfirmCard: {
    backgroundColor: '#D4EDDA',
    borderBottomWidth: 1,
    borderBottomColor: '#B7DFC0',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  activeConfirmText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#155724',
    textAlign: 'center',
    lineHeight: 19,
  },
  bubblePending: { opacity: 0.65 },
  bubbleImage: {
    width: 200,
    height: 160,
    borderRadius: 12,
  },
  imageUploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 180,
    maxWidth: 240,
  },
  fileBubbleOwn: {},
  fileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  fileIconWrapOwn: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  fileInfo: { flex: 1 },
  fileName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#1A1F17',
    lineHeight: 18,
  },
  fileNameOwn: { color: '#fff' },
  fileSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  fileSubtitleOwn: { color: 'rgba(255,255,255,0.7)' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#E05252',
  },
  uploadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: GREEN_LIGHT,
    borderTopWidth: 1,
    borderTopColor: '#D4DAC4',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  uploadingBannerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: GREEN_DARK,
  },
  payBannerGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#1B4332',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  payBannerGreenLeft: {
    flex: 1,
  },
  payBannerGreenTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  payBannerGreenBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexShrink: 0,
  },
  payBannerGreenBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    color: '#1B4332',
  },
  payBannerOrange: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  payBannerOrangeLeft: {
    flex: 1,
  },
  payBannerOrangeTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  payBannerOrangeBtn: {
    backgroundColor: '#D97706',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexShrink: 0,
  },
  payBannerOrangeBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
});
