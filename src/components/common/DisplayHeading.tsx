import React from 'react';
import {StyleProp, StyleSheet, Text, View, ViewStyle} from 'react-native';
import {Colors} from '@theme/colors';
import {Typography} from '@theme/typography';

export interface DisplayHeadingProps {
  lightText: string;
  boldText: string;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * ExamIQ signature two-line Display Heading (Light 300 over Bold 700).
 */
export const DisplayHeading: React.FC<DisplayHeadingProps> = ({
  lightText,
  boldText,
  dark = false,
  style,
}) => {
  const color = dark ? Colors.inkOnDark : Colors.inkPrimary;
  return (
    <View style={style}>
      <Text style={[Typography.displayLight, styles.line, {color}]}>
        {lightText}
      </Text>
      <Text style={[Typography.displayBold, styles.line, {color}]}>
        {boldText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  line: {
    includeFontPadding: false,
  },
});
