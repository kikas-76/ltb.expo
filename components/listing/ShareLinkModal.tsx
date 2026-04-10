import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Share,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';


const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

interface ShareLinkModalProps {
  visible: boolean;
  onClose: () => void;
  listingId: string;
  listingName: string;
  pricePerDay: number;
  bookedRanges: { start: Date; end: Date }[];
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function stripTime(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isDateBooked(day: Date, bookedRanges: { start: Date; end: Date }[]): boolean {
  const stripped = stripTime(day);
  return bookedRanges.some(({ start, end }) => stripped >= stripTime(start) && stripped <= stripTime(end));
}

function isInRange(day: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  const d = stripTime(day);
  return d > stripTime(start) && d < stripTime(end);
}

function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}

interface MiniCalendarProps {
  startDate: Date | null;
  endDate: Date | null;
  onSelect: (start: Date | null, end: Date | null) => void;
  bookedRanges: { start: Date; end: Date }[];
}

function MiniCalendar({ startDate, endDate, onSelect, bookedRanges }: MiniCalendarProps) {
  const today = stripTime(new Date());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');

  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);

  let startDow = firstDay.getDay();
  if (startDow === 0) startDow = 7;
  const leadingBlanks = startDow - 1;
  const totalDays = lastDay.getDate();

  const cells: (Date | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ];

  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleDayPress = (day: Date) => {
    const stripped = stripTime(day);
    if (stripped < today) return;
    if (isDateBooked(stripped, bookedRanges)) return;

    if (selecting === 'start' || !startDate) {
      onSelect(stripped, null);
      setSelecting('end');
    } else {
      if (stripped < startDate) {
        onSelect(stripped, null);
        setSelecting('end');
      } else if (isSameDay(stripped, startDate)) {
        onSelect(null, null);
        setSelecting('start');
      } else {
        let hasBooked = false;
        let cur = new Date(startDate.getTime() + 86400000);
        while (cur < stripped) {
          if (isDateBooked(cur, bookedRanges)) { hasBooked = true; break; }
          cur = new Date(cur.getTime() + 86400000);
        }
        if (hasBooked) {
          onSelect(stripped, null);
          setSelecting('end');
        } else {
          onSelect(startDate, stripped);
          setSelecting('start');
        }
      }
    }
  };

  return (
    <View style={calStyles.wrap}>
      <View style={calStyles.nav}>
        <TouchableOpacity onPress={prevMonth} style={calStyles.navBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={calStyles.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={nextMonth} style={calStyles.navBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={18} color={Colors.primaryDark} />
        </TouchableOpacity>
      </View>

      <View style={calStyles.dayLabels}>
        {DAY_LABELS.map(l => <Text key={l} style={calStyles.dayLabel}>{l}</Text>)}
      </View>

      {rows.map((row, ri) => (
        <View key={ri} style={calStyles.row}>
          {row.map((day, di) => {
            if (!day) return <View key={di} style={calStyles.cell} />;
            const stripped = stripTime(day);
            const isPast = stripped < today;
            const isBooked = isDateBooked(stripped, bookedRanges);
            const isStart = startDate && isSameDay(stripped, startDate);
            const isEnd = endDate && isSameDay(stripped, endDate);
            const inRange = isInRange(stripped, startDate, endDate);
            const disabled = isPast || isBooked;
            return (
              <TouchableOpacity
                key={di}
                style={[
                  calStyles.cell,
                  isStart && calStyles.cellStart,
                  isEnd && calStyles.cellEnd,
                  inRange && calStyles.cellInRange,
                  disabled && calStyles.cellDisabled,
                ]}
                onPress={() => !disabled && handleDayPress(day)}
                activeOpacity={disabled ? 1 : 0.7}
                disabled={disabled}
              >
                <Text style={[
                  calStyles.cellText,
                  (isStart || isEnd) && calStyles.cellTextSelected,
                  inRange && calStyles.cellTextInRange,
                  disabled && calStyles.cellTextDisabled,
                  isBooked && calStyles.cellTextBooked,
                ]}>
                  {day.getDate()}
                </Text>
                {isBooked && <View style={calStyles.bookedDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const calStyles = StyleSheet.create({
  wrap: { marginTop: 8 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.text, letterSpacing: -0.2 },
  dayLabels: { flexDirection: 'row', marginBottom: 4 },
  dayLabel: { flex: 1, textAlign: 'center', fontFamily: 'Inter-Medium', fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase' },
  row: { flexDirection: 'row', marginBottom: 2 },
  cell: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  cellStart: { backgroundColor: Colors.primaryDark },
  cellEnd: { backgroundColor: Colors.primaryDark },
  cellInRange: { backgroundColor: '#D4DAC4' },
  cellDisabled: { opacity: 0.35 },
  cellText: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.text },
  cellTextSelected: { color: '#fff', fontFamily: 'Inter-Bold' },
  cellTextInRange: { color: Colors.primaryDark, fontFamily: 'Inter-Medium' },
  cellTextDisabled: { color: Colors.textMuted },
  cellTextBooked: { textDecorationLine: 'line-through' },
  bookedDot: { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.notification },
});

export default function ShareLinkModal({ visible, onClose, listingId, listingName, pricePerDay, bookedRanges }: ShareLinkModalProps) {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);

  const days = startDate && endDate
    ? Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1
    : 0;

  useEffect(() => {
    setCopied(false);
  }, [startDate, endDate]);

  useEffect(() => {
    if (!visible) {
      setStartDate(null);
      setEndDate(null);
      setCopied(false);
    }
  }, [visible]);

  const discount = days >= 7 ? 0.2 : days >= 3 ? 0.1 : 0;
  const basePrice = days > 0 ? pricePerDay * days : 0;
  const discountAmt = Math.round(basePrice * discount);
  const totalPrice = Math.round(basePrice * (1 - discount));
  const serviceFee = Math.round(totalPrice * 0.07 * 100) / 100;
  const totalWithFee = (totalPrice + serviceFee).toFixed(2);
  const ownerReceives = Math.round(totalPrice * 0.92);

  const getBaseUrl = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://louetonbien-auth-nav-6fz1.bolt.host';
  };

  const link = startDate && endDate
    ? `${getBaseUrl()}/book/${listingId}?start=${toISO(startDate)}&end=${toISO(endDate)}`
    : '';

  const handleSelect = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
  };

  const handleCopy = async () => {
    if (!link) return;
    if (Platform.OS === 'web' && typeof (navigator as any)?.clipboard !== 'undefined') {
      try {
        await (navigator as any).clipboard.writeText(link);
      } catch {
        await Share.share({ message: link });
      }
    } else {
      await Share.share({ message: link });
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleShare = async () => {
    if (!link || !startDate || !endDate) return;
    const text = `Loue "${listingName}" du ${startDate.toLocaleDateString('fr-FR')} au ${endDate.toLocaleDateString('fr-FR')} pour ${totalPrice}€ sur LoueTonBien`;
    if (Platform.OS === 'web' && typeof (navigator as any)?.share !== 'undefined') {
      try {
        await (navigator as any).share({ title: listingName, text, url: link });
        return;
      } catch {}
    }
    await Share.share({ message: `${text}\n${link}` });
  };

  const canShare = Platform.OS === 'web' && typeof (navigator as any)?.share !== 'undefined';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Ionicons name="link-outline" size={18} color={Colors.primaryDark} />
              </View>
              <Text style={styles.title}>Lien de réservation directe</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-outline" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Sélectionne les dates et partage le lien. Le locataire pourra réserver et payer directement, sans validation de ta part.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <MiniCalendar
              startDate={startDate}
              endDate={endDate}
              onSelect={handleSelect}
              bookedRanges={bookedRanges}
            />

            {startDate && endDate && days > 0 && (
              <View style={styles.priceBox}>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>{pricePerDay}€ × {days} jour{days > 1 ? 's' : ''}</Text>
                  <Text style={styles.priceValue}>{Math.round(basePrice)}€</Text>
                </View>
                {discount > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: Colors.primaryDark }]}>
                      Remise {Math.round(discount * 100)}% {days >= 7 ? '(7+ jours)' : '(3+ jours)'}
                    </Text>
                    <Text style={[styles.priceValue, { color: Colors.primaryDark }]}>-{discountAmt}€</Text>
                  </View>
                )}
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Frais de service (7%)</Text>
                  <Text style={styles.priceValue}>{serviceFee.toFixed(2)}€</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.priceRow}>
                  <Text style={styles.totalLabel}>Total locataire</Text>
                  <Text style={styles.totalValue}>{totalWithFee}€</Text>
                </View>
                <View style={styles.ownerReceivesRow}>
                  <Ionicons name="wallet-outline" size={13} color={Colors.primaryDark} />
                  <Text style={styles.ownerReceivesText}>
                    Tu recevras environ {ownerReceives}€ (après 8% de commission)
                  </Text>
                </View>
              </View>
            )}

            {link ? (
              <View style={styles.linkBox}>
                <View style={styles.linkBoxHeader}>
                  <Ionicons name="link" size={14} color={Colors.primaryDark} />
                  <Text style={styles.linkBoxLabel}>Lien généré</Text>
                </View>
                <Text style={styles.linkText} numberOfLines={3} selectable>{link}</Text>
                <View style={styles.linkActions}>
                  <TouchableOpacity style={[styles.copyBtn, copied && styles.copyBtnDone]} onPress={handleCopy} activeOpacity={0.85}>
                    <Ionicons name={copied ? 'checkmark-outline' : 'copy-outline'} size={16} color="#fff" />
                    <Text style={styles.copyBtnText}>{copied ? 'Copié !' : 'Copier le lien'}</Text>
                  </TouchableOpacity>
                  {canShare && (
                    <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
                      <Ionicons name="share-social-outline" size={16} color={Colors.primaryDark} />
                      <Text style={styles.shareBtnText}>Partager</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.hintBox}>
                <Ionicons name="calendar-outline" size={28} color={Colors.primary} />
                <Text style={styles.hintText}>Sélectionne des dates pour générer le lien</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '90%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20 },
      android: { elevation: 12 },
      web: { boxShadow: '0 -4px 32px rgba(0,0,0,0.12)' },
    }),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D9D5C8',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
    letterSpacing: -0.3,
    flex: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#F0EDE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 4,
  },
  priceBox: {
    backgroundColor: '#F0F4E8',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  priceValue: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: '#C8D4B4',
    marginVertical: 4,
  },
  totalLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  totalValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  ownerReceivesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    backgroundColor: '#E2EAD6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ownerReceivesText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.primaryDark,
    flex: 1,
    lineHeight: 17,
  },
  linkBox: {
    backgroundColor: '#EEF2DF',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  linkBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkBoxLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  linkText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    ...Platform.select({ web: { wordBreak: 'break-all' as any } }),
  },
  linkActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 3px 10px rgba(142,152,120,0.35)' },
    }),
  },
  copyBtnDone: {
    backgroundColor: '#2a5c3a',
  },
  copyBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#fff',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    justifyContent: 'center',
  },
  shareBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.primaryDark,
  },
  hintBox: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  hintText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
