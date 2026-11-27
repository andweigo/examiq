import {BubbleChoice, OmrSensitivity, PaperSize} from '@core/types/common';

export const BUBBLE_CHOICES: readonly BubbleChoice[] = ['A', 'B', 'C', 'D'];

export const OMR_TEMPLATE_VERSION = 'OMR_REGISTRATION_TEMPLATE_V2';

export const OMR_CORNER_MARKER_COUNT = 4;

export interface PaperSizeSpec {
  readonly code: PaperSize;
  readonly label: string;
  readonly shortLabel: string;
  readonly dimensionsLabel: string;
  readonly widthPt: number;
  readonly heightPt: number;
}

export const PAPER_SIZE_LIST: readonly PaperSizeSpec[] = [
  {
    code: 'A4',
    label: 'A4 Standardized',
    shortLabel: 'A4',
    dimensionsLabel: '210 × 297 mm',
    widthPt: 595,
    heightPt: 842,
  },
  {
    code: 'SHORT',
    label: 'Short / Letter',
    shortLabel: 'Short (8.5×11")',
    dimensionsLabel: '8.5 × 11 in',
    widthPt: 612,
    heightPt: 792,
  },
  {
    code: 'LONG',
    label: 'Long / Folio',
    shortLabel: 'Long (8.5×13")',
    dimensionsLabel: '8.5 × 13 in',
    widthPt: 612,
    heightPt: 936,
  },
] as const;

export const PAPER_SIZE_MAP: Readonly<Record<PaperSize, PaperSizeSpec>> = {
  A4: PAPER_SIZE_LIST[0],
  SHORT: PAPER_SIZE_LIST[1],
  LONG: PAPER_SIZE_LIST[2],
};

export interface OmrThresholdProfile {
  readonly label: string;
  readonly description: string;
  readonly minShadedRatio: number;
  readonly rowDeltaRatio: number;
  readonly maxBleedRatio: number;
  readonly partialMinRatio: number;
  readonly conflictSecondBubbleRatio: number;
  readonly minSharpnessScore: number;
  /** Max share of flagged items before a capture is rejected as unreadable. */
  readonly maxFlaggedShare: number;
}

/**
 * Single source of truth mirrored identically in Android native ExamIQOmrModule.kt.
 */
export const OMR_SENSITIVITY_PROFILES: Readonly<
  Record<OmrSensitivity, OmrThresholdProfile>
> = {
  strict: {
    label: 'Strict',
    description:
      'Requires dark, full shading with tight border discipline. Best for official pen or dark #2 pencil exams.',
    minShadedRatio: 0.46,
    rowDeltaRatio: 0.24,
    maxBleedRatio: 0.2,
    partialMinRatio: 0.16,
    conflictSecondBubbleRatio: 0.46,
    minSharpnessScore: 0.28,
    maxFlaggedShare: 0.35,
  },
  balanced: {
    label: 'Balanced',
    description:
      'Recommended classroom default balancing typical pencil shading against smudges and erasures.',
    minShadedRatio: 0.36,
    rowDeltaRatio: 0.18,
    maxBleedRatio: 0.26,
    partialMinRatio: 0.18,
    conflictSecondBubbleRatio: 0.36,
    minSharpnessScore: 0.2,
    maxFlaggedShare: 0.5,
  },
  lenient: {
    label: 'Lenient',
    description:
      'Forgiving threshold for light pencil marks, faint photocopies, or dim classroom lighting.',
    minShadedRatio: 0.28,
    rowDeltaRatio: 0.14,
    maxBleedRatio: 0.34,
    partialMinRatio: 0.15,
    conflictSecondBubbleRatio: 0.28,
    minSharpnessScore: 0.14,
    maxFlaggedShare: 0.65,
  },
};
