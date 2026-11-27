import React, {useState} from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import {EyeIcon, EyeOffIcon} from '@components/common/Icons';
import {Colors} from '@theme/colors';

export type MinimalFieldVariant = 'underline' | 'soft' | 'pin';

export interface MinimalFieldProps extends TextInputProps {
  label?: string;
  prefix?: string;
  variant?: MinimalFieldVariant;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Minimalist, borderless-first text field crafted for ExamIQ forms & modals:
 * - 'underline': quiet hairline bottom rule (no surrounding rectangle border)
 * - 'soft': flat warm tonal fill with subtle focus lift (ideal for multiline & choices)
 * - 'pin': centered spacious PIN underline with built-in show/hide eye toggle
 */
export const MinimalField: React.FC<MinimalFieldProps> = ({
  label,
  prefix,
  variant = 'underline',
  containerStyle,
  style,
  onFocus,
  onBlur,
  secureTextEntry,
  ...inputProps
}) => {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const isSecret = Boolean(secureTextEntry);
  const effectiveSecure = isSecret && !revealed;

  const handleFocus: TextInputProps['onFocus'] = e => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur: TextInputProps['onBlur'] = e => {
    setFocused(false);
    onBlur?.(e);
  };

  const renderEyeToggle = () =>
    isSecret ? (
      <Pressable
        onPress={() => setRevealed(prev => !prev)}
        accessibilityRole="button"
        accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
        hitSlop={10}
        style={styles.eyeBtn}>
        {revealed ? (
          <EyeOffIcon size={18} color={Colors.inkMuted} />
        ) : (
          <EyeIcon size={18} color={Colors.inkMuted} />
        )}
      </Pressable>
    ) : null;

  if (variant === 'soft') {
    return (
      <View style={[styles.container, containerStyle]}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View
          style={[
            styles.softRow,
            focused ? styles.softRowFocused : styles.softRowIdle,
          ]}>
          {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
          <TextInput
            {...inputProps}
            secureTextEntry={effectiveSecure}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholderTextColor={Colors.inkPlaceholder}
            selectionColor={Colors.inkPrimary}
            style={[
              styles.softInput,
              inputProps.multiline && styles.multiline,
              style,
            ]}
          />
          {renderEyeToggle()}
        </View>
      </View>
    );
  }

  if (variant === 'pin') {
    return (
      <View style={[styles.container, containerStyle]}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View
          style={[
            styles.underlineWrap,
            focused ? styles.underlineFocused : styles.underlineIdle,
          ]}>
          {isSecret ? <View style={styles.eyeSpacer} /> : null}
          <TextInput
            {...inputProps}
            secureTextEntry={effectiveSecure}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholderTextColor={Colors.inkPlaceholder}
            selectionColor={Colors.inkPrimary}
            style={[styles.pinInput, style]}
          />
          {renderEyeToggle()}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.underlineWrap,
          focused ? styles.underlineFocused : styles.underlineIdle,
        ]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          {...inputProps}
          secureTextEntry={effectiveSecure}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={Colors.inkPlaceholder}
          selectionColor={Colors.inkPrimary}
          style={[styles.underlineInput, style]}
        />
        {renderEyeToggle()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: Colors.inkSubtle,
  },
  underlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 2,
  },
  underlineIdle: {
    borderBottomColor: Colors.hairlineLight,
  },
  underlineFocused: {
    borderBottomColor: Colors.inkPrimary,
    borderBottomWidth: 1.5,
  },
  underlineInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.inkPrimary,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  pinInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    color: Colors.inkPrimary,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  softRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  softRowIdle: {
    backgroundColor: Colors.surfaceMuted,
  },
  softRowFocused: {
    backgroundColor: Colors.surfaceWhite,
  },
  prefix: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.inkMuted,
    marginRight: 8,
  },
  softInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.inkPrimary,
    paddingVertical: 11,
    paddingHorizontal: 0,
  },
  multiline: {
    minHeight: 84,
    textAlignVertical: 'top',
    paddingTop: 12,
    paddingBottom: 12,
  },
  eyeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  eyeSpacer: {
    width: 34,
  },
});
