import {BUBBLE_CHOICES} from '@constants/omr';
import {BaseEntity, BaseEntityProps} from '@core/base/BaseEntity';
import {ValidationError} from '@core/errors/AppError';
import {BubbleChoice, EntityId, PointWeight} from '@core/types/common';

export interface AnswerKeyEntry {
  readonly itemNumber: number;
  readonly correctChoice: BubbleChoice;
  readonly points: PointWeight;
}

export interface AnswerKeyProps extends BaseEntityProps {
  examId: EntityId;
  entries: AnswerKeyEntry[];
}

/**
 * Domain entity encapsulating an exam's answer key and tap-to-cycle mutations.
 */
export class AnswerKey extends BaseEntity<AnswerKeyProps> {
  public readonly examId: EntityId;
  private _entries: Map<number, AnswerKeyEntry>;

  constructor(props: AnswerKeyProps) {
    super(props);
    this.examId = props.examId;
    this._entries = new Map(props.entries.map(e => [e.itemNumber, e]));
  }

  public get itemCount(): number {
    return this._entries.size;
  }

  public get totalPoints(): number {
    let total = 0;
    for (const entry of this._entries.values()) {
      total += entry.points;
    }
    return total;
  }

  public getEntries(): AnswerKeyEntry[] {
    return Array.from(this._entries.values()).sort(
      (a, b) => a.itemNumber - b.itemNumber,
    );
  }

  public getEntry(itemNumber: number): AnswerKeyEntry | undefined {
    return this._entries.get(itemNumber);
  }

  public setItem(
    itemNumber: number,
    correctChoice: BubbleChoice,
    points: PointWeight = 1,
  ): void {
    this._entries.set(itemNumber, {itemNumber, correctChoice, points});
    this.touch();
  }

  public cycleChoice(itemNumber: number): BubbleChoice {
    const existing = this._entries.get(itemNumber);
    const currentIndex = existing
      ? BUBBLE_CHOICES.indexOf(existing.correctChoice)
      : -1;
    const nextChoice = BUBBLE_CHOICES[(currentIndex + 1) % BUBBLE_CHOICES.length];
    this.setItem(itemNumber, nextChoice, existing?.points ?? 1);
    return nextChoice;
  }

  public applyUniformPoints(points: PointWeight): void {
    for (const [itemNumber, entry] of this._entries.entries()) {
      this._entries.set(itemNumber, {...entry, points});
    }
    this.touch();
  }

  public validate(): void {
    if (!this.examId) {
      throw new ValidationError('AnswerKey must belong to an exam.');
    }
    if (this._entries.size === 0) {
      throw new ValidationError('AnswerKey must contain at least one item.');
    }
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      examId: this.examId,
      entries: this.getEntries(),
      totalPoints: this.totalPoints,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
