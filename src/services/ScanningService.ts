import {BUBBLE_CHOICES, OMR_SENSITIVITY_PROFILES} from '@constants/omr';
import {ObservableStore} from '@core/base/ObservableStore';
import {BubbleChoice, OmrSensitivity} from '@core/types/common';
import {
  INITIAL_REVIEW_TILES,
  INITIAL_SCAN_HISTORY,
  OmrFlagReason,
  ReviewTileView,
  ScanHistoryItemView,
} from '@data/database/SeedData';
import {NativeOmrAnalysisResult} from '@engines/omr/NativeOmrEngine';
import {ExamService} from '@services/ExamService';
import {ProfileSettingsService} from '@services/ProfileSettingsService';
import {RosterService} from '@services/RosterService';
import {Colors} from '@theme/colors';
import {DateFormatter} from '@utils/DateFormatter';
import {IdGenerator} from '@utils/IdGenerator';
import {ScoreCalculator} from '@utils/ScoreCalculator';

export type AlignmentViewMode = 'raw' | 'aligned';

export interface StudentScanSession {
  readonly rawImageUri: string | null;
  readonly alignedImageUri: string | null;
  readonly markersDetected: number;
  readonly rotationAngleDeg: number;
  readonly lightingStatus: string;
  readonly sharpnessScore: number;
  readonly reviewTiles: ReviewTileView[];
  readonly confirmed: boolean;
  readonly flaggedAlerted?: boolean;
}

export interface ScanningState {
  readonly flashOn: boolean;
  readonly alignmentView: AlignmentViewMode;
  readonly activeStudentId: string;
  readonly activeExamId: string;
  readonly rawImageUri: string | null;
  readonly alignedImageUri: string | null;
  readonly markersDetected: number;
  readonly rotationAngleDeg: number;
  readonly lightingStatus: string;
  readonly sharpnessScore: number;
  readonly reviewTiles: ReviewTileView[];
  readonly scanHistory: ScanHistoryItemView[];
  readonly scansByKey?: Record<string, StudentScanSession>;
}

const makeSessionKey = (examId: string, studentId: string): string =>
  `${examId || 'default'}:${studentId || 'unknown'}`;

const buildSeedScansByKey = (): Record<string, StudentScanSession> => ({
  [makeSessionKey('ex-math-q1', '2026-0001')]: {
    rawImageUri: null,
    alignedImageUri: null,
    markersDetected: 4,
    rotationAngleDeg: -4.2,
    lightingStatus: 'Clear',
    sharpnessScore: 0.92,
    reviewTiles: INITIAL_REVIEW_TILES.map(t => ({...t})),
    confirmed: false,
  },
});

/**
 * OOP Application Service coordinating live QR decode -> Paper capture -> OMR Alignment
 * -> Offline Bubble Check -> Manual Verification -> Per-Student Scan Sessions & Alerts.
 */
export class ScanningService extends ObservableStore<ScanningState> {
  private readonly rosterService: RosterService;
  private readonly examService: ExamService;
  private readonly profileSettingsService: ProfileSettingsService;

  constructor(
    rosterService: RosterService,
    examService: ExamService,
    profileSettingsService: ProfileSettingsService,
  ) {
    super({
      flashOn: false,
      alignmentView: 'aligned',
      activeStudentId: '2026-0001',
      activeExamId: 'ex-math-q1',
      rawImageUri: null,
      alignedImageUri: null,
      markersDetected: 4,
      rotationAngleDeg: -4.2,
      lightingStatus: 'Clear',
      sharpnessScore: 0.92,
      reviewTiles: INITIAL_REVIEW_TILES.map(t => ({...t})),
      scanHistory: INITIAL_SCAN_HISTORY.map(h => ({...h})),
      scansByKey: buildSeedScansByKey(),
    });
    this.rosterService = rosterService;
    this.examService = examService;
    this.profileSettingsService = profileSettingsService;
  }

  private resolveSessionFor(
    prev: ScanningState,
    examId: string,
    studentId: string,
  ): StudentScanSession | null {
    const key = makeSessionKey(examId, studentId);
    return prev.scansByKey?.[key] ?? null;
  }

  public toggleFlash(): boolean {
    const next = !this.getState().flashOn;
    this.setState(prev => ({...prev, flashOn: next}));
    return next;
  }

  public setAlignmentView(mode: AlignmentViewMode): void {
    this.setState(prev => ({...prev, alignmentView: mode}));
  }

  public setActiveSession(studentId: string, examId?: string): void {
    this.setState(prev => {
      const nextExamId = examId ?? prev.activeExamId;
      const stored = this.resolveSessionFor(prev, nextExamId, studentId);
      if (stored) {
        return {
          ...prev,
          activeStudentId: studentId,
          activeExamId: nextExamId,
          rawImageUri: stored.rawImageUri,
          alignedImageUri: stored.alignedImageUri,
          markersDetected: stored.markersDetected,
          rotationAngleDeg: stored.rotationAngleDeg,
          lightingStatus: stored.lightingStatus,
          sharpnessScore: stored.sharpnessScore,
          reviewTiles: stored.reviewTiles.map(t => ({...t})),
        };
      }
      return {
        ...prev,
        activeStudentId: studentId,
        activeExamId: nextExamId,
        rawImageUri: null,
        alignedImageUri: null,
        markersDetected: 0,
        rotationAngleDeg: 0,
        lightingStatus: 'Clear',
        sharpnessScore: 1,
        reviewTiles: [],
      };
    });
  }

  public setActiveStudent(studentId: string): void {
    this.setActiveSession(studentId, this.getState().activeExamId);
  }

  public setCapturedRawImage(rawImageUri: string | null): void {
    this.setState(prev => ({
      ...prev,
      rawImageUri,
      alignedImageUri: null,
    }));
  }

  public applyNativeOmrAnalysis(result: NativeOmrAnalysisResult): void {
    const state = this.getState();
    const key = makeSessionKey(state.activeExamId, state.activeStudentId);
    const prevSession = state.scansByKey?.[key];
    const pointsPerItem = this.examService.getPointsPerItem(state.activeExamId);
    const earnedPoints = result.score * pointsPerItem;
    const totalPoints = result.total * pointsPerItem;
    const hasFlagged = result.flaggedCount > 0;

    const nextSession: StudentScanSession = {
      rawImageUri: result.rawImageUri,
      alignedImageUri: result.alignedImageUri,
      markersDetected: result.markersDetected,
      rotationAngleDeg: result.rotationAngleDeg,
      lightingStatus: result.lightingStatus,
      sharpnessScore: result.sharpnessScore,
      reviewTiles: result.items,
      confirmed: prevSession?.confirmed ?? false,
      flaggedAlerted: hasFlagged,
    };

    this.setState(prev => ({
      ...prev,
      rawImageUri: result.rawImageUri,
      alignedImageUri: result.alignedImageUri,
      markersDetected: result.markersDetected,
      rotationAngleDeg: result.rotationAngleDeg,
      lightingStatus: result.lightingStatus,
      sharpnessScore: result.sharpnessScore,
      reviewTiles: result.items,
      scansByKey: {
        ...(prev.scansByKey ?? {}),
        [key]: nextSession,
      },
    }));

    this.rosterService.setStudentScore(
      state.activeStudentId,
      earnedPoints,
      totalPoints,
      hasFlagged ? 'Review' : 'Checked',
    );

    if (hasFlagged) {
      if (!prevSession?.flaggedAlerted) {
        this.examService.recordScanFlagged(state.activeExamId);
      }
      const student = this.rosterService
        .getState()
        .students.find(s => s.id === state.activeStudentId);
      const flaggedNums = result.items
        .filter(i => i.type === 'blank' || i.type === 'flagged')
        .slice(0, 4)
        .map(i => `#${i.num}`)
        .join(', ');
      const issueTags: string[] = [];
      if (result.halfShadedCount && result.halfShadedCount > 0) {
        issueTags.push(`${result.halfShadedCount} half-shaded`);
      }
      if (result.overShadedCount && result.overShadedCount > 0) {
        issueTags.push(`${result.overShadedCount} ink spill`);
      }
      const tagText = issueTags.length > 0 ? ` (${issueTags.join(', ')})` : '';
      this.profileSettingsService.pushAlert({
        title: `${result.flaggedCount} flagged item${
          result.flaggedCount === 1 ? '' : 's'
        } on ${student?.name ?? state.activeStudentId}`,
        detail: flaggedNums
          ? `Items ${flaggedNums}${tagText} need verification.`
          : `Tap to verify flagged shading${tagText}.`,
        category: 'scan',
        targetRoute: 'Review',
        targetStudentId: state.activeStudentId,
        targetExamId: state.activeExamId,
      });
    }
  }

  public cycleNextScanCandidate(): {studentId: string; studentName: string} {
    const students = this.rosterService.getState().students;
    if (students.length === 0) {
      return {studentId: '', studentName: 'No students yet'};
    }
    const currentIdx = students.findIndex(
      s => s.id === this.getState().activeStudentId,
    );
    const nextStudent = students[(currentIdx + 1) % students.length];
    this.setActiveSession(nextStudent.id, this.getState().activeExamId);
    return {studentId: nextStudent.id, studentName: nextStudent.name};
  }

  public runOfflineOmrEvaluation(
    sensitivity: OmrSensitivity,
    flagDoubleShade: boolean,
  ): void {
    const state = this.getState();
    const sessionKey = makeSessionKey(state.activeExamId, state.activeStudentId);
    // Keep real native OMR tiles when already populated for this exact student/exam capture
    if (state.alignedImageUri && state.reviewTiles.length > 0) {
      return;
    }

    const key = this.examService.getAnswerKey(state.activeExamId);
    const totalItems = Math.max(1, key.length);
    const pointsPerItem = this.examService.getPointsPerItem(state.activeExamId);

    const buildFallbackRatios = (
      shaded: BubbleChoice[],
      seedOffset: number,
    ): Record<BubbleChoice, number> => {
      const choices: BubbleChoice[] = ['A', 'B', 'C', 'D'];
      const out = {} as Record<BubbleChoice, number>;
      choices.forEach((c, idx) => {
        if (shaded.includes(c)) {
          const base = shaded.length > 1 ? 0.56 : 0.78;
          out[c] = Number((base + ((seedOffset + idx * 3) % 12) * 0.01).toFixed(2));
        } else {
          out[c] = Number((0.06 + ((seedOffset + idx * 5) % 8) * 0.01).toFixed(2));
        }
      });
      return out;
    };

    const persistTilesAndScore = (tiles: ReviewTileView[]) => {
      const earnedItems = tiles.filter(t => t.type === 'correct').length;
      const hasFlagged = tiles.some(
        t => t.type === 'blank' || t.type === 'flagged',
      );
      const prevSession = state.scansByKey?.[sessionKey];
      const nextSession: StudentScanSession = {
        rawImageUri: state.rawImageUri,
        alignedImageUri: state.alignedImageUri,
        markersDetected: state.markersDetected || 4,
        rotationAngleDeg: state.rotationAngleDeg,
        lightingStatus: state.lightingStatus,
        sharpnessScore: state.sharpnessScore,
        reviewTiles: tiles,
        confirmed: prevSession?.confirmed ?? false,
        flaggedAlerted: hasFlagged,
      };
      this.setState(prev => ({
        ...prev,
        reviewTiles: tiles,
        scansByKey: {
          ...(prev.scansByKey ?? {}),
          [sessionKey]: nextSession,
        },
      }));
      this.rosterService.setStudentScore(
        state.activeStudentId,
        earnedItems * pointsPerItem,
        totalItems * pointsPerItem,
        hasFlagged ? 'Review' : 'Checked',
      );
      if (hasFlagged && !prevSession?.flaggedAlerted) {
        this.examService.recordScanFlagged(state.activeExamId);
      }
    };

    if (state.activeStudentId === '2026-0001' && totalItems === 50) {
      const tiles: ReviewTileView[] = Array.from({length: totalItems}, (_, i) => {
        const expected = key[i] ?? 'A';
        const seedTile = INITIAL_REVIEW_TILES[i];
        if (seedTile) {
          if (seedTile.type === 'flagged' && !flagDoubleShade) {
            return {
              ...seedTile,
              key: expected,
              type: 'correct' as const,
              label: expected,
              fillRatios:
                seedTile.fillRatios ?? buildFallbackRatios([expected], i),
            };
          }
          return {
            ...seedTile,
            key: expected,
            fillRatios:
              seedTile.fillRatios ?? buildFallbackRatios([expected], i),
          };
        }
        return {
          num: i + 1,
          detected: expected,
          key: expected,
          type: 'correct' as const,
          label: expected,
          fillRatios: buildFallbackRatios([expected], i),
        };
      });
      persistTilesAndScore(tiles);
      return;
    }

    let seed = 0;
    for (let i = 0; i < state.activeStudentId.length; i += 1) {
      seed += state.activeStudentId.charCodeAt(i);
    }

    const tiles: ReviewTileView[] = Array.from({length: totalItems}, (_, i) => {
      const expected = key[i] ?? 'A';
      const mod = (seed + i * 7) % 10;
      if (mod === 3 && sensitivity !== 'lenient') {
        return {
          num: i + 1,
          detected: 'Blank',
          key: expected,
          type: 'blank',
          label: 'Blank',
          fillRatios: buildFallbackRatios([], seed + i),
        };
      }
      if (mod === 6 && flagDoubleShade) {
        const other: BubbleChoice = expected === 'A' ? 'B' : 'A';
        return {
          num: i + 1,
          detected: `${other} + ${expected}`,
          key: expected,
          type: 'flagged',
          label: `${other} + ${expected}`,
          fillRatios: buildFallbackRatios([other, expected], seed + i),
        };
      }
      if (mod === 2 || mod === 8) {
        const wrong: BubbleChoice = expected === 'A' ? 'B' : 'A';
        return {
          num: i + 1,
          detected: wrong,
          key: expected,
          type: 'wrong',
          label: `${wrong} → ${expected}`,
          fillRatios: buildFallbackRatios([wrong], seed + i),
        };
      }
      return {
        num: i + 1,
        detected: expected,
        key: expected,
        type: 'correct',
        label: expected,
        fillRatios: buildFallbackRatios([expected], seed + i),
      };
    });

    persistTilesAndScore(tiles);
  }

  public setReviewTileChoice(
    tileIndex: number,
    choice: BubbleChoice | 'blank',
  ): {tile: ReviewTileView; delta: number} {
    const state = this.getState();
    const currentTile = state.reviewTiles[tileIndex];
    const wasCorrect = currentTile.type === 'correct';
    const pointsPerItem = this.examService.getPointsPerItem(state.activeExamId);

    let nextTile: ReviewTileView;
    if (choice === 'blank') {
      nextTile = {
        ...currentTile,
        detected: 'Blank',
        type: 'blank',
        flagReason: 'blank',
        label: 'Blank',
      };
    } else if (choice === currentTile.key) {
      nextTile = {
        ...currentTile,
        detected: choice,
        type: 'correct',
        flagReason: undefined,
        label: choice,
      };
    } else {
      nextTile = {
        ...currentTile,
        detected: choice,
        type: 'wrong',
        flagReason: undefined,
        label: `${choice} → ${currentTile.key}`,
      };
    }

    const isNowCorrect = nextTile.type === 'correct';
    const delta = ((isNowCorrect ? 1 : 0) - (wasCorrect ? 1 : 0)) * pointsPerItem;
    const sessionKey = makeSessionKey(state.activeExamId, state.activeStudentId);

    this.setState(prev => {
      const nextTiles = prev.reviewTiles.map((t, idx) =>
        idx === tileIndex ? nextTile : t,
      );
      const prevSession = prev.scansByKey?.[sessionKey];
      return {
        ...prev,
        reviewTiles: nextTiles,
        scansByKey: {
          ...(prev.scansByKey ?? {}),
          [sessionKey]: {
            rawImageUri: prevSession?.rawImageUri ?? prev.rawImageUri,
            alignedImageUri: prevSession?.alignedImageUri ?? prev.alignedImageUri,
            markersDetected: prevSession?.markersDetected ?? prev.markersDetected,
            rotationAngleDeg:
              prevSession?.rotationAngleDeg ?? prev.rotationAngleDeg,
            lightingStatus: prevSession?.lightingStatus ?? prev.lightingStatus,
            sharpnessScore: prevSession?.sharpnessScore ?? prev.sharpnessScore,
            reviewTiles: nextTiles,
            confirmed: prevSession?.confirmed ?? false,
            flaggedAlerted: prevSession?.flaggedAlerted,
          },
        },
      };
    });

    if (delta !== 0) {
      this.rosterService.updateStudentScore(state.activeStudentId, delta);
    }

    return {tile: nextTile, delta};
  }

  public overrideReviewTile(tileIndex: number): {
    changed: boolean;
    tile: ReviewTileView;
  } {
    const currentTile = this.getState().reviewTiles[tileIndex];
    if (!currentTile || currentTile.type === 'correct') {
      return {changed: false, tile: currentTile};
    }
    const {tile} = this.setReviewTileChoice(tileIndex, currentTile.key);
    return {changed: true, tile};
  }

  public confirmActiveScan(): void {
    const state = this.getState();
    const sessionKey = makeSessionKey(state.activeExamId, state.activeStudentId);
    const prevSession = state.scansByKey?.[sessionKey];
    const alreadyConfirmed = Boolean(prevSession?.confirmed);

    const student = this.rosterService
      .getState()
      .students.find(s => s.id === state.activeStudentId);
    const exam = this.examService
      .getState()
      .exams.find(e => e.id === state.activeExamId);

    this.rosterService.updateStudentScore(state.activeStudentId, 0, 'Checked');
    this.examService.recordScanConfirmed(state.activeExamId, alreadyConfirmed);

    const existingIndex = state.scanHistory.findIndex(
      h =>
        h.studentId === state.activeStudentId &&
        (!h.examId || h.examId === state.activeExamId),
    );
    const timeLabel = DateFormatter.toShortTime(new Date().toISOString());
    const nextMeta = `${exam?.subject ?? 'Exam'} · ${timeLabel}`;

    this.setState(prev => {
      const updatedSession: StudentScanSession = {
        rawImageUri: prevSession?.rawImageUri ?? prev.rawImageUri,
        alignedImageUri: prevSession?.alignedImageUri ?? prev.alignedImageUri,
        markersDetected: prevSession?.markersDetected ?? prev.markersDetected,
        rotationAngleDeg: prevSession?.rotationAngleDeg ?? prev.rotationAngleDeg,
        lightingStatus: prevSession?.lightingStatus ?? prev.lightingStatus,
        sharpnessScore: prevSession?.sharpnessScore ?? prev.sharpnessScore,
        reviewTiles: prev.reviewTiles,
        confirmed: true,
        flaggedAlerted: false,
      };
      const nextScansByKey = {
        ...(prev.scansByKey ?? {}),
        [sessionKey]: updatedSession,
      };

      if (existingIndex >= 0) {
        return {
          ...prev,
          scansByKey: nextScansByKey,
          scanHistory: prev.scanHistory.map((item, idx) =>
            idx === existingIndex
              ? {
                  ...item,
                  examId: state.activeExamId,
                  meta: nextMeta,
                  status: 'Checked',
                  color: Colors.lime,
                }
              : item,
          ),
        };
      }
      const newEntry: ScanHistoryItemView = {
        id: IdGenerator.nextPrefixedId('scan'),
        studentId: state.activeStudentId,
        examId: state.activeExamId,
        name: student?.name ?? 'Student',
        meta: nextMeta,
        status: 'Checked',
        color: Colors.lime,
      };
      return {
        ...prev,
        scansByKey: nextScansByKey,
        scanHistory: [newEntry, ...prev.scanHistory],
      };
    });

    if (
      student &&
      this.profileSettingsService.getState().settings.lowScoreAlerts
    ) {
      const combined = ScoreCalculator.combinedStudentScore(student);
      if (
        combined.maxPoints > 0 &&
        !ScoreCalculator.isPassing(combined.earnedPoints, combined.maxPoints)
      ) {
        this.profileSettingsService.pushAlert({
          title: `${student.name} scored below 75% (${combined.earnedPoints}/${combined.maxPoints})`,
          detail: `${exam?.subject ?? 'Exam'} · Tap to view class analytics and results.`,
          category: 'score',
          targetRoute: 'Results',
          targetExamId: state.activeExamId,
          targetStudentId: state.activeStudentId,
        });
      }
    }

    const updatedExam = this.examService
      .getState()
      .exams.find(e => e.id === state.activeExamId);
    if (
      !alreadyConfirmed &&
      updatedExam &&
      updatedExam.total > 0 &&
      updatedExam.scanned >= updatedExam.total
    ) {
      this.profileSettingsService.pushAlert({
        title: `All ${updatedExam.total}/${updatedExam.total} papers checked for ${updatedExam.subject}`,
        detail: `${updatedExam.term} (${updatedExam.section}) is ready for grade sheet export.`,
        category: 'exam',
        targetRoute: 'Reports',
        targetExamId: updatedExam.id,
      });
    }
  }

  /**
   * Dynamically re-evaluates existing scanned review tiles against a newly chosen
   * OMR shading sensitivity profile (Strict / Balanced / Lenient) and double-shade rule.
   */
  public reapplyOmrSensitivity(
    sensitivity: OmrSensitivity,
    flagDoubleShade: boolean,
  ): number {
    const state = this.getState();
    if (state.reviewTiles.length === 0) {
      return 0;
    }

    const profile = OMR_SENSITIVITY_PROFILES[sensitivity];
    const pointsPerItem = this.examService.getPointsPerItem(state.activeExamId);
    let changedCount = 0;

    const updatedTiles: ReviewTileView[] = state.reviewTiles.map(tile => {
      if (!tile.fillRatios) {
        return tile;
      }

      const coverages = BUBBLE_CHOICES.map(c => tile.fillRatios?.[c] ?? 0);
      const bleeds = BUBBLE_CHOICES.map(c => tile.bleedRatios?.[c] ?? 0);
      const sorted = [...coverages].sort((a, b) => a - b);
      const rowBaseline = (sorted[0] + sorted[1]) / 2;

      const shaded: BubbleChoice[] = [];
      const halfShaded: BubbleChoice[] = [];
      const overShaded: BubbleChoice[] = [];

      BUBBLE_CHOICES.forEach((choice, idx) => {
        const cov = coverages[idx];
        const bleed = bleeds[idx];
        const relDelta = Math.max(0, cov - rowBaseline);

        const isFullyShaded =
          cov >= profile.minShadedRatio && relDelta >= profile.rowDeltaRatio;
        const isOverShaded =
          bleed >= profile.maxBleedRatio &&
          (isFullyShaded || cov >= profile.partialMinRatio);
        const isHalfShaded =
          !isFullyShaded &&
          !isOverShaded &&
          cov >= profile.partialMinRatio &&
          relDelta >= 0.09;

        if (isOverShaded) {
          overShaded.push(choice);
        }
        if (isFullyShaded) {
          shaded.push(choice);
        } else if (isHalfShaded) {
          halfShaded.push(choice);
        }
      });

      let nextType: ReviewTileView['type'];
      let nextDetected: string;
      let nextLabel: string;
      let nextFlagReason: OmrFlagReason | undefined;

      if (overShaded.length > 0) {
        const worst = overShaded.reduce((a, b) =>
          (tile.bleedRatios?.[b] ?? 0) > (tile.bleedRatios?.[a] ?? 0) ? b : a,
        );
        nextType = 'flagged';
        nextDetected = `${worst} (Messy)`;
        nextLabel = `${worst} · Messy`;
        nextFlagReason = 'over_shaded';
      } else if (shaded.length > 1 && flagDoubleShade) {
        const joined = shaded.join(' + ');
        nextType = 'flagged';
        nextDetected = joined;
        nextLabel = joined;
        nextFlagReason = 'double_shaded';
      } else if (shaded.length === 0 && halfShaded.length > 0) {
        const bestHalf = halfShaded.reduce((a, b) =>
          (tile.fillRatios?.[b] ?? 0) > (tile.fillRatios?.[a] ?? 0) ? b : a,
        );
        nextType = 'flagged';
        nextDetected = `${bestHalf} (Half)`;
        nextLabel = `${bestHalf} · Half`;
        nextFlagReason = 'half_shaded';
      } else if (shaded.length === 0) {
        nextType = 'blank';
        nextDetected = 'Blank';
        nextLabel = 'Blank';
        nextFlagReason = 'blank';
      } else {
        const chosen = shaded.reduce((a, b) =>
          (tile.fillRatios?.[b] ?? 0) > (tile.fillRatios?.[a] ?? 0) ? b : a,
        );
        nextDetected = chosen;
        nextFlagReason = undefined;
        if (chosen === tile.key) {
          nextType = 'correct';
          nextLabel = chosen;
        } else {
          nextType = 'wrong';
          nextLabel = `${chosen} → ${tile.key}`;
        }
      }

      if (
        nextType !== tile.type ||
        nextLabel !== tile.label ||
        nextFlagReason !== tile.flagReason
      ) {
        changedCount += 1;
      }

      return {
        ...tile,
        type: nextType,
        detected: nextDetected,
        label: nextLabel,
        flagReason: nextFlagReason,
      };
    });

    if (changedCount > 0) {
      const sessionKey = makeSessionKey(
        state.activeExamId,
        state.activeStudentId,
      );
      this.setState(prev => {
        const prevSession = prev.scansByKey?.[sessionKey];
        return {
          ...prev,
          reviewTiles: updatedTiles,
          scansByKey: {
            ...(prev.scansByKey ?? {}),
            [sessionKey]: {
              rawImageUri: prevSession?.rawImageUri ?? prev.rawImageUri,
              alignedImageUri:
                prevSession?.alignedImageUri ?? prev.alignedImageUri,
              markersDetected:
                prevSession?.markersDetected ?? prev.markersDetected,
              rotationAngleDeg:
                prevSession?.rotationAngleDeg ?? prev.rotationAngleDeg,
              lightingStatus:
                prevSession?.lightingStatus ?? prev.lightingStatus,
              sharpnessScore:
                prevSession?.sharpnessScore ?? prev.sharpnessScore,
              reviewTiles: updatedTiles,
              confirmed: prevSession?.confirmed ?? false,
              flaggedAlerted: prevSession?.flaggedAlerted,
            },
          },
        };
      });
      if (state.activeStudentId) {
        const earned = updatedTiles.filter(t => t.type === 'correct').length;
        const hasFlagged = updatedTiles.some(
          t => t.type === 'blank' || t.type === 'flagged',
        );
        this.rosterService.setStudentScore(
          state.activeStudentId,
          earned * pointsPerItem,
          updatedTiles.length * pointsPerItem,
          hasFlagged ? 'Review' : 'Checked',
        );
      }
    }

    return changedCount;
  }

  public getFlaggedTileNumbers(): number[] {
    return this.getState()
      .reviewTiles.filter(t => t.type === 'blank' || t.type === 'flagged')
      .map(t => t.num);
  }

  public resetToEmptyWorkspace(): void {
    this.setState({
      flashOn: false,
      alignmentView: 'aligned',
      activeStudentId: '',
      activeExamId: '',
      rawImageUri: null,
      alignedImageUri: null,
      markersDetected: 0,
      rotationAngleDeg: 0,
      lightingStatus: 'Clear',
      sharpnessScore: 1,
      reviewTiles: [],
      scanHistory: [],
      scansByKey: {},
    });
  }

  public resetAllData(): void {
    this.setState({
      flashOn: false,
      alignmentView: 'aligned',
      activeStudentId: '2026-0001',
      activeExamId: 'ex-math-q1',
      rawImageUri: null,
      alignedImageUri: null,
      markersDetected: 4,
      rotationAngleDeg: -4.2,
      lightingStatus: 'Clear',
      sharpnessScore: 0.92,
      reviewTiles: INITIAL_REVIEW_TILES.map(t => ({...t})),
      scanHistory: INITIAL_SCAN_HISTORY.map(h => ({...h})),
      scansByKey: buildSeedScansByKey(),
    });
  }

  public restoreState(snapshot: ScanningState): void {
    this.setState({
      ...snapshot,
      scansByKey: snapshot.scansByKey ?? {},
    });
  }
}
