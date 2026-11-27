import React from 'react';
import {Pressable, StyleProp, StyleSheet, Text, View, ViewStyle} from 'react-native';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

export interface SegmentOption<T extends string> {
  label: string;
  value: T;
}

export interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  dark?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  dark = false,
  compact = false,
  style,
}: SegmentedControlProps<T>) {
  return (
    <View
      style={[
        styles.container,
        {backgroundColor: dark ? Colors.surfaceDarkElevated : Colors.surfaceMuted},
        style,
      ]}>
      {options.map(option => {
        const active = option.value === value;
        const activeBg = dark ? Colors.lime : Colors.inkPrimary;
        const activeText = dark ? Colors.inkPrimary : Colors.surfaceWhite;
        const inactiveText = dark ? Colors.inkOnDarkMuted : Colors.inkSecondary;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.item,
              compact && styles.itemCompact,
              active && {backgroundColor: activeBg},
            ]}>
            <Text
              style={[
                styles.label,
                compact && styles.labelCompact,
                {color: active ? activeText : inactiveText},
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radii.pill,
  },
  item: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCompact: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  labelCompact: {
    fontSize: 11,
  },
});
