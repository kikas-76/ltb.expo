import { useState } from 'react';
import { Tabs, router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Text, View, StyleSheet, Platform, Image } from 'react-native';
import { Colors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnread } from '@/contexts/UnreadContext';
import { useResponsive } from '@/hooks/useResponsive';

const TAB_BAR_HEIGHT = 58;
const WEB_BOTTOM_PAD = Platform.OS === 'web' ? 8 : 0;
const SIDEBAR_WIDTH_OPEN = 240;
const SIDEBAR_WIDTH_CLOSED = 68;

interface TabItemProps {
  icon: React.ReactNode;
  label: string;
  focused: boolean;
  showDot?: boolean;
}

function TabItem({ icon, label, focused, showDot }: TabItemProps) {
  return (
    <View style={styles.tabItem}>
      <View style={styles.iconWrapper}>
        {icon}
        {showDot && <View style={styles.notifDot} />}
      </View>
      <Text
        style={[styles.tabLabel, { color: focused ? Colors.primary : '#9CA3AF' }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {label}
      </Text>
    </View>
  );
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  focused: boolean;
  onPress: () => void;
  showDot?: boolean;
  collapsed: boolean;
  description?: string;
}

function SidebarItem({ icon, label, focused, onPress, showDot, collapsed, description }: SidebarItemProps) {
  return (
    <TouchableOpacity
      style={[sidebarStyles.item, focused && sidebarStyles.itemActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {focused && <View style={sidebarStyles.activeIndicator} />}
      <View style={sidebarStyles.iconWrap}>
        {icon}
        {showDot && <View style={sidebarStyles.notifDot} />}
      </View>
      {!collapsed && (
        <View style={sidebarStyles.itemTextWrap}>
          <Text style={[sidebarStyles.label, { color: focused ? Colors.primaryDark : Colors.textSecondary }]}>
            {label}
          </Text>
          {description && (
            <Text style={sidebarStyles.itemDesc} numberOfLines={1}>{description}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function DesktopSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { hasIncomingRequests } = useUnread();
  const pathname = usePathname();

  const getRoute = () => {
    if (pathname === '/' || pathname === '/index' || pathname === '/(tabs)' || pathname === '/(tabs)/index') return 'index';
    if (pathname.includes('reservations')) return 'reservations';
    if (pathname.includes('profil')) return 'profil';
    if (pathname.includes('mes-annonces') || pathname.includes('create-listing')) return 'create-listing';
    return 'index';
  };

  const currentRoute = getRoute();

  const navItems = [
    {
      route: 'index',
      label: 'Explorer',
      description: 'Parcourir les annonces',
      icon: (focused: boolean) => <Ionicons name="home-outline" size={20} color={focused ? Colors.primaryDark : Colors.textSecondary} />,
      onPress: () => router.push('/(tabs)'),
    },
    {
      route: 'create-listing',
      label: 'Louer un objet',
      description: 'Publier une annonce',
      icon: (focused: boolean) => <Ionicons name="add-circle-outline" size={20} color={focused ? Colors.primaryDark : Colors.textSecondary} />,
      onPress: () => router.push('/create-listing'),
    },
    {
      route: 'reservations',
      label: 'Messages',
      description: 'Vos échanges',
      icon: (focused: boolean) => <Ionicons name="chatbubble-outline" size={20} color={focused ? Colors.primaryDark : Colors.textSecondary} />,
      onPress: () => router.push('/(tabs)/reservations'),
      showDot: hasIncomingRequests,
    },
    {
      route: 'profil',
      label: 'Mon Compte',
      description: 'Profil & paramètres',
      icon: (focused: boolean) => <Ionicons name="person-outline" size={20} color={focused ? Colors.primaryDark : Colors.textSecondary} />,
      onPress: () => router.push('/(tabs)/profil'),
    },
  ];

  return (
    <View style={[sidebarStyles.sidebar, collapsed && sidebarStyles.sidebarCollapsed]}>
      <View style={[sidebarStyles.logoArea, collapsed && sidebarStyles.logoAreaCollapsed]}>
        {collapsed ? (
          <Image
            source={require('@/assets/images/logoLTBwhitoutbaground.png')}
            style={sidebarStyles.logoIconOnly}
            resizeMode="contain"
          />
        ) : (
          <Image
            source={require('@/assets/images/logoLTBwhitoutbaground.png')}
            style={sidebarStyles.logoFull}
            resizeMode="contain"
          />
        )}
      </View>

      <View style={[sidebarStyles.nav, collapsed && sidebarStyles.navCollapsed]}>
        {navItems.map((item) => {
          const focused = currentRoute === item.route;
          return (
            <SidebarItem
              key={item.route}
              icon={item.icon(focused)}
              label={item.label}
              description={item.description}
              focused={focused}
              onPress={item.onPress}
              showDot={item.showDot}
              collapsed={collapsed}
            />
          );
        })}
      </View>

      <View style={sidebarStyles.bottomArea}>
        <TouchableOpacity
          style={[sidebarStyles.collapseBtn, collapsed && sidebarStyles.collapseBtnCollapsed]}
          onPress={onToggle}
          activeOpacity={0.75}
        >
          {collapsed
            ? <Ionicons name="chevron-forward-outline" size={16} color={Colors.textSecondary} />
            : <Ionicons name="chevron-back-outline" size={16} color={Colors.textSecondary} />
          }
          {!collapsed && <Text style={sidebarStyles.collapseBtnText}>Réduire</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeTabButton(
  onPressNav: () => void,
  icon: (color: string) => React.ReactNode,
  label: string,
  segments: string[],
  showDot?: boolean,
) {
  return function TabButton(_props: any) {
    const pathname = usePathname();
    const normalized = pathname.replace(/^\/(tabs)\//, '/').replace(/^\/(tabs)$/, '/');
    const focused = segments.some((seg) => {
      if (seg === '/') return normalized === '/';
      return normalized === seg || normalized.startsWith(seg + '/');
    });
    const color = focused ? Colors.primary : '#9CA3AF';
    return (
      <TouchableOpacity
        onPress={onPressNav}
        style={styles.tabItemTouchable}
        activeOpacity={0.7}
      >
        <TabItem icon={icon(color)} label={label} focused={focused} showDot={showDot} />
      </TouchableOpacity>
    );
  };
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web'
    ? WEB_BOTTOM_PAD
    : Math.max(insets.bottom, 8);
  const { hasIncomingRequests } = useUnread();
  const { isDesktop } = useResponsive();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (isDesktop && Platform.OS === 'web') {
    return (
      <View style={sidebarStyles.root}>
        <DesktopSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />
        <View style={sidebarStyles.content}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: 'none' },
            }}
          >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="mes-annonces" />
            <Tabs.Screen name="reservations" />
            <Tabs.Screen name="profil" />
          </Tabs>
        </View>
      </View>
    );
  }

  const tabBarStyle = {
    backgroundColor: Colors.white,
    borderTopColor: '#F0EDE4',
    borderTopWidth: 1,
    height: TAB_BAR_HEIGHT + bottomPad,
    paddingBottom: bottomPad,
    paddingTop: 0,
    paddingHorizontal: 0,
  };

  const tabBarItemStyle = {
    height: TAB_BAR_HEIGHT,
    paddingTop: 0,
    paddingBottom: 0,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarItemStyle,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarButton: makeTabButton(
            () => router.push('/(tabs)'),
            (c) => <Ionicons name="search-outline" size={22} color={c} />,
            'Rechercher',
            ['/', '/search', '/category', '/listing', '/popular', '/deals', '/favorites'],
          ),
        }}
      />
      <Tabs.Screen
        name="mes-annonces"
        options={{
          tabBarButton: makeTabButton(
            () => router.push('/create-listing'),
            (c) => <Ionicons name="add-circle-outline" size={22} color={c} />,
            'Louer',
            ['/create-listing', '/mes-annonces'],
          ),
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          tabBarButton: makeTabButton(
            () => router.push('/(tabs)/reservations'),
            (c) => <Ionicons name="chatbubble-outline" size={22} color={c} />,
            'Messages',
            ['/reservations', '/chat'],
            hasIncomingRequests,
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          tabBarButton: makeTabButton(
            () => router.push('/(tabs)/profil'),
            (c) => <Ionicons name="person-outline" size={22} color={c} />,
            'Mon Compte',
            ['/profil', '/account-settings', '/edit-address', '/wallet', '/onboarding'],
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItemTouchable: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
    paddingBottom: 0,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 6,
    paddingBottom: 4,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E05252',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  tabLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
  },
});

const sidebarStyles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },
  sidebar: {
    width: SIDEBAR_WIDTH_OPEN,
    backgroundColor: Colors.white,
    borderRightWidth: 1,
    borderRightColor: '#F0EDE4',
    flexDirection: 'column',
    ...Platform.select({
      web: { boxShadow: '2px 0 12px rgba(0,0,0,0.04)' },
    }),
  },
  sidebarCollapsed: {
    width: SIDEBAR_WIDTH_CLOSED,
  },
  logoArea: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE4',
  },
  logoAreaCollapsed: {
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIconOnly: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  logoFull: {
    height: 44,
    width: '100%',
  },
  nav: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 12,
    gap: 2,
  },
  navCollapsed: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  itemActive: {
    backgroundColor: Colors.primaryLight + '30',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: Colors.primaryDark,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  notifDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E05252',
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  itemTextWrap: {
    flex: 1,
    gap: 1,
  },
  label: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    letterSpacing: -0.1,
  },
  itemDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0,
  },
  bottomArea: {
    paddingHorizontal: 12,
    paddingBottom: 24,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0EDE4',
  },
  collapseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  collapseBtnCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  collapseBtnText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
});
