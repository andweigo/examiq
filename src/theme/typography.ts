import {TextStyle} from 'react-native';

export const FontFamilies = {
  light: 'Inter-Light',
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semiBold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
} as const;

export const Typography: Record<string, TextStyle> = {
  // Signature Light-over-Bold display header from ExamIQ screens
  displayLight: {
    fontSize: 27,
    lineHeight: 30,
    letterSpacing: -0.68,
    fontWeight: '300',
  },
  displayBold: {
    fontSize: 27,
    lineHeight: 30,
    letterSpacing: -0.68,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    fontWeight: '700',
  },
  kpiValue: {
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  micro: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  button: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
};
