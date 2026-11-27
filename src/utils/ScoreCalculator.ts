import {DEFAULT_PASSING_PERCENTAGE} from '@constants/grading';

export interface ClassPerformanceSummary {
  readonly totalStudents: number;
  readonly passedCount: number;
  readonly passingRate: number;
  readonly meanScore: number;
}

/**
 * Pure domain calculation utility for exam scores and class analytics.
 */
export class ScoreCalculator {
  public static combinedStudentScore(student: {
    score: number;
    total: number;
    manualScore?: number;
    manualMax?: number;
  }): {earnedPoints: number; maxPoints: number} {
    return {
      earnedPoints: student.score + (student.manualScore ?? 0),
      maxPoints: student.total + (student.manualMax ?? 0),
    };
  }

  public static percentage(earnedPoints: number, maxPoints: number): number {
    if (maxPoints <= 0) {
      return 0;
    }
    return Math.round((earnedPoints / maxPoints) * 1000) / 10;
  }

  public static isPassing(
    earnedPoints: number,
    maxPoints: number,
    thresholdPercent: number = DEFAULT_PASSING_PERCENTAGE,
  ): boolean {
    return ScoreCalculator.percentage(earnedPoints, maxPoints) >= thresholdPercent;
  }

  public static summarizeClass(
    scores: ReadonlyArray<{earnedPoints: number; maxPoints: number}>,
    thresholdPercent: number = DEFAULT_PASSING_PERCENTAGE,
  ): ClassPerformanceSummary {
    const totalStudents = scores.length;
    if (totalStudents === 0) {
      return {
        totalStudents: 0,
        passedCount: 0,
        passingRate: 0,
        meanScore: 0,
      };
    }

    let passedCount = 0;
    let totalEarned = 0;

    for (const entry of scores) {
      totalEarned += entry.earnedPoints;
      if (
        ScoreCalculator.isPassing(
          entry.earnedPoints,
          entry.maxPoints,
          thresholdPercent,
        )
      ) {
        passedCount += 1;
      }
    }

    return {
      totalStudents,
      passedCount,
      passingRate: Math.round((passedCount / totalStudents) * 100),
      meanScore: Math.round((totalEarned / totalStudents) * 10) / 10,
    };
  }
}
