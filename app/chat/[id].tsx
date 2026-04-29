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
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BookingBadge, { BookingProgress } from '@/components/BookingBadge';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { postSystemMessage } from '@/lib/postSystemMessage';
import { updateBookingStatus, updateBookingConfirmationFields } from '@/lib/updateBookingStatus';
import { createPendingPaymentBooking, computeRentalTotal } from '@/lib/createBooking';
import { getRentalDays } from '@/lib/pricing';
import { privateUriFor, resolveAttachmentUrl } from '@/lib/signedUrl';
import { Skeleton } from '@/components/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useUnread } from '@/contexts/UnreadContext';
import { Colors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CHAT_MAX_WIDTH = 860;

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

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { refresh: refreshUnread } = useUnread();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isDesktop = width >= 1024 && Platform.OS === 'web';
  const listRef = useRef<FlatList>(null);
  const inputScale = useRef(new Animated.Value(1)).current;

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [meta, setMeta] = useState<ConvMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingTotal, setBookingTotal] = useState<number | null>(null);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [handoverConfirmedOwner, setHandoverConfirmedOwner] = useState(false);
  const [handoverConfirmedRenter, setHandoverConfirmedRenter] = useState(false);
  const [returnConfirmedOwner, setReturnConfirmedOwner] = useState(false);
  const [returnConfirmedRenter, setReturnConfirmedRenter] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmCardExpanded, setConfirmCardExpanded] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [ownerValidated, setOwnerValidated] = useState(false);
  const [returnConfirmedAt, setReturnConfirmedAt] = useState<string | null>(null);
  const [validationDeadlineMs, setValidationDeadlineMs] = useState<number | null>(null);
  const [validationCountdown, setValidationCountdown] = useState<string>('');

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
        owner:profiles!conversations_owner_id_fkey(username, photo_url, avatar_url)
      `)
      .eq('id', id)
      .maybeSingle();

    if (conv) {
      const listing = Array.isArray(conv.listing) ? conv.listing[0] : conv.listing;
      const requester = Array.isArray(conv.requester) ? conv.requester[0] : conv.requester;
      const owner = Array.isArray(conv.owner) ? conv.owner[0] : conv.owner;
      const isRequester = conv.requester_id === user.id;
      const other = isRequester ? owner : requester;
      // The listing's exact address is only revealed via
      // get_listing_exact_location once a booking exists. Owner's
      // location_data is no longer joinable here (RGPD: revoked from
      // authenticated GRANT). City label is left blank pre-booking.
      const city = null;

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

      // Fetch booking data whenever conversation is accepted (booking exists)
      if (conv.status === 'accepted') {
        const queries: any[] = [
          supabase
            .from('bookings')
            .select('id, total_price, status, renter_id, handover_confirmed_owner, handover_confirmed_renter, return_confirmed_owner, return_confirmed_renter, owner_validated, return_confirmed_at')
            .eq('conversation_id', id)
            .maybeSingle(),
        ];
        // Check OWNER's Stripe status (not renter's: renters don't need Stripe accounts)
        if (isRequester) {
          queries.push(
            supabase
              .from('profiles')
              .select('stripe_onboarding_complete, stripe_charges_enabled')
              .eq('id', conv.owner_id)
              .maybeSingle()
          );
        } else {
          queries.push(Promise.resolve({ data: null }));
        }
        const [{ data: booking }, { data: profile }] = await Promise.all(queries);
        if (booking) {
          setBookingId(booking.id);
          setBookingTotal(booking.total_price ?? null);
          setBookingStatus(booking.status ?? null);
          setHandoverConfirmedOwner(booking.handover_confirmed_owner ?? false);
          setHandoverConfirmedRenter(booking.handover_confirmed_renter ?? false);
          setReturnConfirmedOwner(booking.return_confirmed_owner ?? false);
          setReturnConfirmedRenter(booking.return_confirmed_renter ?? false);
          setOwnerValidated(booking.owner_validated ?? false);
          if (booking.return_confirmed_at) {
            setReturnConfirmedAt(booking.return_confirmed_at);
            setValidationDeadlineMs(new Date(booking.return_confirmed_at).getTime() + 24 * 3600 * 1000);
          }
        }
        if (isRequester) {
          setStripeReady(
            profile?.stripe_onboarding_complete === true &&
            profile?.stripe_charges_enabled === true
          );
        }
      }
    }

    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('id, content, sender_id, is_system, created_at, is_read')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (msgs) {
      // Resolve private:// URIs (chat-attachments bucket) to short-lived
      // signed URLs in parallel. Legacy public URLs pass through unchanged.
      const mapped = await Promise.all(
        msgs.map(async (m: any) => {
          let content = m.content;
          let imageUrl: string | null = null;
          let fileUrl: string | null = null;
          let fileName: string | null = null;
          try {
            const parsed = JSON.parse(m.content);
            if (parsed?.type === 'file') {
              fileUrl = (await resolveAttachmentUrl(parsed.url)) ?? parsed.url;
              fileName = parsed.name;
              content = '';
            }
          } catch {}
          const looksLikeImageContent =
            !fileUrl &&
            (m.content?.startsWith('private://') ||
              /\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/i.test(m.content ?? '') ||
              /\/storage\/v1\/object\//.test(m.content ?? ''));
          if (looksLikeImageContent) {
            imageUrl = (await resolveAttachmentUrl(m.content)) ?? m.content;
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
        }),
      );
      setMessages(mapped);

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
    if (!validationDeadlineMs) return;
    const tick = () => {
      const remaining = validationDeadlineMs - Date.now();
      if (remaining <= 0) {
        setValidationCountdown('Délai expiré');
        return;
      }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setValidationCountdown(`${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [validationDeadlineMs]);

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
        { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const b = payload.new as any;
          if (b) {
            setBookingStatus(b.status ?? null);
            setHandoverConfirmedOwner(b.handover_confirmed_owner ?? false);
            setHandoverConfirmedRenter(b.handover_confirmed_renter ?? false);
            setReturnConfirmedOwner(b.return_confirmed_owner ?? false);
            setReturnConfirmedRenter(b.return_confirmed_renter ?? false);
            setOwnerValidated(b.owner_validated ?? false);
            if (b.return_confirmed_at) {
              setReturnConfirmedAt(b.return_confirmed_at);
              setValidationDeadlineMs(new Date(b.return_confirmed_at).getTime() + 24 * 3600 * 1000);
            }
            if (b.status === 'pending_owner_validation') {
              setShowValidationModal(true);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${id}` },
        async (payload) => {
          const m = payload.new as any;
          const isOwn = m.sender_id === user?.id;
          // Parse file/image content the same way as initial load. Private
          // bucket URIs (private://...) need to be turned into a signed URL
          // before display; legacy public URLs pass through unchanged.
          let content = m.content;
          let imageUrl: string | null = null;
          let fileUrl: string | null = null;
          let fileName: string | null = null;
          try {
            const parsed = JSON.parse(m.content);
            if (parsed?.type === 'file') {
              fileUrl = (await resolveAttachmentUrl(parsed.url)) ?? parsed.url;
              fileName = parsed.name;
              content = '';
            }
          } catch {}
          const looksLikeImageContent =
            !fileUrl &&
            (m.content?.startsWith('private://') ||
              /\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/i.test(m.content ?? '') ||
              /\/storage\/v1\/object\//.test(m.content ?? ''));
          if (looksLikeImageContent) {
            imageUrl = (await resolveAttachmentUrl(m.content)) ?? m.content;
            content = '';
          }
          setMessages((prev) => {
            const alreadyConfirmed = prev.some((msg) => msg.id === m.id && !msg.pending);
            if (alreadyConfirmed) return prev;
            const hasPending = isOwn && prev.some((msg) => msg.pending);
            if (hasPending) return prev;
            return [
              ...prev,
              {
                id: m.id,
                content,
                imageUrl,
                fileUrl,
                fileName,
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
    // Map picker output to a real mime that matches the bucket
    // allowed_mime_types. ImagePicker may return image/jpg (invalid),
    // and on web asset.uri is a blob: URL so split('.').pop() is unsafe.
    const EXT_TO_MIME: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      heic: 'image/heic',
      heif: 'image/heif',
      gif: 'image/gif',
    };
    const rawExt = (asset.uri.split('.').pop() ?? '').split('?')[0].toLowerCase();
    const declared = asset.mimeType?.split(';')[0]?.toLowerCase();
    const declaredFromExt = EXT_TO_MIME[rawExt];
    const mimeType =
      (declared && Object.values(EXT_TO_MIME).includes(declared))
        ? declared
        : declaredFromExt;
    if (!mimeType) {
      setUploadError("Format d'image non pris en charge.");
      setUploading(false);
      return;
    }
    const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
    // Private bucket layout: <user_id>/<conversation_id>/<timestamp>.<ext>.
    // RLS reads (foldername)[1] = user_id (uploader) and (foldername)[2] =
    // conversation_id (read access via participant check).
    const path = `${user.id}/${id}/${Date.now()}.${ext}`;

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
      const { error: storageError } = await supabase.storage
        .from('chat-attachments')
        .upload(path, blob, { contentType: mimeType });

      if (storageError) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setUploadError("Erreur lors de l'envoi de l'image.");
        return;
      }

      // Store the private:// URI in the message; the renderer resolves
      // it to a short-lived signed URL via resolveAttachmentUrl().
      const storedContent = privateUriFor('chat-attachments', path);
      const signedUrl = (await resolveAttachmentUrl(storedContent)) ?? asset.uri;

      const { data } = await supabase.from('chat_messages').insert({
        conversation_id: id,
        sender_id: user.id,
        content: storedContent,
        is_system: false,
      }).select('id, created_at').maybeSingle();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, id: data?.id ?? tempId, imageUrl: signedUrl, createdAt: data?.created_at ?? now, pending: false }
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
    // Private bucket layout: <user_id>/<conversation_id>/<timestamp>-<filename>
    const path = `${user.id}/${id}/${Date.now()}-${name}`;

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
        .from('chat-attachments')
        .upload(path, blob, { contentType: mimeType });

      if (storageError) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setUploadError("Erreur lors de l'envoi du fichier.");
        return;
      }

      const privateUri = privateUriFor('chat-attachments', path);
      const signedUrl = (await resolveAttachmentUrl(privateUri)) ?? uri;

      const messageContent = JSON.stringify({ type: 'file', url: privateUri, name });

      const { data } = await supabase.from('chat_messages').insert({
        conversation_id: id,
        sender_id: user.id,
        content: messageContent,
        is_system: false,
      }).select('id, created_at').maybeSingle();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, id: data?.id ?? tempId, fileUrl: signedUrl, fileName: name, createdAt: data?.created_at ?? now, pending: false }
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

  // Aligned with the chat-attachments bucket allowed_mime_types. Anything
  // outside this set is rejected upfront so users see a friendly error
  // rather than a 400 from storage. SVG/HTML/exec are excluded on
  // purpose — they could be used to host phishing pages on supabase.co.
  const CHAT_FILE_ALLOWED_MIMES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ]);

  const sendFromFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: Array.from(CHAT_FILE_ALLOWED_MIMES),
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.length) return;
    const file = result.assets[0];
    const mime = (file.mimeType ?? '').split(';')[0].toLowerCase();
    if (!CHAT_FILE_ALLOWED_MIMES.has(mime)) {
      setUploadError('Format de fichier non pris en charge.');
      return;
    }
    await uploadAndSendFile(file.uri, file.name, mime);
  };

  const handleStatusUpdate = async (newStatus: 'accepted' | 'refused') => {
    if (!id || !meta) return;
    setStatusUpdating(true);
    setStatusError(null);

    const previousStatus = meta.status;

    const { error } = await supabase
      .from('conversations')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      setStatusError("Impossible de mettre à jour la demande. Réessayez.");
      setStatusUpdating(false);
      return;
    }

    if (newStatus === 'accepted') {
      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('conversation_id', id)
        .maybeSingle();

      if (!existingBooking) {
        const { error: bookingError } = await createPendingPaymentBooking({
          listingId: meta.listingId,
          startDate: meta.startDate,
          endDate: meta.endDate,
          conversationId: id as string,
        });

        if (bookingError) {
          await supabase
            .from('conversations')
            .update({ status: previousStatus })
            .eq('id', id);
          // Surface a readable reason. The RPC raises labelled errors
          // ("start_date cannot be in the past", "Listing is not active",
          // "Selected dates overlap an existing booking") that are safe
          // to show — they describe the request, not internal state.
          const raw = (bookingError as { message?: string })?.message ?? '';
          const friendly = raw.includes('start_date cannot be in the past')
            ? 'Ces dates sont déjà passées. Demandez au locataire de mettre à jour sa demande.'
            : raw.includes('overlap')
            ? 'Ces dates sont déjà réservées sur cette annonce.'
            : raw.includes('Listing is not active')
            ? 'Cette annonce n’est plus active.'
            : 'Impossible d’accepter la demande. Réessayez.';
          setStatusError(friendly);
          console.error('createPendingPaymentBooking failed:', bookingError);
          setStatusUpdating(false);
          return;
        }
      }
    }

    await postSystemMessage(id as string, {
      event: newStatus === 'accepted' ? 'request_accepted' : 'request_refused',
    });
    setMeta((prev) => prev ? { ...prev, status: newStatus } : prev);

    const { data: { session: notifySession } } = await supabase.auth.getSession();
    if (notifySession?.access_token) {
      const event = newStatus === 'accepted' ? 'booking_accepted' : 'booking_rejected';
      fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/chat-notify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${notifySession.access_token}`,
          },
          body: JSON.stringify({ event, conversation_id: id }),
        }
      ).catch((e) => console.error('chat-notify failed:', e));
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
        .select('id, total_price, status')
        .eq('conversation_id', id)
        .maybeSingle();

      if (existingBooking) {
        setBookingId(existingBooking.id);
        setBookingTotal(existingBooking.total_price ?? null);
        setBookingStatus(existingBooking.status ?? null);
        router.push(`/payment/${existingBooking.id}` as any);
        return;
      }

      const days = getRentalDays(meta.startDate, meta.endDate);
      const totalPrice = meta.listingPrice != null
        ? computeRentalTotal(meta.listingPrice, days)
        : 0;

      const { data: newBooking, error } = await createPendingPaymentBooking({
        listingId: meta.listingId,
        startDate: meta.startDate,
        endDate: meta.endDate,
        conversationId: id as string,
      });

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

  const handleConfirmHandover = async () => {
    if (!bookingId || !meta || !user || confirmLoading) return;
    setConfirmLoading(true);
    try {
      const isOwner = meta.isOwner;
      const confirmField: Record<string, boolean> = isOwner ? { handover_confirmed_owner: true } : { handover_confirmed_renter: true };
      const newOwnerVal = isOwner ? true : handoverConfirmedOwner;
      const newRenterVal = !isOwner ? true : handoverConfirmedRenter;

      if (newOwnerVal && newRenterVal) {
        await updateBookingStatus(bookingId, 'in_progress', confirmField);
        await postSystemMessage(id as string, { event: 'handover_confirmed_both' });
      } else {
        await updateBookingConfirmationFields(bookingId, bookingStatus ?? 'accepted', confirmField);
        await postSystemMessage(id as string, { event: 'handover_confirmed_one' });
      }
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleConfirmReturn = async () => {
    if (!bookingId || !meta || !user || confirmLoading) return;
    setConfirmLoading(true);
    try {
      const isOwner = meta.isOwner;
      const returnField: Record<string, boolean> = isOwner ? { return_confirmed_owner: true } : { return_confirmed_renter: true };
      const newOwnerVal = isOwner ? true : returnConfirmedOwner;
      const newRenterVal = !isOwner ? true : returnConfirmedRenter;

      if (newOwnerVal && newRenterVal) {
        // return_confirmed_at is stamped server-side in the RPC (now()) to
        // prevent client-supplied dates from triggering early auto-validation.
        // The local clock is used here only for the UI countdown — close
        // enough; the cron uses the authoritative server timestamp.
        await updateBookingStatus(bookingId, 'pending_owner_validation', returnField);
        const confirmedAt = new Date().toISOString();
        setReturnConfirmedAt(confirmedAt);
        setValidationDeadlineMs(new Date(confirmedAt).getTime() + 24 * 3600 * 1000);
        await postSystemMessage(id as string, { event: 'return_confirmed_both' });
        if (isOwner) setShowValidationModal(true);
      } else {
        await updateBookingConfirmationFields(bookingId, bookingStatus ?? 'in_progress', returnField);
        await postSystemMessage(id as string, { event: 'return_confirmed_one' });
      }
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleOwnerValidateOk = async () => {
    if (!bookingId || !id || confirmLoading) return;
    setConfirmLoading(true);
    try {
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('stripe_payment_intent_id')
        .eq('id', bookingId)
        .maybeSingle();

      // owner_validated is stamped server-side in the RPC when the owner
      // triggers pending_owner_validation -> completed. Clients can't forge it.
      await updateBookingStatus(bookingId, 'completed');

      if (bookingData?.stripe_payment_intent_id) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/manage-deposit`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                action: 'release',
                booking_id: bookingId,
              }),
            }
          );
        }
      }

      await postSystemMessage(id as string, { event: 'owner_validated_ok' });

      setShowValidationModal(false);
      setOwnerValidated(true);
      setBookingStatus('completed');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleOpenDispute = () => {
    setShowValidationModal(false);
    router.push(`/dispute/${bookingId}?conversation_id=${id}` as any);
  };

  const renderMessage = ({ item, index }: { item: MessageItem; index: number }) => {
    if (item.isSystem) {
      return (
        <View style={styles.systemMsgWrap}>
          <View style={styles.systemMsg}>
            <Ionicons name="calendar-outline" size={12} color={Colors.primaryDark} />
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
          <View style={[styles.bubble, item.isOwn ? styles.bubbleOwn : styles.bubbleOther, item.pending && styles.bubblePending, isDesktop && styles.bubbleDesktop]}>
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
                    <ActivityIndicator size="small" color={item.isOwn ? Colors.primaryDark : Colors.primaryDark} />
                  ) : (
                    <Ionicons name="document-text-outline" size={20} color={item.isOwn ? '#fff' : Colors.primaryDark} />
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
      <View style={styles.root}>
        <View style={{ padding: 16, gap: 12, borderBottomWidth: 0.5, borderBottomColor: '#E8E5D8' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Skeleton width={48} height={48} radius={12} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton height={14} width="60%" />
              <Skeleton height={12} width="40%" />
            </View>
          </View>
        </View>
        <View style={{ padding: 16, gap: 14 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: i % 2 === 0 ? 'flex-start' : 'flex-end' }}>
              <Skeleton width="65%" height={42} radius={16} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  const days = meta ? getRentalDays(meta.startDate, meta.endDate) : 0;

  return (
    <View style={[styles.root, isDesktop && chatDesktopStyles.outerWrap]}>
    <KeyboardAvoidingView
      style={[styles.root, isDesktop && chatDesktopStyles.innerWrap]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: isDesktop ? 20 : insets.top + 10 }]}>
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
                  <Ionicons name="calendar-outline" size={10} color={Colors.primaryDark} />
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
          {statusError && (
            <Text style={styles.actionBarError}>{statusError}</Text>
          )}
        </View>
      )}

      {/* Status badge + progress stepper */}
      {meta && meta.status !== 'pending' && (
        <View style={[styles.statusBadgeRow, isMobile && bookingStatus && ['active', 'in_progress', 'pending_return', 'pending_owner_validation', 'completed'].includes(bookingStatus) && styles.statusBadgeRowColumn]}>
          <BookingBadge status={bookingStatus ?? meta.status} />
          {bookingStatus && ['active', 'in_progress', 'pending_return', 'pending_owner_validation', 'completed'].includes(bookingStatus) && (
            <View style={[styles.progressWrapper, isMobile && styles.progressWrapperFull]}>
              <BookingProgress status={bookingStatus} />
            </View>
          )}
        </View>
      )}

      {/* Handover confirmation card: collapsible, shown when bookingStatus === 'active' */}
      {bookingStatus === 'active' && bookingId && meta && (() => {
        const myConfirmed = meta.isOwner ? handoverConfirmedOwner : handoverConfirmedRenter;
        const otherConfirmed = meta.isOwner ? handoverConfirmedRenter : handoverConfirmedOwner;
        return (
          <View style={styles.confirmCard}>
            <TouchableOpacity
              style={styles.confirmCardPill}
              activeOpacity={0.75}
              onPress={() => setConfirmCardExpanded(v => !v)}
            >
              <View style={styles.confirmCardPillLeft}>
                <Ionicons name="hand-left-outline" size={14} color="#1B4332" />
                <Text style={styles.confirmCardPillTitle}>Confirmer la remise</Text>
                {myConfirmed && (
                  <View style={styles.confirmCardPillBadge}>
                    <Ionicons name="checkmark" size={10} color="#1B4332" />
                    <Text style={styles.confirmCardPillBadgeText}>Confirmé</Text>
                  </View>
                )}
              </View>
              <Ionicons
                name={confirmCardExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#1B4332"
              />
            </TouchableOpacity>
            {confirmCardExpanded && (
              <View style={styles.confirmCardBody}>
                <Text style={styles.confirmCardSub}>
                  Les deux parties doivent confirmer sur place pour démarrer la location.
                </Text>
                <View style={styles.confirmPeers}>
                  <View style={styles.confirmPeerItem}>
                    <Ionicons
                      name={handoverConfirmedOwner ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={handoverConfirmedOwner ? Colors.primaryDark : '#A0A0A0'}
                    />
                    <Text style={[styles.confirmPeerName, handoverConfirmedOwner && styles.confirmPeerDone]}>
                      {meta.ownerUsername} (loueur)
                    </Text>
                  </View>
                  <View style={styles.confirmPeerItem}>
                    <Ionicons
                      name={handoverConfirmedRenter ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={handoverConfirmedRenter ? Colors.primaryDark : '#A0A0A0'}
                    />
                    <Text style={[styles.confirmPeerName, handoverConfirmedRenter && styles.confirmPeerDone]}>
                      {meta.requesterUsername} (locataire)
                    </Text>
                  </View>
                </View>
                {!myConfirmed && (
                  <TouchableOpacity
                    style={[styles.confirmBtn, confirmLoading && { opacity: 0.6 }]}
                    activeOpacity={0.85}
                    onPress={handleConfirmHandover}
                    disabled={confirmLoading}
                  >
                    {confirmLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-outline" size={16} color="#fff" />
                        <Text style={styles.confirmBtnText}>Je confirme la remise</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                {myConfirmed && !otherConfirmed && (
                  <View style={styles.confirmWaitingRow}>
                    <ActivityIndicator size="small" color="#8E9878" />
                    <Text style={styles.confirmWaitingText}>En attente de l'autre partie...</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })()}

      {/* Return confirmation card: collapsible, shown when bookingStatus === 'in_progress' */}
      {bookingStatus === 'in_progress' && bookingId && meta && (() => {
        const myConfirmed = meta.isOwner ? returnConfirmedOwner : returnConfirmedRenter;
        const otherConfirmed = meta.isOwner ? returnConfirmedRenter : returnConfirmedOwner;
        return (
          <View style={[styles.confirmCard, styles.confirmCardReturn]}>
            <TouchableOpacity
              style={[styles.confirmCardPill, styles.confirmCardPillReturn]}
              activeOpacity={0.75}
              onPress={() => setConfirmCardExpanded(v => !v)}
            >
              <View style={styles.confirmCardPillLeft}>
                <Ionicons name="return-down-back-outline" size={14} color="#004085" />
                <Text style={[styles.confirmCardPillTitle, { color: '#004085' }]}>Confirmer le retour</Text>
                {myConfirmed && (
                  <View style={[styles.confirmCardPillBadge, styles.confirmCardPillBadgeReturn]}>
                    <Ionicons name="checkmark" size={10} color="#004085" />
                    <Text style={[styles.confirmCardPillBadgeText, { color: '#004085' }]}>Confirmé</Text>
                  </View>
                )}
              </View>
              <Ionicons
                name={confirmCardExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#004085"
              />
            </TouchableOpacity>
            {confirmCardExpanded && (
              <View style={styles.confirmCardBody}>
                <Text style={styles.confirmCardSub}>
                  Confirmez ensemble quand l'objet a été restitué pour clôturer la location.
                </Text>
                <View style={styles.confirmPeers}>
                  <View style={styles.confirmPeerItem}>
                    <Ionicons
                      name={returnConfirmedOwner ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={returnConfirmedOwner ? '#004085' : '#A0A0A0'}
                    />
                    <Text style={[styles.confirmPeerName, returnConfirmedOwner && { color: '#004085', fontFamily: 'Inter-SemiBold' }]}>
                      {meta.ownerUsername} (loueur)
                    </Text>
                  </View>
                  <View style={styles.confirmPeerItem}>
                    <Ionicons
                      name={returnConfirmedRenter ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={returnConfirmedRenter ? '#004085' : '#A0A0A0'}
                    />
                    <Text style={[styles.confirmPeerName, returnConfirmedRenter && { color: '#004085', fontFamily: 'Inter-SemiBold' }]}>
                      {meta.requesterUsername} (locataire)
                    </Text>
                  </View>
                </View>
                {!myConfirmed && (
                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.confirmBtnReturn, confirmLoading && { opacity: 0.6 }]}
                    activeOpacity={0.85}
                    onPress={handleConfirmReturn}
                    disabled={confirmLoading}
                  >
                    {confirmLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-outline" size={16} color="#fff" />
                        <Text style={styles.confirmBtnText}>Je confirme le retour</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                {myConfirmed && !otherConfirmed && (
                  <View style={styles.confirmWaitingRow}>
                    <ActivityIndicator size="small" color="#8E9878" />
                    <Text style={styles.confirmWaitingText}>En attente de l'autre partie...</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })()}

      {/* Validation banner: shown for both parties during pending_owner_validation */}
      {bookingStatus === 'pending_owner_validation' && !ownerValidated && meta && (
        meta.isOwner ? (
          <TouchableOpacity
            style={styles.validationBanner}
            activeOpacity={0.88}
            onPress={() => setShowValidationModal(true)}
          >
            <View style={styles.validationBannerLeft}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#1A5C38" />
              <View>
                <Text style={styles.validationBannerText}>Valider l'état de l'objet rendu</Text>
                {validationCountdown ? (
                  <Text style={styles.validationCountdown}>Temps restant : {validationCountdown}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.validationBannerBtn}>
              <Text style={styles.validationBannerBtnText}>Vérifier →</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.validationBannerWaiting}>
            <Ionicons name="time-outline" size={16} color="#92400E" />
            <View>
              <Text style={styles.validationBannerWaitingText}>En attente de la validation du propriétaire</Text>
              {validationCountdown ? (
                <Text style={styles.validationCountdown}>Validation auto dans : {validationCountdown}</Text>
              ) : null}
            </View>
          </View>
        )
      )}

      {/* Payment action banner for renter when booking is accepted and not yet paid */}
      {meta && meta.status === 'accepted' && !meta.isOwner && !['active', 'in_progress', 'pending_return', 'pending_owner_validation', 'completed', 'disputed'].includes(bookingStatus ?? '') && (
        stripeReady ? (
          <TouchableOpacity
            style={styles.payBannerGreen}
            activeOpacity={0.88}
            onPress={handlePayPress}
            disabled={payLoading}
          >
            <View style={styles.payBannerGreenLeft}>
              <Text style={styles.payBannerGreenTitle}>
                Demande acceptée · Finalise ta réservation
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
          <View style={styles.payBannerOrange}>
            <View style={styles.payBannerOrangeLeft}>
              <Text style={styles.payBannerOrangeTitle}>
                Le propriétaire n'a pas encore activé son compte de paiement
              </Text>
            </View>
          </View>
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
                  <Ionicons name="location-outline" size={12} color={Colors.primaryDark} />
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
                    <Ionicons name="location-outline" size={12} color={Colors.primaryDark} />
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
          <ActivityIndicator size="small" color={Colors.primaryDark} />
          <Text style={styles.uploadingBannerText}>Envoi en cours...</Text>
        </View>
      )}

      {/* Input */}
      <Animated.View
        style={[
          styles.inputBar,
          { paddingBottom: isDesktop ? 16 : insets.bottom + 8, transform: [{ scale: inputScale }] },
        ]}
      >
        <TouchableOpacity style={styles.attachBtn} onPress={sendFromGallery} activeOpacity={0.7}>
          <Ionicons name="attach-outline" size={20} color={Colors.primaryDark} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.attachBtn} onPress={sendFromCamera} activeOpacity={0.7}>
          <Ionicons name="camera-outline" size={20} color={Colors.primaryDark} />
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

      {/* Owner validation modal: shown when bookingStatus === 'pending_owner_validation' and user is owner */}
      <Modal
        visible={showValidationModal && !!meta?.isOwner}
        transparent
        animationType="slide"
        onRequestClose={() => setShowValidationModal(false)}
      >
        <View style={styles.validationOverlay}>
          <View style={[styles.validationSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.validationHandle} />
            <View style={styles.validationIconRow}>
              <View style={styles.validationIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={32} color="#1A5C38" />
              </View>
            </View>
            <Text style={styles.validationTitle}>L'objet est-il en bon état ?</Text>
            <Text style={styles.validationSub}>
              Vérifiez l'état de l'objet rendu. Si tout est bon, confirmez pour libérer la caution à l'emprunteur. Sinon, ouvrez un litige.
            </Text>

            <TouchableOpacity
              style={[styles.validationBtnOk, confirmLoading && { opacity: 0.6 }]}
              activeOpacity={0.85}
              onPress={handleOwnerValidateOk}
              disabled={confirmLoading}
            >
              {confirmLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.validationBtnOkText}>Tout est OK, libérer la caution</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.validationBtnDispute}
              activeOpacity={0.85}
              onPress={handleOpenDispute}
              disabled={confirmLoading}
            >
              <Ionicons name="warning-outline" size={18} color="#C0392B" />
              <Text style={styles.validationBtnDisputeText}>Signaler un problème, ouvrir un litige</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.validationBtnLater}
              activeOpacity={0.75}
              onPress={() => setShowValidationModal(false)}
              disabled={confirmLoading}
            >
              <Text style={styles.validationBtnLaterText}>Plus tard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
    </View>
  );
}

const chatDesktopStyles = StyleSheet.create({
  outerWrap: {
    backgroundColor: '#f0ede3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerWrap: {
    width: '100%',
    maxWidth: CHAT_MAX_WIDTH,
    alignSelf: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 1px #e8e4d8, 0 8px 40px rgba(0,0,0,0.08)',
      },
    }),
    backgroundColor: Colors.background,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },

  topBar: {
    backgroundColor: Colors.white,
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
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
    backgroundColor: Colors.primarySurface,
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
    borderColor: Colors.border,
  },
  topBarListingImgFallback: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    flexShrink: 0,
  },
  topBarListingBody: { flex: 1, gap: 4 },
  topBarListingTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
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
    color: Colors.primaryDark,
  },
  topBarDaysChip: {
    backgroundColor: Colors.primaryDark,
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
    color: Colors.text,
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
    color: Colors.text,
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
    borderColor: Colors.primary,
    flexShrink: 0,
  },
  topBarAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySurface,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  topBarAvatarInitial: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.primaryDark,
  },

  recapCard: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.white,
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
    backgroundColor: Colors.primarySurface,
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
    color: Colors.text,
    letterSpacing: -0.2,
    flex: 1,
  },
  recapPriceTag: {
    backgroundColor: Colors.primaryDark,
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
    backgroundColor: Colors.borderLight,
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
    color: Colors.text,
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
    backgroundColor: Colors.primaryDark,
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
    backgroundColor: Colors.primarySurface,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  recapCityText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.primaryDark,
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
    backgroundColor: Colors.primarySurface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  systemMsgText: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: Colors.primaryDark },

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
    backgroundColor: Colors.primaryDark,
    borderBottomRightRadius: 5,
  },
  bubbleText: { fontFamily: 'Inter-Regular', fontSize: 15, color: Colors.text, lineHeight: 22 },
  bubbleTextOwn: { color: Colors.white },
  msgTime: { fontFamily: 'Inter-Regular', fontSize: 10, color: Colors.textMuted, marginTop: 2, marginLeft: 4 },
  msgTimeOwn: { marginLeft: 0, marginRight: 4 },

  emptyChat: { alignItems: 'center', paddingTop: 60 },
  emptyChatText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.text, marginBottom: 4 },
  emptyChatSub: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.textMuted },

  inputBar: {
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 4 },
      web: { boxShadow: '0 -2px 8px rgba(0,0,0,0.05)' },
    }),
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: Colors.text,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#DDD9CC',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8 },
      android: { elevation: 4 },
      web: { boxShadow: '0 3px 10px rgba(142,152,120,0.4)' },
    }),
  },
  sendBtnDisabled: { opacity: 0.45 },

  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4DAC4',
    flexShrink: 0,
  },
  actionBar: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
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
  actionBarError: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#C0392B',
    textAlign: 'center',
    marginTop: 6,
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
    color: Colors.error,
  },
  actionBtnAccept: {
    backgroundColor: Colors.primaryDark,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8 },
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.white,
    gap: 10,
  },
  progressWrapper: {
    flex: 1,
  },
  progressWrapperFull: {
    width: '100%',
    flex: undefined,
  },
  statusBadgeRowColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  confirmCard: {
    backgroundColor: '#ECFDF5',
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0',
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  confirmCardReturn: {
    backgroundColor: '#EFF6FF',
    borderBottomColor: '#BFDBFE',
  },
  confirmCardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  confirmCardPillReturn: {},
  confirmCardPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  confirmCardPillTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.primaryDark,
  },
  confirmCardPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#D1FAE5',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  confirmCardPillBadgeReturn: {
    backgroundColor: '#DBEAFE',
  },
  confirmCardPillBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: Colors.primaryDark,
  },
  confirmCardBody: {
    paddingBottom: 14,
    gap: 10,
  },
  confirmCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmCardTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    color: Colors.primaryDark,
    letterSpacing: -0.1,
  },
  confirmCardSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#555',
    lineHeight: 17,
  },
  confirmPeers: {
    flexDirection: 'row',
    gap: 16,
  },
  confirmPeerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confirmPeerName: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#888',
  },
  confirmPeerDone: {
    color: Colors.primaryDark,
    fontFamily: 'Inter-SemiBold',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 999,
    backgroundColor: Colors.primaryDark,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 3 },
      web: { boxShadow: '0 3px 10px rgba(27,67,50,0.3)' },
    }),
  },
  confirmBtnReturn: {
    backgroundColor: '#1D4ED8',
    ...Platform.select({
      ios: { shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 3 },
      web: { boxShadow: '0 3px 10px rgba(29,78,216,0.3)' },
    }),
  },
  confirmBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: '#fff',
  },
  confirmWaitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmWaitingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8E9878',
    fontStyle: 'italic',
  },
  validationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#D1FAE5',
    borderBottomWidth: 1,
    borderBottomColor: '#6EE7B7',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  validationBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  validationBannerText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#1A5C38',
  },
  validationBannerBtn: {
    backgroundColor: '#1A5C38',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  validationBannerBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    color: '#fff',
  },
  validationCountdown: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
  validationBannerWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  validationBannerWaitingText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#92400E',
  },
  validationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  validationSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 14,
  },
  validationHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 6,
  },
  validationIconRow: {
    alignItems: 'center',
  },
  validationIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  validationTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: Colors.text,
    textAlign: 'center',
  },
  validationSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 21,
  },
  validationBtnOk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1A5C38',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
    ...Platform.select({
      ios: { shadowColor: '#1A5C38', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 12px rgba(26,92,56,0.3)' },
    }),
  },
  validationBtnOkText: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: '#fff',
  },
  validationBtnDispute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FDF2F2',
    borderWidth: 1,
    borderColor: '#F5C6CB',
    borderRadius: 14,
    paddingVertical: 14,
  },
  validationBtnDisputeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.error,
  },
  validationBtnLater: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  validationBtnLaterText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#999',
  },
  bubblePending: { opacity: 0.65 },
  bubbleDesktop: { maxWidth: '65%' },
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
    color: Colors.text,
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
    color: Colors.notification,
  },
  uploadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primarySurface,
    borderTopWidth: 1,
    borderTopColor: '#D4DAC4',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  uploadingBannerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.primaryDark,
  },
  payBannerGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: Colors.primaryDark,
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
    color: Colors.primaryDark,
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
