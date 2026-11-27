import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useToast} from '@hooks/useToast';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

export const ToastBanner: React.FC = () => {
  const {message, dismissToast} = useToast();
  const insets = useSafeAreaInsets();

  if (!message) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, {top: Math.max(insets.top + 10, 18)}]}>
      <Pressable onPress={dismissToast} style={styles.pill}>
        <View style={styles.dot} />
        <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">
          {message}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.inkPrimary,
    borderWidth: 1,
    borderColor: Colors.surfaceDarkBorder,
    borderRadius: Radii.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    maxWidth: '100%',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.lime,
  },
  text: {
    color: Colors.surfaceWhite,
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
});
