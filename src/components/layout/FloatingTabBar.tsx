import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  ExamsIcon,
  HomeIcon,
  ProfileIcon,
  ResultsIcon,
  ScanIcon,
} from '@components/common/Icons';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

export type FloatingTabKey = 'home' | 'exams' | 'scan' | 'results' | 'profile';

export interface FloatingTabBarProps {
  activeTab: FloatingTabKey;
  dark?: boolean;
}

const LEFT_TABS: ReadonlyArray<{
  key: FloatingTabKey;
  route: RootRoute;
  label: string;
}> = [
  {key: 'home', route: RootRoute.Dashboard, label: 'Dashboard'},
  {key: 'exams', route: RootRoute.Exams, label: 'Exams'},
];

const RIGHT_TABS: ReadonlyArray<{
  key: FloatingTabKey;
  route: RootRoute;
  label: string;
}> = [
  {key: 'results', route: RootRoute.Results, label: 'Results'},
  {key: 'profile', route: RootRoute.Profile, label: 'Profile'},
];

/**
 * Truly floating bottom pill dock positioned above screen content
 * with zero opaque wrapper background and an elevated center Scan hero button.
 */
export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  activeTab,
  dark = false,
}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const renderSideIcon = (key: FloatingTabKey, active: boolean) => {
    const color = active ? Colors.lime : 'rgba(255,255,255,0.78)';
    switch (key) {
      case 'home':
        return <HomeIcon size={19} color={color} strokeWidth={2} />;
      case 'exams':
        return <ExamsIcon size={19} color={color} strokeWidth={2} />;
      case 'results':
        return <ResultsIcon size={19} color={color} strokeWidth={2} />;
      case 'profile':
        return <ProfileIcon size={19} color={color} strokeWidth={2} />;
      default:
        return null;
    }
  };

  const renderSideTab = (tab: {
    key: FloatingTabKey;
    route: RootRoute;
    label: string;
  }) => {
    const active = tab.key === activeTab;
    return (
      <Pressable
        key={tab.key}
        accessibilityRole="tab"
        accessibilityLabel={tab.label}
        accessibilityState={{selected: active}}
        onPress={() => navigation.navigate(tab.route as never)}
        style={({pressed}) => [styles.sideTabBtn, pressed && styles.pressed]}>
        {renderSideIcon(tab.key, active)}
        <View style={[styles.activeDot, active && styles.activeDotVisible]} />
      </Pressable>
    );
  };

  const scanActive = activeTab === 'scan';

  return (
    <View
      pointerEvents="box-none"
      style={[styles.overlay, {bottom: Math.max(insets.bottom + 10, 16)}]}>
      <View
        style={[
          styles.dock,
          {
            backgroundColor: dark
              ? Colors.surfaceDarkElevated
              : Colors.inkPrimary,
          },
        ]}>
        <View style={styles.sideGroup}>{LEFT_TABS.map(renderSideTab)}</View>

        {/* Center Main Hero Scan Button */}
        <View style={styles.centerSlot}>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel="Scan Papers"
            accessibilityState={{selected: scanActive}}
            onPress={() => navigation.navigate(RootRoute.QrScanner)}
            style={({pressed}) => [
              styles.heroButton,
              scanActive && styles.heroButtonActive,
              pressed && styles.heroPressed,
            ]}>
            <ScanIcon size={24} color={Colors.inkPrimary} strokeWidth={2.3} />
          </Pressable>
        </View>

        <View style={styles.sideGroup}>{RIGHT_TABS.map(renderSideTab)}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 50,
  },
  dock: {
    width: '100%',
    height: 62,
    borderRadius: Radii.pill,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 12,
  },
  sideGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  sideTabBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  activeDotVisible: {
    backgroundColor: Colors.lime,
  },
  centerSlot: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.lime,
    borderWidth: 4,
    borderColor: Colors.inkPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 14,
  },
  heroButtonActive: {
    transform: [{scale: 1.04}],
  },
  heroPressed: {
    transform: [{scale: 0.94}],
  },
  pressed: {
    opacity: 0.78,
  },
});
