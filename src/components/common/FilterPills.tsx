import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

export interface FilterPillOption<T extends string = string> {
  readonly label: string;
  readonly value: T;
  readonly badge?: string | number;
}

export interface FilterPillsProps<T extends string = string> {
  options: ReadonlyArray<FilterPillOption<T>>;
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

/**
 * Horizontal scrollable pill bar with locked height (flexGrow: 0)
 * so pills never stretch vertically inside parent ScrollViews.
 */
export function FilterPills<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  style,
}: FilterPillsProps<T>) {
  const isSmall = size === 'sm';

  return (
    <View style={[styles.wrapper, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.content}>
        {options.map(option => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{selected: active}}
              onPress={() => onChange(option.value)}
              style={({pressed}) => [
                styles.pill,
                isSmall ? styles.pillSm : styles.pillMd,
                active ? styles.pillActive : styles.pillInactive,
                pressed && styles.pressed,
              ]}>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  isSmall ? styles.labelSm : styles.labelMd,
                  active ? styles.labelActive : styles.labelInactive,
                ]}>
                {option.label}
              </Text>
              {option.badge !== undefined ? (
                <View
                  style={[
                    styles.badge,
                    active ? styles.badgeActive : styles.badgeInactive,
                  ]}>
                  <Text
                    style={[
                      styles.badgeText,
                      active
                        ? styles.badgeTextActive
                        : styles.badgeTextInactive,
                    ]}>
                    {option.badge}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexGrow: 0,
    flexShrink: 0,
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingRight: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.pill,
    gap: 6,
  },
  pillMd: {
    height: 34,
    paddingHorizontal: 14,
  },
  pillSm: {
    height: 30,
    paddingHorizontal: 12,
  },
  pillActive: {
    backgroundColor: Colors.inkPrimary,
    borderWidth: 1,
    borderColor: Colors.inkPrimary,
  },
  pillInactive: {
    backgroundColor: Colors.surfaceWhite,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
  },
  label: {
    includeFontPadding: false,
  },
  labelMd: {
    fontSize: 12,
    fontWeight: '600',
  },
  labelSm: {
    fontSize: 11,
    fontWeight: '600',
  },
  labelActive: {
    color: Colors.surfaceWhite,
  },
  labelInactive: {
    color: Colors.inkSecondary,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  badgeInactive: {
    backgroundColor: Colors.surfaceMuted,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextActive: {
    color: Colors.lime,
  },
  badgeTextInactive: {
    color: Colors.inkMuted,
  },
  pressed: {
    opacity: 0.82,
  },
});
