import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Linking,
  LayoutAnimation,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import helpData, { HelpQuestion } from '@/data/help-data';

const BG = '#F5F0E8';
const GREEN = '#8E9878';
const GREEN_LIGHT = '#D4DAC4';
const GREEN_BG = '#EEF1E8';
const CARD = '#FFFFFF';

const ICON_MAP: Record<string, string> = {
  Rocket: 'rocket-outline',
  Package: 'cube-outline',
  Infinity: 'infinite-outline',
  CreditCard: 'card-outline',
  ShieldCheck: 'shield-checkmark-outline',
};

const ICON_COLORS: Record<string, { bg: string; fg: string }> = {
  Rocket:     { bg: '#E8EFF8', fg: '#4A7FC1' },
  Package:    { bg: '#FDF3E7', fg: '#C47A2A' },
  Infinity:   { bg: '#EAF4EE', fg: '#3A9E5F' },
  CreditCard: { bg: '#F3EDF9', fg: '#8A5BBF' },
  ShieldCheck:{ bg: '#FEF0ED', fg: '#C94E3A' },
};

function AccordionItem({ item, isLast }: { item: HelpQuestion; isLast: boolean }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.accordionRow}
        onPress={toggle}
        activeOpacity={0.75}
      >
        <View style={[styles.accordionIndicator, open && styles.accordionIndicatorActive]} />
        <View style={styles.accordionContent}>
          <Text style={[styles.accordionQuestion, open && styles.accordionQuestionOpen]}>
            {item.question}
          </Text>
          {open && (
            <Text style={styles.accordionAnswer}>{item.answer}</Text>
          )}
        </View>
        <View style={[styles.chevronWrap, open && styles.chevronWrapActive]}>
          <Ionicons
            name="chevron-down-outline"
            size={15}
            color={open ? GREEN : '#C0B8A8'}
            style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
          />
        </View>
      </TouchableOpacity>
      {!isLast && <View style={styles.divider} />}
    </>
  );
}

export default function HelpCategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const insets = useSafeAreaInsets();

  const cat = helpData.find((c) => c.id === category);
  const ionIconName = cat ? (ICON_MAP[cat.icon] ?? 'help-circle-outline') : 'help-circle-outline';
  const colors = cat ? (ICON_COLORS[cat.icon] ?? { bg: GREEN_BG, fg: GREEN }) : { bg: GREEN_BG, fg: GREEN };

  if (!cat) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back-outline" size={20} color="#1C1C18" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Centre d'aide</Text>
        </View>
        <View style={styles.notFound}>
          <Ionicons name="help-circle-outline" size={40} color={GREEN_LIGHT} />
          <Text style={styles.notFoundText}>Catégorie introuvable.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={20} color="#1C1C18" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {cat.title}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 56 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: colors.bg }]}>
            <Ionicons name={ionIconName as any} size={32} color={colors.fg} />
          </View>
          <Text style={styles.heroTitle}>{cat.title}</Text>
          <Text style={styles.heroDesc}>{cat.description}</Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{cat.questions.length} articles</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Questions fréquentes</Text>
          <View style={styles.questionsCard}>
            {cat.questions.map((item, i) => (
              <AccordionItem
                key={item.id}
                item={item}
                isLast={i === cat.questions.length - 1}
              />
            ))}
          </View>
        </View>

        <View style={styles.contactCard}>
          <View style={styles.contactIconWrap}>
            <Ionicons name="mail-outline" size={22} color={GREEN} />
          </View>
          <Text style={styles.contactTitle}>Vous n'avez pas trouvé votre réponse ?</Text>
          <Text style={styles.contactSubtitle}>Notre équipe répond généralement sous 24h ouvrées.</Text>
          <TouchableOpacity
            style={styles.contactBtn}
            activeOpacity={0.82}
            onPress={() => Linking.openURL('mailto:admin@louetonbien.fr')}
          >
            <Ionicons name="mail-outline" size={15} color="#FFF" />
            <Text style={styles.contactBtnText}>Contacter le support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 56,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: BG,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#1C1C18',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 24,
  },
  heroSection: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: '#1C1C18',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#7A7A70',
    textAlign: 'center',
  },
  heroBadge: {
    backgroundColor: GREEN_BG,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: GREEN_LIGHT,
    marginTop: 4,
  },
  heroBadgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: GREEN,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: '#A8A8A0',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginLeft: 2,
  },
  questionsCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0EBE0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
    }),
  },
  accordionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  accordionIndicator: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: '#E8E3D8',
    marginTop: 1,
    flexShrink: 0,
  },
  accordionIndicatorActive: {
    backgroundColor: GREEN,
  },
  accordionContent: {
    flex: 1,
    gap: 8,
  },
  accordionQuestion: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#1C1C18',
    lineHeight: 20,
  },
  accordionQuestionOpen: {
    color: GREEN,
  },
  accordionAnswer: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 22,
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F5F0E8',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 0,
  },
  chevronWrapActive: {
    backgroundColor: GREEN_BG,
  },
  divider: {
    height: 1,
    backgroundColor: '#F5F0E8',
    marginHorizontal: 16,
  },
  contactCard: {
    backgroundColor: GREEN_BG,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: GREEN_LIGHT,
  },
  contactIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: GREEN_LIGHT,
  },
  contactTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: '#1C1C18',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  contactSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 4,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: GREEN,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  contactBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: '#A8A8A0',
  },
});
