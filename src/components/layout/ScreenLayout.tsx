import React, {
  ComponentRef,
  PropsWithChildren,
  ReactNode,
  RefObject,
} from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {
  FloatingTabBar,
  FloatingTabKey,
} from '@components/layout/FloatingTabBar';
import {useKeyboardHeight} from '@hooks/useKeyboardHeight';
import {useResponsive} from '@hooks/useResponsive';
import {Colors} from '@theme/colors';

export interface ScreenLayoutProps extends PropsWithChildren {
  dark?: boolean;
  activeTab?: FloatingTabKey;
  scrollable?: boolean;
  contentPadding?: number;
  scrollViewRef?: RefObject<ComponentRef<typeof ScrollView> | null>;
}

export const ScreenLayout: React.FC<ScreenLayoutProps> = ({
  dark = false,
  activeTab,
  scrollable = true,
  contentPadding,
  scrollViewRef,
  children,
}) => {
  const backgroundColor = dark ? Colors.canvasDark : Colors.canvasLight;
  const keyboardHeight = useKeyboardHeight();
  const {horizontalPadding, maxContentWidth, isTablet} = useResponsive();
  const resolvedPadding = contentPadding ?? horizontalPadding;
  const keyboardOpen = keyboardHeight > 0;

  const tabletConstrainedStyle = isTablet
    ? {width: '100%' as const, maxWidth: maxContentWidth, alignSelf: 'center' as const}
    : undefined;

  return (
    <SafeAreaView
      style={[styles.root, {backgroundColor}]}
      edges={['top', 'bottom']}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {scrollable ? (
          <ScrollView
            ref={scrollViewRef}
            style={styles.flex}
            contentContainerStyle={[
              styles.scrollContent,
              tabletConstrainedStyle,
              {
                paddingHorizontal: resolvedPadding,
                paddingBottom: keyboardOpen
                  ? 24
                  : activeTab
                  ? 116
                  : 24,
              },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            {children}
          </ScrollView>
        ) : (
          <View
            style={[
              styles.flex,
              tabletConstrainedStyle,
              {
                paddingHorizontal: resolvedPadding,
                paddingBottom: activeTab && !keyboardOpen ? 92 : 0,
              },
            ]}>
            {children}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Truly floating transparent overlay above content */}
      {activeTab && !keyboardOpen ? (
        <FloatingTabBar activeTab={activeTab} dark={dark} />
      ) : null}
    </SafeAreaView>
  );
};

export interface BackHeaderProps {
  onBack: () => void;
  right?: ReactNode;
  dark?: boolean;
  center?: ReactNode;
}

export const BackHeader: React.FC<BackHeaderProps> = ({
  onBack,
  right,
  dark = false,
  center,
}) => {
  const navigation = useNavigation();

  // Same behaviour as the system back gesture: return to the previous screen in history.
  // `onBack` is only a fallback when there is nothing to go back to.
  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      onBack();
    }
  };

  return (
    <View style={styles.headerRow}>
      <Pressable
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={({pressed}) => [
          styles.circleBtn,
          {
            backgroundColor: dark
              ? Colors.surfaceDarkElevated
              : Colors.surfaceWhite,
          },
          pressed && styles.pressed,
        ]}>
        <Text
          style={[
            styles.backChevron,
            {color: dark ? Colors.surfaceWhite : Colors.inkPrimary},
          ]}>
          ‹
        </Text>
      </Pressable>
      {center ? (
        <View style={styles.centerSlot}>{center}</View>
      ) : (
        <View style={styles.flex} />
      )}
      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: -2,
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
  },
  rightSlot: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  pressed: {
    opacity: 0.8,
  },
});
