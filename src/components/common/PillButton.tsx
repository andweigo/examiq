import React from 'react';
import {Pressable, StyleProp, StyleSheet, Text, ViewStyle} from 'react-native';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

export type PillButtonVariant =
  | 'dark'
  | 'lime'
  | 'muted'
  | 'darkSurface'
  | 'outline';

export interface PillButtonProps {
  label: string;
  onPress: () => void;
  variant?: PillButtonVariant;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_STYLES: Record<
  PillButtonVariant,
  {bg: string; text: string; border?: string}
> = {
  dark: {bg: Colors.inkPrimary, text: Colors.surfaceWhite},
  lime: {bg: Colors.lime, text: Colors.inkPrimary},
  muted: {bg: Colors.surfaceMuted, text: Colors.inkPrimary},
  darkSurface: {bg: Colors.surfaceDarkElevated, text: Colors.surfaceWhite},
  outline: {
    bg: Colors.surfaceWhite,
    text: Colors.inkPrimary,
    border: Colors.hairlineLight,
  },
};

export const PillButton: React.FC<PillButtonProps> = ({
  label,
  onPress,
  variant = 'dark',
  compact = false,
  style,
}) => {
  const palette = VARIANT_STYLES[variant];
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.base,
        compact && styles.compact,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border ?? 'transparent',
          borderWidth: palette.border ? 1 : 0,
        },
        pressed && styles.pressed,
        style,
      ]}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        style={[
          styles.label,
          variant === 'lime' && styles.boldLabel,
          {color: palette.text},
        ]}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: Radii.pill,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    minHeight: 38,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  boldLabel: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
