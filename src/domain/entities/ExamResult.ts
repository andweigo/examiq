import {DEFAULT_PASSING_PERCENTAGE} from '@constants/grading';
import {BaseEntity, BaseEntityProps} from '@core/base/BaseEntity';
import {ValidationError} from '@core/errors/AppError';
import {EntityId, ScanStatus} from '@core/types/common';
import {BubbleResponse} from '@domain/value-objects/BubbleResponse';
import {ScoreCalculator} from '@utils/ScoreCalculator';

export interface ExamResultProps extends BaseEntityProps {
  examId: EntityId;
  studentId: EntityId;
  assignmentId: EntityId;
  scanImageUri?: string;
  responses: BubbleResponse[];
  passingThreshold?: number;
  verifiedByTeacher?: boolean;
}

/**
 * Rich domain entity computing scores, flagged items, and pass/fail status
 * directly from encapsulated BubbleResponse value objects.
 */
export class ExamResult extends BaseEntity<ExamResultProps> {
  public readonly examId: EntityId;
  public readonly studentId: EntityId;
  public readonly assignmentId: EntityId;
  public readonly scanImageUri?: string;
  private _responses: BubbleResponse[];
  private readonly _passingThreshold: number;
  private _verifiedByTeacher: boolean;

  constructor(props: ExamResultProps) {
    super(props);
    this.examId = props.examId;
    this.studentId = props.studentId;
    this.assignmentId = props.assignmentId;
    this.scanImageUri = props.scanImageUri;
    this._responses = [...props.responses];
    this._passingThreshold = props.passingThreshold ?? DEFAULT_PASSING_PERCENTAGE;
    this._verifiedByTeacher = props.verifiedByTeacher ?? false;
  }

  public get responses(): readonly BubbleResponse[] {
    return this._responses;
  }

  public get earnedPoints(): number {
    return this._responses.reduce((sum, item) => sum + item.earnedPoints, 0);
  }

  public get maxPoints(): number {
    return this._responses.reduce((sum, item) => sum + item.points, 0);
  }

  public get percentage(): number {
    return ScoreCalculator.percentage(this.earnedPoints, this.maxPoints);
  }

  public get isPassing(): boolean {
    return ScoreCalculator.isPassing(
      this.earnedPoints,
      this.maxPoints,
      this._passingThreshold,
    );
  }

  public get flaggedItems(): BubbleResponse[] {
    return this._responses.filter(item => item.requiresManualReview);
  }

  public get scanStatus(): ScanStatus {
    if (this.flaggedItems.length > 0 && !this._verifiedByTeacher) {
      return 'review';
    }
    return this._verifiedByTeacher ? 'checked' : 'saved_locally';
  }

  public confirmVerification(): void {
    this._verifiedByTeacher = true;
    this.touch();
  }

  public validate(): void {
    if (!this.examId || !this.studentId || !this.assignmentId) {
      throw new ValidationError(
        'ExamResult requires examId, studentId, and assignmentId.',
      );
    }
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      examId: this.examId,
      studentId: this.studentId,
      assignmentId: this.assignmentId,
      scanImageUri: this.scanImageUri,
      earnedPoints: this.earnedPoints,
      maxPoints: this.maxPoints,
      percentage: this.percentage,
      isPassing: this.isPassing,
      flaggedCount: this.flaggedItems.length,
      scanStatus: this.scanStatus,
      verifiedByTeacher: this._verifiedByTeacher,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
