import {SubjectAccentKey} from '@core/types/common';

export const Colors = {
  // Light surfaces (Dashboard, Exams, Review, Results, Profile)
  canvasLight: '#F5F5F2',
  surfaceWhite: '#FFFFFF',
  surfaceMuted: '#EAEAE5',
  hairlineLight: '#E4E4DE',

  // Dark surfaces (QR Scanner, Paper Scanner, Alignment, Auto Check, Scan History, Floating Tab Bar)
  canvasDark: '#111111',
  surfaceDark: '#16161A',
  surfaceDarkElevated: '#1C1C1C',
  surfaceDarkCard: '#242424',
  surfaceDarkBorder: '#2A2A2A',
  hairlineDark: '#232323',

  // Typography inks
  inkPrimary: '#111111',
  inkSecondary: '#4A4A45',
  inkMuted: '#6E6E68',
  inkSubtle: '#8E8E88',
  inkPlaceholder: '#A1A19A',
  inkOnDark: '#F5F5F2',
  inkOnDarkMuted: '#94948E',

  // Brand & Semantic accents (from ExamIQ 21-screen prototype)
  lime: '#C6F453',
  limeDeep: '#8BC419',
  purple: '#958BFF',
  purpleDeep: '#5E52D6',
  purpleSoft: '#EBEAF8',
  coral: '#F67D56',
  coralDeep: '#D94E28',
  cyan: '#6BD4E6',

  // 4-State OMR Answer Review palette (Screen 11)
  reviewCorrectBg: '#C6F453',
  reviewCorrectInk: '#111111',
  reviewWrongBg: '#F67D56',
  reviewWrongInk: '#111111',
  reviewBlankBg: '#1C1C1C',
  reviewBlankInk: '#F5F5F2',
  reviewConflictBg: '#958BFF',
  reviewConflictInk: '#111111',
} as const;

export const SubjectAccentPalette: Readonly<
  Record<SubjectAccentKey, {bg: string; ink: string; subtle: string}>
> = {
  purple: {bg: Colors.purple, ink: Colors.inkPrimary, subtle: Colors.purpleSoft},
  lime: {bg: Colors.lime, ink: Colors.inkPrimary, subtle: '#F2FCCF'},
  coral: {bg: Colors.coral, ink: Colors.inkPrimary, subtle: '#FDE8E0'},
  cyan: {bg: Colors.cyan, ink: Colors.inkPrimary, subtle: '#E1F6FA'},
};
