import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import helpData, { HelpCategory } from '@/data/help-data';
import { Colors } from '@/constants/colors';

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

function CategoryIcon({ iconName, size = 20 }: { iconName: string; size?: number }) {
  const ionName = ICON_MAP[iconName] ?? 'help-circle-outline';
  const colors = ICON_COLORS[iconName] ?? { bg: GREEN_BG, fg: Colors.primaryDark };
  return (
    <View style={[styles.iconWrap, { backgroundColor: colors.bg }]}>
      <Ionicons name={ionName as any} size={size} color={colors.fg} />
    </View>
  );
}

export default function HelpCenterScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    const results: { categoryTitle: string; categoryId: string; question: string; answer: string; qId: string }[] = [];
    for (const cat of helpData) {
      for (const item of cat.questions) {
        if (item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q)) {
          results.push({
            categoryTitle: cat.title,
            categoryId: cat.id,
            question: item.question,
            answer: item.answer,
            qId: item.id,
          });
        }
      }
    }
    return results;
  }, [query]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Centre d'aide</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 56 }, isDesktop && styles.scrollDesktop]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.heroSection, isDesktop && styles.heroSectionDesktop]}>
          <View style={styles.heroIcon}>
            <Ionicons name="help-circle-outline" size={28} color={Colors.primaryDark} />
          </View>
          <Text style={styles.heroTitle}>Comment pouvons-nous{'\n'}vous aider ?</Text>
        </View>

        <View style={[styles.searchBox, isDesktop && styles.searchBoxDesktop]}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une question..."
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <View style={styles.clearBtn}>
                <Ionicons name="close-outline" size={11} color={Colors.textSecondary} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {searchResults !== null ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {searchResults.length === 0
                ? 'Aucun résultat'
                : `${searchResults.length} résultat${searchResults.length > 1 ? 's' : ''}`}
            </Text>
            {searchResults.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="search-outline" size={32} color={Colors.primarySurface} />
                <Text style={styles.emptyTitle}>Aucun résultat trouvé</Text>
                <Text style={styles.emptyText}>Essayez d'autres mots-clés ou contactez notre support.</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {searchResults.map((r, i) => (
                  <SearchResultRow
                    key={r.qId}
                    result={r}
                    isLast={i === searchResults.length - 1}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Catégories</Text>
            <View style={[styles.categoriesGrid, isDesktop && styles.categoriesGridDesktop]}>
              {helpData.map((cat) => (
                <CategoryCard key={cat.id} category={cat} isDesktop={isDesktop} />
              ))}
            </View>
          </View>
        )}

        <View style={styles.contactCard}>
          <View style={styles.contactIconWrap}>
            <Ionicons name="mail-outline" size={22} color={Colors.primaryDark} />
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

function CategoryCard({ category, isDesktop }: { category: HelpCategory; isDesktop?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.categoryCard, isDesktop && styles.categoryCardDesktop]}
      activeOpacity={0.75}
      onPress={() => router.push(`/help/${category.id}` as any)}
    >
      <CategoryIcon iconName={category.icon} size={20} />
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryTitle} numberOfLines={2}>{category.title}</Text>
        <Text style={styles.categoryDesc} numberOfLines={1}>{category.description}</Text>
      </View>
      <View style={styles.categoryMeta}>
        <Text style={styles.categoryCount}>{category.questions.length}</Text>
        <Ionicons name="chevron-forward-outline" size={14} color="#C0B8A8" />
      </View>
    </TouchableOpacity>
  );
}

function SearchResultRow({
  result,
  isLast,
}: {
  result: { categoryTitle: string; question: string; answer: string };
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.searchResultRow}
        activeOpacity={0.75}
        onPress={() => setOpen((v) => !v)}
      >
        <View style={styles.searchResultContent}>
          <Text style={styles.searchResultCategory}>{result.categoryTitle}</Text>
          <Text style={styles.searchResultQuestion}>{result.question}</Text>
          {open && <Text style={styles.searchResultAnswer}>{result.answer}</Text>}
        </View>
        <Ionicons
          name="chevron-forward-outline"
          size={15}
          color={open ? Colors.primaryDark : '#C0B8A8'}
          style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}
        />
      </TouchableOpacity>
      {!isLast && <View style={styles.divider} />}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: Colors.background,
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
    color: Colors.text,
    letterSpacing: -0.2,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 24,
  },
  heroSection: {
    alignItems: 'center',
    gap: 12,
    paddingBottom: 4,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: GREEN_BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primarySurface,
  },
  heroTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E8E3D8',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
    }),
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.text,
    height: '100%',
  },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E8E3D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginLeft: 2,
  },
  categoriesGrid: {
    gap: 10,
  },
  categoriesGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCardDesktop: {
    flex: 1,
    flexBasis: '47%',
    minWidth: 0,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  scrollDesktop: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  heroSectionDesktop: {
    paddingVertical: 48,
  },
  searchBoxDesktop: {
    height: 52,
    borderRadius: 999,
    paddingHorizontal: 20,
  },
  categoryCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 6px rgba(0,0,0,0.04)' },
    }),
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  categoryInfo: {
    flex: 1,
    gap: 2,
  },
  categoryTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  categoryDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  categoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryCount: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#C0B8A8',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.background,
    marginHorizontal: 16,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
    }),
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  searchResultContent: {
    flex: 1,
    gap: 3,
  },
  searchResultCategory: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  searchResultQuestion: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  searchResultAnswer: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 6,
  },
  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  emptyTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.text,
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  contactCard: {
    backgroundColor: GREEN_BG,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primarySurface,
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
    borderColor: Colors.primarySurface,
  },
  contactTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.text,
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
    backgroundColor: Colors.primaryDark,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  contactBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});
