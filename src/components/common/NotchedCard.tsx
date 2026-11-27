import React, {PropsWithChildren} from 'react';
import {Pressable, StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {Colors} from '@theme/colors';
import {NotchedCardMetrics} from '@theme/spacing';

export interface NotchedCardProps extends PropsWithChildren {
  backgroundColor: string;
  notchColor?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * ExamIQ signature folder-notched card component (radius 26, top cutout 64x11).
 */
export const NotchedCard: React.FC<NotchedCardProps> = ({
  backgroundColor,
  notchColor = Colors.canvasLight,
  onPress,
  style,
  children,
}) => {
  const content = (
    <View style={[styles.card, {backgroundColor}, style]}>
      <View
        pointerEvents="none"
        style={[styles.notch, {backgroundColor: notchColor}]}
      />
      {children}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: NotchedCardMetrics.borderRadius,
    paddingTop: NotchedCardMetrics.paddingTop,
    paddingHorizontal: NotchedCardMetrics.paddingHorizontal,
    paddingBottom: NotchedCardMetrics.paddingBottom,
    overflow: 'hidden',
  },
  notch: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: NotchedCardMetrics.notchWidth,
    height: NotchedCardMetrics.notchHeight,
    borderBottomLeftRadius: NotchedCardMetrics.notchBottomRadius,
    borderBottomRightRadius: NotchedCardMetrics.notchBottomRadius,
  },
  pressed: {
    opacity: 0.92,
    transform: [{scale: 0.99}],
  },
});
