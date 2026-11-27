import {Colors, SubjectAccentPalette} from './colors';
import {NotchedCardMetrics, Radii, Spacing} from './spacing';
import {FontFamilies, Typography} from './typography';

export const Theme = {
  colors: Colors,
  subjectAccents: SubjectAccentPalette,
  fonts: FontFamilies,
  typography: Typography,
  spacing: Spacing,
  radii: Radii,
  notchedCard: NotchedCardMetrics,
} as const;

export * from './colors';
export * from './typography';
export * from './spacing';
