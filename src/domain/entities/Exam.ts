import {BaseEntity, BaseEntityProps} from '@core/base/BaseEntity';
import {ValidationError} from '@core/errors/AppError';
import {
  BubbleChoice,
  EntityId,
  ExamStatus,
  ISODateString,
  PointWeight,
} from '@core/types/common';

export interface ExamQuestion {
  readonly id: EntityId;
  readonly itemNumber: number;
  readonly prompt: string;
  readonly choices: Readonly<Record<BubbleChoice, string>>;
  readonly correctChoice: BubbleChoice;
  readonly points: PointWeight;
}

export interface ExamProps extends BaseEntityProps {
  title: string;
  termLabel: string;
  subjectId: EntityId;
  classId: EntityId;
  scheduledDate: ISODateString;
  itemCount: number;
  status?: ExamStatus;
  questions?: ExamQuestion[];
}

export class Exam extends BaseEntity<ExamProps> {
  private _title: string;
  private _termLabel: string;
  public readonly subjectId: EntityId;
  public readonly classId: EntityId;
  private _scheduledDate: ISODateString;
  private _itemCount: number;
  private _status: ExamStatus;
  private _questions: ExamQuestion[];

  constructor(props: ExamProps) {
    super(props);
    this._title = props.title.trim();
    this._termLabel = props.termLabel.trim();
    this.subjectId = props.subjectId;
    this.classId = props.classId;
    this._scheduledDate = props.scheduledDate;
    this._itemCount = props.itemCount;
    this._status = props.status ?? 'draft';
    this._questions = props.questions ? [...props.questions] : [];
  }

  public get title(): string {
    return this._title;
  }

  public get termLabel(): string {
    return this._termLabel;
  }

  public get scheduledDate(): ISODateString {
    return this._scheduledDate;
  }

  public get itemCount(): number {
    return this._itemCount;
  }

  public get status(): ExamStatus {
    return this._status;
  }

  public get questions(): readonly ExamQuestion[] {
    return this._questions;
  }

  public addQuestion(question: ExamQuestion): void {
    this._questions.push(question);
    this._itemCount = Math.max(this._itemCount, this._questions.length);
    this.touch();
  }

  public markReady(): void {
    this._status = 'ready';
    this.touch();
  }

  public archive(): void {
    this._status = 'archived';
    this.touch();
  }

  public validate(): void {
    if (!this._title) {
      throw new ValidationError('Exam title is required.');
    }
    if (!this.subjectId || !this.classId) {
      throw new ValidationError('Exam must specify both subjectId and classId.');
    }
    if (this._itemCount < 1) {
      throw new ValidationError('Exam must have at least 1 item.');
    }
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      title: this._title,
      termLabel: this._termLabel,
      subjectId: this.subjectId,
      classId: this.classId,
      scheduledDate: this._scheduledDate,
      itemCount: this._itemCount,
      status: this._status,
      questions: this._questions,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
