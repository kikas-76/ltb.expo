import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_DAYS = 7;
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

interface DateRangeCalendarProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (start: Date, end: Date, days: number) => void;
  pricePerDay: number;
  bookedRanges?: { start: Date; end: Date }[];
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function daysBetween(a: Date, b: Date) {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

function toKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function stripTime(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isDateBooked(day: Date, bookedRanges: { start: Date; end: Date }[]): boolean {
  for (const range of bookedRanges) {
    const start = stripTime(range.start);
    const end = stripTime(range.end);
    if (day >= start && day <= end) return true;
  }
  return false;
}

function rangeOverlapsBooked(start: Date, end: Date, bookedRanges: { start: Date; end: Date }[]): boolean {
  for (const range of bookedRanges) {
    const bs = stripTime(range.start);
    const be = stripTime(range.end);
    if (start <= be && end >= bs) return true;
  }
  return false;
}

export default function DateRangeCalendar({
  visible,
  onClose,
  onConfirm,
  pricePerDay,
  bookedRanges = [],
}: DateRangeCalendarProps) {
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [rendered, setRendered] = useState(false);

  const today = stripTime(new Date());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      setStartDate(null);
      setEndDate(null);
      setViewMonth(today.getMonth());
      setViewYear(today.getFullYear());
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 25,
          stiffness: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => setRendered(false));
    }
  }, [visible]);

  const selectedDays = startDate && endDate ? daysBetween(startDate, endDate) : startDate ? 1 : 0;

  const discount = selectedDays >= 7 ? 0.2 : selectedDays >= 3 ? 0.1 : 0;
  const totalBeforeDiscount = selectedDays * pricePerDay;
  const totalPrice = Math.round(totalBeforeDiscount * (1 - discount));

  const handleDayPress = useCallback((day: Date) => {
    if (day < today) return;
    if (isDateBooked(day, bookedRanges)) return;

    if (!startDate || (startDate && endDate)) {
      setStartDate(day);
      setEndDate(null);
      return;
    }

    if (isSameDay(day, startDate)) {
      setStartDate(null);
      setEndDate(null);
      return;
    }

    let s = startDate;
    let e = day;
    if (day < startDate) {
      s = day;
      e = startDate;
    }

    const range = daysBetween(s, e);
    if (range > MAX_DAYS) {
      const maxEnd = new Date(s);
      maxEnd.setDate(maxEnd.getDate() + MAX_DAYS - 1);
      e = maxEnd;
    }

    if (rangeOverlapsBooked(s, e, bookedRanges)) {
      setStartDate(day);
      setEndDate(null);
      return;
    }

    setStartDate(s);
    setEndDate(e);
  }, [startDate, endDate, today, bookedRanges]);

  const handleConfirm = () => {
    if (startDate) {
      onConfirm(startDate, endDate ?? startDate, selectedDays);
    }
  };

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const isPrevDisabled =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth <= today.getMonth());

  const calendarDays = buildCalendarDays(viewYear, viewMonth);

  if (!rendered) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.handle} />

        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>Dates de location</Text>
            <Text style={styles.sheetSubtitle}>{MAX_DAYS} jours max.</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close-outline" size={18} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.scrollInner}
        >
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={goToPrevMonth}
              disabled={isPrevDisabled}
              style={[styles.monthNavBtn, isPrevDisabled && styles.monthNavBtnDisabled]}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back-outline" size={18} color={isPrevDisabled ? Colors.borderLight : Colors.text} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={goToNextMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-forward-outline" size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.dayLabelsRow}>
            {DAY_LABELS.map((l) => (
              <View key={l} style={styles.dayLabelCell}>
                <Text style={styles.dayLabelText}>{l}</Text>
              </View>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {calendarDays.map((day, idx) => {
              if (!day) {
                return <View key={`empty-${idx}`} style={styles.dayCell} />;
              }

              const isPast = day < today;
              const isBooked = !isPast && isDateBooked(day, bookedRanges);
              const isDisabled = isPast || isBooked;
              const isToday = isSameDay(day, today);
              const isStart = startDate ? isSameDay(day, startDate) : false;
              const isEnd = endDate ? isSameDay(day, endDate) : false;
              const isInRange =
                startDate && endDate && day > startDate && day < endDate;
              const isSelected = isStart || isEnd;

              return (
                <TouchableOpacity
                  key={toKey(day)}
                  style={styles.dayCell}
                  onPress={() => handleDayPress(day)}
                  disabled={isDisabled}
                  activeOpacity={0.6}
                >
                  {isInRange && !isBooked && (
                    <View style={styles.rangeBg} />
                  )}
                  {isStart && endDate && !isBooked && (
                    <View style={[styles.rangeBg, styles.rangeBgHalfRight]} />
                  )}
                  {isEnd && !isBooked && (
                    <View style={[styles.rangeBg, styles.rangeBgHalfLeft]} />
                  )}
                  <View
                    style={[
                      styles.dayInner,
                      isSelected && !isBooked && styles.daySelected,
                      isToday && !isSelected && !isBooked && styles.dayToday,
                      isBooked && styles.dayBooked,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isPast && styles.dayTextDisabled,
                        isBooked && styles.dayTextBooked,
                        isSelected && !isBooked && styles.dayTextSelected,
                        isInRange && !isBooked && styles.dayTextRange,
                        isToday && !isSelected && !isBooked && styles.dayTextToday,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                    {isBooked && (
                      <View style={styles.bookedStrikeWrap} pointerEvents="none">
                        <View style={styles.bookedStrike} />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {bookedRanges.length > 0 && (
            <View style={styles.legendRow}>
              <View style={styles.legendDot} />
              <Text style={styles.legendText}>Dates indisponibles (demandes en cours)</Text>
            </View>
          )}

          {selectedDays > 0 && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {selectedDays} jour{selectedDays > 1 ? 's' : ''} x {pricePerDay}€
                </Text>
                <Text style={styles.summaryValue}>{totalBeforeDiscount}€</Text>
              </View>
              {discount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryDiscountLabel}>
                    Remise {Math.round(discount * 100)}%
                  </Text>
                  <Text style={styles.summaryDiscountValue}>
                    -{Math.round(totalBeforeDiscount * discount)}€
                  </Text>
                </View>
              )}
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTotalLabel}>Total</Text>
                <Text style={styles.summaryTotalValue}>{totalPrice}€</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.sheetFooter}>
          <TouchableOpacity
            style={[styles.confirmBtn, selectedDays === 0 && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={selectedDays === 0}
            activeOpacity={0.85}
          >
            <Ionicons name="calendar-outline" size={16} color="#fff" />
            <Text style={styles.confirmBtnText}>
              {selectedDays === 0
                ? 'Sélectionnez des dates'
                : `Confirmer (${totalPrice}€)`}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  let startDow = firstDay.getDay();
  if (startDow === 0) startDow = 7;
  startDow -= 1;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];

  for (let i = 0; i < startDow; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

const CELL_SIZE = Math.floor((SCREEN_WIDTH - 48) / 7);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 100,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 101,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.85,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: { elevation: 20 },
      web: { boxShadow: '0 -6px 30px rgba(0,0,0,0.15)' },
    }),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sheetTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  sheetSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollInner: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 8,
  },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthNavBtnDisabled: {
    opacity: 0.35,
  },
  monthLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: Colors.text,
    letterSpacing: -0.2,
  },

  dayLabelsRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  dayLabelCell: {
    width: CELL_SIZE,
    alignItems: 'center',
  },
  dayLabelText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.textMuted,
  },

  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayInner: {
    width: CELL_SIZE - 6,
    height: CELL_SIZE - 6,
    borderRadius: (CELL_SIZE - 6) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  daySelected: {
    backgroundColor: Colors.primary,
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  dayText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.text,
  },
  dayTextDisabled: {
    color: Colors.borderLight,
  },
  dayTextSelected: {
    color: '#fff',
    fontFamily: 'Inter-Bold',
  },
  dayTextRange: {
    color: Colors.primary,
    fontFamily: 'Inter-SemiBold',
  },
  dayTextToday: {
    color: Colors.primary,
    fontFamily: 'Inter-Bold',
  },

  rangeBg: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
    right: 0,
    backgroundColor: Colors.primaryLight + '70',
    zIndex: 1,
  },
  rangeBgHalfRight: {
    left: '50%',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  rangeBgHalfLeft: {
    right: '50%',
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  dayBooked: {
    backgroundColor: Colors.borderLight,
  },
  dayTextBooked: {
    color: Colors.textMuted,
    opacity: 0.6,
  },
  bookedStrikeWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookedStrike: {
    position: 'absolute',
    height: 1.5,
    width: '70%',
    backgroundColor: Colors.textMuted,
    opacity: 0.45,
    transform: [{ rotate: '-35deg' }],
    borderRadius: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  legendText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },

  summaryCard: {
    marginTop: 16,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.text,
  },
  summaryDiscountLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.primary,
  },
  summaryDiscountValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.primary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 4,
  },
  summaryTotalLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.text,
  },
  summaryTotalValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.text,
    letterSpacing: -0.3,
  },

  sheetFooter: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 100,
    height: 52,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 16px rgba(183,191,156,0.5)' },
    }),
  },
  confirmBtnDisabled: {
    backgroundColor: Colors.border,
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
      web: { boxShadow: 'none' },
    }),
  },
  confirmBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.2,
  },
});
