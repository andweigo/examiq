import {AnswerReviewState, BubbleChoice} from '@core/types/common';

export interface BubbleResponseProps {
  readonly itemNumber: number;
  readonly expectedChoice: BubbleChoice;
  readonly detectedChoices: readonly BubbleChoice[];
  readonly manualOverride?: BubbleChoice | null;
  readonly points: number;
  readonly confidence: number;
}

/**
 * Value Object encapsulating an individual OMR item's detection & verification state.
 * Enforces ExamIQ's core safety rule: ambiguous (conflict/blank) items remain flagged
 * until explicitly verified by the teacher.
 */
export class BubbleResponse {
  public readonly itemNumber: number;
  public readonly expectedChoice: BubbleChoice;
  public readonly detectedChoices: readonly BubbleChoice[];
  public readonly manualOverride: BubbleChoice | null;
  public readonly points: number;
  public readonly confidence: number;

  constructor(props: BubbleResponseProps) {
    this.itemNumber = props.itemNumber;
    this.expectedChoice = props.expectedChoice;
    this.detectedChoices = [...props.detectedChoices];
    this.manualOverride = props.manualOverride ?? null;
    this.points = props.points;
    this.confidence = props.confidence;
  }

  public get effectiveChoice(): BubbleChoice | null {
    if (this.manualOverride) {
      return this.manualOverride;
    }
    return this.detectedChoices.length === 1 ? this.detectedChoices[0] : null;
  }

  public get reviewState(): AnswerReviewState {
    if (this.manualOverride) {
      return this.manualOverride === this.expectedChoice ? 'correct' : 'wrong';
    }
    if (this.detectedChoices.length === 0) {
      return 'blank';
    }
    if (this.detectedChoices.length > 1) {
      return 'conflict';
    }
    return this.detectedChoices[0] === this.expectedChoice ? 'correct' : 'wrong';
  }

  public get requiresManualReview(): boolean {
    const state = this.reviewState;
    return state === 'blank' || state === 'conflict';
  }

  public get earnedPoints(): number {
    return this.reviewState === 'correct' ? this.points : 0;
  }

  public withManualOverride(choice: BubbleChoice | null): BubbleResponse {
    return new BubbleResponse({
      itemNumber: this.itemNumber,
      expectedChoice: this.expectedChoice,
      detectedChoices: this.detectedChoices,
      manualOverride: choice,
      points: this.points,
      confidence: this.confidence,
    });
  }
}
