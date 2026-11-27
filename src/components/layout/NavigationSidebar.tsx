import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {Circle, Line, Path, Rect} from 'react-native-svg';
import {AssetRegistry} from '@assets/index';
import {
  ExamsIcon,
  HomeIcon,
  LogoutIcon,
  ProfileIcon,
  ResultsIcon,
  ScanIcon,
} from '@components/common/Icons';
import {useSidebar} from '@context/SidebarContext';
import {useProfileSettings} from '@hooks/index';
import {RootRoute} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

const DRAWER_WIDTH = Math.min(
  286,
  Math.round(Dimensions.get('window').width * 0.78),
);

type NavIconKey =
  | 'home'
  | 'exams'
  | 'scan'
  | 'history'
  | 'results'
  | 'students'
  | 'classes'
  | 'subjects'
  | 'backup'
  | 'settings';

interface MajorScreenItem {
  readonly label: string;
  readonly route: RootRoute;
  readonly icon: NavIconKey;
  readonly matchRoutes?: ReadonlyArray<RootRoute>;
}

interface SidebarGroup {
  readonly title: string;
  readonly items: ReadonlyArray<MajorScreenItem>;
}

const SIDEBAR_GROUPS: ReadonlyArray<SidebarGroup> = [
  {
    title: 'WORKSPACE',
    items: [
      {
        label: 'Dashboard',
        route: RootRoute.Dashboard,
        icon: 'home',
        matchRoutes: [RootRoute.Dashboard, RootRoute.DeviceAlerts],
      },
      {
        label: 'Exams & Sheets',
        route: RootRoute.Exams,
        icon: 'exams',
        matchRoutes: [
          RootRoute.Exams,
          RootRoute.ExamBuilder,
          RootRoute.AnswerKey,
          RootRoute.GeneratingOverlay,
          RootRoute.ExamGenerator,
          RootRoute.ExamPaper,
        ],
      },
      {
        label: 'Scan Papers',
        route: RootRoute.QrScanner,
        icon: 'scan',
        matchRoutes: [
          RootRoute.QrScanner,
          RootRoute.PaperScanner,
          RootRoute.Alignment,
          RootRoute.AutoCheck,
          RootRoute.Review,
        ],
      },
      {
        label: 'Scan History',
        route: RootRoute.ScanHistory,
        icon: 'history',
      },
      {
        label: 'Results & Reports',
        route: RootRoute.Results,
        icon: 'results',
        matchRoutes: [RootRoute.Results, RootRoute.Reports],
      },
    ],
  },
  {
    title: 'RECORDS',
    items: [
      {label: 'Students', route: RootRoute.Students, icon: 'students'},
      {
        label: 'Classes & Sections',
        route: RootRoute.Classes,
        icon: 'classes',
      },
      {label: 'Subjects', route: RootRoute.Subjects, icon: 'subjects'},
    ],
  },
  {
    title: 'DEVICE',
    items: [
      {
        label: 'Backup & Restore',
        route: RootRoute.BackupRestore,
        icon: 'backup',
      },
      {label: 'Settings', route: RootRoute.Settings, icon: 'settings'},
    ],
  },
];

const SidebarIcon: React.FC<{name: NavIconKey; color: string}> = ({
  name,
  color,
}) => {
  switch (name) {
    case 'home':
      return <HomeIcon size={17} color={color} strokeWidth={1.8} />;
    case 'exams':
      return <ExamsIcon size={17} color={color} strokeWidth={1.8} />;
    case 'scan':
      return <ScanIcon size={17} color={color} strokeWidth={1.8} />;
    case 'results':
      return <ResultsIcon size={17} color={color} strokeWidth={1.8} />;
    case 'students':
      return <ProfileIcon size={17} color={color} strokeWidth={1.8} />;
    case 'history':
      return (
        <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.8} />
          <Path
            d="M12 7.5v4.5l3 2"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'classes':
      return (
        <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
          <Rect
            x={4}
            y={4}
            width={6.5}
            height={6.5}
            rx={1.5}
            stroke={color}
            strokeWidth={1.8}
          />
          <Rect
            x={13.5}
            y={4}
            width={6.5}
            height={6.5}
            rx={1.5}
            stroke={color}
            strokeWidth={1.8}
          />
          <Rect
            x={4}
            y={13.5}
            width={6.5}
            height={6.5}
            rx={1.5}
            stroke={color}
            strokeWidth={1.8}
          />
          <Rect
            x={13.5}
            y={13.5}
            width={6.5}
            height={6.5}
            rx={1.5}
            stroke={color}
            strokeWidth={1.8}
          />
        </Svg>
      );
    case 'subjects':
      return (
        <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 4.5h11a3 3 0 0 1 3 3V20H8a3 3 0 0 0-3 3V4.5z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <Line
            x1={9}
            y1={9}
            x2={15}
            y2={9}
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'backup':
      return (
        <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 4v10m0 0-3.5-3.5M12 14l3.5-3.5M5 18.5h14"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'settings':
      return (
        <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.8} />
          <Path
            d="M12 3.5v2M12 18.5v2M4.9 7.8l1.7 1M17.4 15.2l1.7 1M4.9 16.2l1.7-1M17.4 8.8l1.7-1"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
      );
  }
};

export interface NavigationSidebarProps {
  activeRouteName: string;
  onNavigate: (route: RootRoute) => void;
  onLogout: () => void;
}

/**
 * Minimalist slide-out ExamIQ Sidebar displaying major destination screens only.
 */
export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  activeRouteName,
  onNavigate,
  onLogout,
}) => {
  const {isOpen, closeSidebar} = useSidebar();
  const {teacher} = useProfileSettings();

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(-DRAWER_WIDTH);
      fadeAnim.setValue(0);
    }
  }, [isOpen, slideAnim, fadeAnim]);

  const handleSelect = (route: RootRoute) => {
    closeSidebar();
    onNavigate(route);
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={closeSidebar}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, {opacity: fadeAnim}]}>
          <Pressable style={styles.backdropPress} onPress={closeSidebar} />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawer,
            {width: DRAWER_WIDTH, transform: [{translateX: slideAnim}]},
          ]}>
          <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            {/* Minimal Brand Header */}
            <View style={styles.brandHeader}>
              <View style={styles.brandLeft}>
                <Image
                  source={AssetRegistry.branding.appLogo}
                  style={styles.logoImg}
                  resizeMode="cover"
                />
                <Text style={styles.brandName}>ExamIQ</Text>
              </View>
              <Pressable
                onPress={closeSidebar}
                accessibilityRole="button"
                accessibilityLabel="Close sidebar"
                style={styles.closeBtn}>
                <Text style={styles.closeGlyph}>×</Text>
              </Pressable>
            </View>

            {/* Major Screens Navigation */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}>
              {SIDEBAR_GROUPS.map(group => (
                <View key={group.title} style={styles.section}>
                  <Text style={styles.sectionTitle}>{group.title}</Text>
                  {group.items.map(item => {
                    const isActive = item.matchRoutes
                      ? item.matchRoutes.includes(activeRouteName as RootRoute)
                      : activeRouteName === item.route;

                    return (
                      <Pressable
                        key={item.route}
                        onPress={() => handleSelect(item.route)}
                        style={({pressed}) => [
                          styles.navRow,
                          isActive && styles.navRowActive,
                          pressed && styles.pressed,
                        ]}>
                        <SidebarIcon
                          name={item.icon}
                          color={isActive ? Colors.lime : Colors.inkMuted}
                        />
                        <Text
                          style={[
                            styles.navLabel,
                            isActive && styles.navLabelActive,
                          ]}
                          numberOfLines={1}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}

                  {group.title === 'DEVICE' ? (
                    <Pressable
                      onPress={() => {
                        closeSidebar();
                        onLogout();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Log out"
                      style={({pressed}) => [
                        styles.navRow,
                        pressed && styles.pressed,
                      ]}>
                      <LogoutIcon size={17} color={Colors.coralDeep} />
                      <Text style={styles.logoutNavLabel} numberOfLines={1}>
                        Log out
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </ScrollView>

            {/* Minimal Teacher Profile Footer */}
            <Pressable
              onPress={() => handleSelect(RootRoute.Profile)}
              style={({pressed}) => [
                styles.footerRow,
                pressed && styles.pressed,
              ]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{teacher.initials}</Text>
              </View>
              <View style={styles.teacherInfo}>
                <Text style={styles.teacherName} numberOfLines={1}>
                  {teacher.name}
                </Text>
                <Text style={styles.teacherSub} numberOfLines={1}>
                  {teacher.school}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(17,17,17,0.52)',
  },
  backdropPress: {
    flex: 1,
  },
  drawer: {
    height: '100%',
    backgroundColor: Colors.canvasLight,
    borderTopRightRadius: Radii.notchedCard,
    borderBottomRightRadius: Radii.notchedCard,
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoImg: {
    width: 32,
    height: 32,
    borderRadius: 9,
  },
  brandName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.inkPrimary,
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {
    fontSize: 22,
    fontWeight: '400',
    color: Colors.inkMuted,
    lineHeight: 24,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 20,
  },
  section: {
    gap: 2,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    color: Colors.inkSubtle,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: Radii.pill,
  },
  navRowActive: {
    backgroundColor: Colors.inkPrimary,
  },
  navLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.inkPrimary,
  },
  navLabelActive: {
    color: Colors.surfaceWhite,
    fontWeight: '600',
  },
  logoutNavLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.coralDeep,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.hairlineLight,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  teacherInfo: {
    flex: 1,
  },
  teacherName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.inkPrimary,
  },
  teacherSub: {
    fontSize: 11,
    color: Colors.inkMuted,
    marginTop: 1,
  },
  chevron: {
    fontSize: 16,
    color: Colors.inkMuted,
  },
  pressed: {
    opacity: 0.78,
  },
});
