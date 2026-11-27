export type EntityId = string;
export type ISODateString = string;

export type BubbleChoice = 'A' | 'B' | 'C' | 'D';

export type PaperSize = 'A4' | 'SHORT' | 'LONG';

export type OmrSensitivity = 'strict' | 'balanced' | 'lenient';

export type AnswerReviewState = 'correct' | 'wrong' | 'blank' | 'conflict';

export type ScanStatus = 'review' | 'checked' | 'failed' | 'saved_locally';

export type ExamStatus = 'draft' | 'ready' | 'archived';

export type SubjectAccentKey = 'purple' | 'lime' | 'coral' | 'cyan';

export type PointWeight = 1 | 2 | 5;

export interface OperationResult<T, E = Error> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: E;
}
