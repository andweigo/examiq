import {MAX_OMR_ITEM_COUNT} from '@constants/grading';
import {BUBBLE_CHOICES, OMR_TEMPLATE_VERSION} from '@constants/omr';
import {ObservableStore} from '@core/base/ObservableStore';
import {BubbleChoice, PaperSize, PointWeight} from '@core/types/common';
import {
  BuilderQuestionView,
  ExamCardItem,
  INITIAL_ANSWER_KEY,
  INITIAL_EXAMS,
  INITIAL_POINTS_PER_ITEM,
  INITIAL_QUESTIONS,
  QuestionKind,
} from '@data/database/SeedData';
import {ChecksumUtil} from '@utils/ChecksumUtil';
import {DateFormatter} from '@utils/DateFormatter';
import {IdGenerator} from '@utils/IdGenerator';

export interface CreateExamInput {
  subject: string;
  term: string;
  section: string;
  date: string;
  color: string;
  items: number;
  paperSize?: PaperSize;
  totalStudents: number;
}

export interface GeneratedSheetAssignment {
  readonly assignmentId: string;
  readonly examId: string;
  readonly studentId: string;
  readonly qrPayload: string;
  readonly createdAt: string;
}

export interface ExamAlignmentOverlay {
  readonly examId: string;
  readonly templateVersion: string;
  readonly paperSize: PaperSize;
  readonly itemCount: number;
  readonly rowsPerColumn: number;
  readonly overlaySignature: string;
  readonly generatedAt: string;
}

export interface ExamState {
  readonly exams: ExamCardItem[];
  readonly selectedExamId: string;
  readonly activeFilter: string;
  readonly questionsByExamId: Record<string, BuilderQuestionView[]>;
  readonly answerKeysByExamId: Record<string, BubbleChoice[]>;
  readonly pointsByExamId: Record<string, PointWeight>;
  readonly assignmentsByExamId: Record<string, GeneratedSheetAssignment[]>;
  readonly overlaysByExamId: Record<string, ExamAlignmentOverlay>;
}

function buildDefaultKey(length: number): BubbleChoice[] {
  return Array.from({length}, (_, idx) => {
    return INITIAL_ANSWER_KEY[idx % INITIAL_ANSWER_KEY.length];
  });
}

function createOverlaySpec(
  examId: string,
  paperSize: PaperSize,
  itemCount: number,
): ExamAlignmentOverlay {
  const clamped = Math.max(1, Math.min(60, itemCount));
  return {
    examId,
    templateVersion: OMR_TEMPLATE_VERSION,
    paperSize,
    itemCount: clamped,
    rowsPerColumn: Math.ceil(clamped / 2),
    overlaySignature: ChecksumUtil.compute(
      `${examId}|${paperSize}|${clamped}|${OMR_TEMPLATE_VERSION}`,
    ),
    generatedAt: new Date().toISOString(),
  };
}

function buildInitialState(): ExamState {
  const questionsByExamId: Record<string, BuilderQuestionView[]> = {};
  const answerKeysByExamId: Record<string, BubbleChoice[]> = {};
  const pointsByExamId: Record<string, PointWeight> = {};
  const overlaysByExamId: Record<string, ExamAlignmentOverlay> = {};

  INITIAL_EXAMS.forEach((exam, idx) => {
    questionsByExamId[exam.id] =
      idx === 0
        ? INITIAL_QUESTIONS.map(q => ({
            ...q,
            choices: [...q.choices] as [string, string, string, string],
          }))
        : [
            {
              num: 1,
              text: `${exam.subject} (${exam.term}) — Core Concept Question 1`,
              choices: ['Option A', 'Option B', 'Option C', 'Option D'],
              answer: 'A',
            },
            {
              num: 2,
              text: `${exam.subject} (${exam.term}) — Applied Problem Question 2`,
              choices: ['Option A', 'Option B', 'Option C', 'Option D'],
              answer: 'C',
            },
          ];
    answerKeysByExamId[exam.id] = buildDefaultKey(exam.items);
    pointsByExamId[exam.id] = INITIAL_POINTS_PER_ITEM;
    overlaysByExamId[exam.id] = createOverlaySpec(
      exam.id,
      exam.paperSize,
      exam.items,
    );
  });

  return {
    exams: INITIAL_EXAMS.map(e => ({...e})),
    selectedExamId: INITIAL_EXAMS[0].id,
    activeFilter: 'All',
    questionsByExamId,
    answerKeysByExamId,
    pointsByExamId,
    assignmentsByExamId: {},
    overlaysByExamId,
  };
}

const EMPTY_EXAM_PLACEHOLDER: ExamCardItem = {
  id: '',
  subject: 'No exam yet',
  term: 'Create an exam',
  section: 'Unassigned',
  date: 'Today',
  scanned: 0,
  total: 0,
  color: '#958BFF',
  items: 10,
  paperSize: 'A4',
  passingRate: 0,
  needsReviewCount: 0,
};

/**
 * OOP Application Service for Exam Management, strict 2-way Builder <-> Answer Key sync,
 * Paper Size management, and OMR Alignment Overlay Template generation.
 */
export class ExamService extends ObservableStore<ExamState> {
  constructor() {
    super(buildInitialState());
  }

  public getSelectedExam(): ExamCardItem {
    const state = this.getState();
    return (
      state.exams.find(e => e.id === state.selectedExamId) ??
      state.exams[0] ??
      EMPTY_EXAM_PLACEHOLDER
    );
  }

  public hasGeneratedSheets(examId: string): boolean {
    const list = this.getState().assignmentsByExamId[examId];
    return Boolean(list && list.length > 0);
  }

  public getQuestions(examId?: string): BuilderQuestionView[] {
    const state = this.getState();
    const id = examId ?? state.selectedExamId;
    return state.questionsByExamId[id] ?? [];
  }

  public getMcqQuestions(examId?: string): BuilderQuestionView[] {
    return this.getQuestions(examId).filter(q => q.kind !== 'essay');
  }

  public getEssayQuestions(examId?: string): BuilderQuestionView[] {
    return this.getQuestions(examId).filter(q => q.kind === 'essay');
  }

  public getEssayMaxPoints(examId?: string): number {
    return this.getEssayQuestions(examId).reduce(
      (sum, q) => sum + Math.max(1, q.maxPoints ?? 10),
      0,
    );
  }

  public getAnswerKey(examId?: string): BubbleChoice[] {
    const state = this.getState();
    const id = examId ?? state.selectedExamId;
    return state.answerKeysByExamId[id] ?? INITIAL_ANSWER_KEY;
  }

  public getPointsPerItem(examId?: string): PointWeight {
    const state = this.getState();
    const id = examId ?? state.selectedExamId;
    return state.pointsByExamId[id] ?? 1;
  }

  public getAlignmentOverlay(examId?: string): ExamAlignmentOverlay | null {
    const state = this.getState();
    const id = examId ?? state.selectedExamId;
    return state.overlaysByExamId[id] ?? null;
  }

  public getTotalConfiguredPoints(examId?: string): number {
    return this.getAnswerKey(examId).length * this.getPointsPerItem(examId);
  }

  public selectExam(examId: string): void {
    this.setState(prev => ({...prev, selectedExamId: examId}));
  }

  public setFilter(subjectFilter: string): void {
    this.setState(prev => ({...prev, activeFilter: subjectFilter}));
  }

  public createExam(input: CreateExamInput): ExamCardItem {
    const id = IdGenerator.nextPrefixedId('ex');
    const paperSize: PaperSize = input.paperSize ?? 'A4';
    const itemCount = Math.max(1, Math.min(60, input.items));
    const exam: ExamCardItem = {
      id,
      subject: input.subject.trim(),
      term: input.term.trim() || 'Quiz',
      section: input.section.trim(),
      date:
        input.date.trim() ||
        DateFormatter.toShortDate(new Date().toISOString()),
      scanned: 0,
      total: Math.max(1, input.totalStudents),
      color: input.color,
      items: itemCount,
      paperSize,
      passingRate: 0,
      needsReviewCount: 0,
    };

    this.setState(prev => ({
      ...prev,
      exams: [exam, ...prev.exams],
      selectedExamId: id,
      questionsByExamId: {
        ...prev.questionsByExamId,
        [id]: [],
      },
      answerKeysByExamId: {
        ...prev.answerKeysByExamId,
        [id]: buildDefaultKey(itemCount),
      },
      pointsByExamId: {
        ...prev.pointsByExamId,
        [id]: 1,
      },
      overlaysByExamId: {
        ...prev.overlaysByExamId,
        [id]: createOverlaySpec(id, paperSize, itemCount),
      },
    }));

    return exam;
  }

  public updateExam(examId: string, input: CreateExamInput): ExamCardItem | null {
    const existing = this.getState().exams.find(e => e.id === examId);
    if (!existing) {
      return null;
    }
    const nextItemCount = Math.max(1, Math.min(60, input.items));
    const nextPaperSize = input.paperSize ?? existing.paperSize;
    const updated: ExamCardItem = {
      ...existing,
      subject: input.subject.trim() || existing.subject,
      term: input.term.trim() || existing.term,
      section: input.section.trim() || existing.section,
      date: input.date.trim() || existing.date,
      color: input.color || existing.color,
      items: nextItemCount,
      paperSize: nextPaperSize,
      total: Math.max(1, input.totalStudents),
    };

    this.setState(prev => {
      const prevKey =
        prev.answerKeysByExamId[examId] ?? buildDefaultKey(nextItemCount);
      const nextKey =
        nextItemCount > prevKey.length
          ? [...prevKey, ...buildDefaultKey(nextItemCount - prevKey.length)]
          : prevKey.slice(0, nextItemCount);

      return {
        ...prev,
        exams: prev.exams.map(e => (e.id === examId ? updated : e)),
        answerKeysByExamId: {
          ...prev.answerKeysByExamId,
          [examId]: nextKey,
        },
        overlaysByExamId: {
          ...prev.overlaysByExamId,
          [examId]: createOverlaySpec(examId, nextPaperSize, nextItemCount),
        },
      };
    });

    return updated;
  }

  public setExamPaperSize(examId: string, paperSize: PaperSize): void {
    const exam = this.getState().exams.find(e => e.id === examId);
    if (!exam) {
      return;
    }
    this.setState(prev => ({
      ...prev,
      exams: prev.exams.map(e => (e.id === examId ? {...e, paperSize} : e)),
      overlaysByExamId: {
        ...prev.overlaysByExamId,
        [examId]: createOverlaySpec(examId, paperSize, exam.items),
      },
    }));
  }

  public generateAlignmentOverlay(examId?: string): ExamAlignmentOverlay {
    const targetId = examId ?? this.getState().selectedExamId;
    const exam =
      this.getState().exams.find(e => e.id === targetId) ??
      this.getSelectedExam();
    const keyLength = this.getAnswerKey(exam.id).length;
    const overlay = createOverlaySpec(exam.id, exam.paperSize, keyLength);

    this.setState(prev => ({
      ...prev,
      exams: prev.exams.map(e =>
        e.id === exam.id ? {...e, items: keyLength} : e,
      ),
      overlaysByExamId: {
        ...prev.overlaysByExamId,
        [exam.id]: overlay,
      },
    }));

    return overlay;
  }

  public deleteExam(examId: string): void {
    this.setState(prev => {
      const remaining = prev.exams.filter(e => e.id !== examId);
      const nextSelected =
        prev.selectedExamId === examId
          ? remaining[0]?.id ?? ''
          : prev.selectedExamId;
      const nextQuestions = {...prev.questionsByExamId};
      const nextKeys = {...prev.answerKeysByExamId};
      const nextPoints = {...prev.pointsByExamId};
      const nextAssignments = {...prev.assignmentsByExamId};
      const nextOverlays = {...prev.overlaysByExamId};
      delete nextQuestions[examId];
      delete nextKeys[examId];
      delete nextPoints[examId];
      delete nextAssignments[examId];
      delete nextOverlays[examId];
      return {
        ...prev,
        exams: remaining,
        selectedExamId: nextSelected,
        questionsByExamId: nextQuestions,
        answerKeysByExamId: nextKeys,
        pointsByExamId: nextPoints,
        assignmentsByExamId: nextAssignments,
        overlaysByExamId: nextOverlays,
      };
    });
  }

  /**
   * Ensures an exam that has Answer Key items also has matching editable MCQ question slots
   * in the Exam Builder so editing an existing exam never appears empty.
   */
  public ensureQuestionsFromAnswerKey(examId?: string): number {
    const targetId = examId ?? this.getState().selectedExamId;
    if (!targetId) {
      return 0;
    }
    const key = this.getAnswerKey(targetId);
    const existing = this.getQuestions(targetId);
    const existingMcqCount = existing.filter(q => q.kind !== 'essay').length;
    if (key.length === 0 || existingMcqCount >= key.length) {
      return 0;
    }

    const toAddCount = key.length - existingMcqCount;
    this.setState(prev => {
      const prevQuestions = prev.questionsByExamId[targetId] ?? [];
      const currentMcqs = prevQuestions.filter(q => q.kind !== 'essay').length;
      const missing: BuilderQuestionView[] = [];
      for (let i = currentMcqs; i < key.length; i += 1) {
        missing.push({
          num: prevQuestions.length + missing.length + 1,
          kind: 'mcq',
          text: `Question ${i + 1}`,
          choices: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
          answer: key[i] ?? 'A',
        });
      }
      return {
        ...prev,
        questionsByExamId: {
          ...prev.questionsByExamId,
          [targetId]: [...prevQuestions, ...missing].map((q, idx) => ({
            ...q,
            num: idx + 1,
          })),
        },
      };
    });

    return toAddCount;
  }

  public addQuestion(
    prompt?: string,
    choices?: [string, string, string, string],
    answer: BubbleChoice = 'B',
    options?: {
      kind?: QuestionKind;
      maxPoints?: number;
      rubric?: string;
    },
  ): BuilderQuestionView {
    const examId = this.getState().selectedExamId;
    const existing = this.getQuestions(examId);
    const nextNum = existing.length + 1;
    const kind: QuestionKind = options?.kind ?? 'mcq';

    const item: BuilderQuestionView =
      kind === 'essay'
        ? {
            num: nextNum,
            kind: 'essay',
            text:
              prompt?.trim() ||
              'Explain your solution and reasoning in 3–5 sentences.',
            choices: ['', '', '', ''],
            answer: 'A',
            maxPoints: Math.max(1, Math.round(options?.maxPoints ?? 10)),
            rubric: options?.rubric?.trim() || undefined,
          }
        : {
            num: nextNum,
            kind: 'mcq',
            text: prompt?.trim() || `Question ${nextNum}`,
            choices: choices ?? ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
            answer,
          };

    if (!examId) {
      return item;
    }

    this.setState(prev => {
      const prevQuestions = prev.questionsByExamId[examId] ?? [];
      if (kind !== 'essay') {
        const currentMcqs = prevQuestions.filter(q => q.kind !== 'essay').length;
        if (currentMcqs >= MAX_OMR_ITEM_COUNT) {
          return prev;
        }
      }
      const nextQuestions = [...prevQuestions, item];

      // Essay items are graded manually by the teacher and never add OMR bubbles
      if (kind === 'essay') {
        return {
          ...prev,
          questionsByExamId: {
            ...prev.questionsByExamId,
            [examId]: nextQuestions,
          },
        };
      }

      const mcqIndex = prevQuestions.filter(q => q.kind !== 'essay').length;
      const prevKey = [...(prev.answerKeysByExamId[examId] ?? [])];

      if (mcqIndex < prevKey.length) {
        prevKey[mcqIndex] = answer;
      } else if (prevKey.length < MAX_OMR_ITEM_COUNT) {
        prevKey.push(answer);
      }

      const nextMcqCount = mcqIndex + 1;
      const nextItemCount = Math.min(
        MAX_OMR_ITEM_COUNT,
        Math.max(prevKey.length, nextMcqCount),
      );
      const targetExam = prev.exams.find(e => e.id === examId);
      const paperSize = targetExam?.paperSize ?? 'A4';

      return {
        ...prev,
        exams: prev.exams.map(e =>
          e.id === examId ? {...e, items: nextItemCount} : e,
        ),
        questionsByExamId: {
          ...prev.questionsByExamId,
          [examId]: nextQuestions,
        },
        answerKeysByExamId: {
          ...prev.answerKeysByExamId,
          [examId]: prevKey.slice(0, nextItemCount),
        },
        overlaysByExamId: {
          ...prev.overlaysByExamId,
          [examId]: createOverlaySpec(examId, paperSize, nextItemCount),
        },
      };
    });

    return item;
  }

  public updateQuestion(
    questionIndex: number,
    prompt: string,
    choices: [string, string, string, string],
    answer: BubbleChoice,
    options?: {
      kind?: QuestionKind;
      maxPoints?: number;
      rubric?: string;
    },
  ): void {
    const examId = this.getState().selectedExamId;
    if (!examId) {
      return;
    }
    this.setState(prev => {
      const list = prev.questionsByExamId[examId] ?? [];
      const prevMcqCount = list.filter(q => q.kind !== 'essay').length;
      const updated = list.map((q, idx) => {
        if (idx !== questionIndex) {
          return q;
        }
        const nextKind: QuestionKind = options?.kind ?? q.kind ?? 'mcq';
        if (nextKind === 'essay') {
          return {
            ...q,
            kind: 'essay' as const,
            text: prompt.trim() || q.text,
            choices: ['', '', '', ''] as [string, string, string, string],
            maxPoints: Math.max(1, Math.round(options?.maxPoints ?? q.maxPoints ?? 10)),
            rubric: options?.rubric?.trim() || undefined,
          };
        }
        return {
          ...q,
          kind: 'mcq' as const,
          text: prompt.trim() || q.text,
          choices,
          answer,
          maxPoints: undefined,
          rubric: undefined,
        };
      });

      const prevKey = [...(prev.answerKeysByExamId[examId] ?? [])];
      const mcqQuestions = updated.filter(q => q.kind !== 'essay');
      const kindCountChanged = mcqQuestions.length !== prevMcqCount;

      let nextKey: BubbleChoice[];
      if (kindCountChanged && mcqQuestions.length > 0) {
        nextKey = mcqQuestions
          .slice(0, MAX_OMR_ITEM_COUNT)
          .map(mcq => mcq.answer);
      } else {
        nextKey = [...prevKey];
        mcqQuestions.forEach((mcq, mIdx) => {
          if (mIdx < nextKey.length) {
            nextKey[mIdx] = mcq.answer;
          } else if (nextKey.length < MAX_OMR_ITEM_COUNT) {
            nextKey.push(mcq.answer);
          }
        });
      }

      const nextItemCount = Math.max(
        1,
        Math.min(MAX_OMR_ITEM_COUNT, nextKey.length || 1),
      );
      const targetExam = prev.exams.find(e => e.id === examId);
      const paperSize = targetExam?.paperSize ?? 'A4';

      return {
        ...prev,
        exams: kindCountChanged
          ? prev.exams.map(e =>
              e.id === examId ? {...e, items: nextItemCount} : e,
            )
          : prev.exams,
        questionsByExamId: {...prev.questionsByExamId, [examId]: updated},
        answerKeysByExamId: {
          ...prev.answerKeysByExamId,
          [examId]: nextKey.slice(0, nextItemCount),
        },
        overlaysByExamId: kindCountChanged
          ? {
              ...prev.overlaysByExamId,
              [examId]: createOverlaySpec(examId, paperSize, nextItemCount),
            }
          : prev.overlaysByExamId,
      };
    });
  }

  public reorderQuestion(fromIndex: number, direction: 'up' | 'down'): boolean {
    const examId = this.getState().selectedExamId;
    const list = this.getQuestions(examId);
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= list.length) {
      return false;
    }

    this.setState(prev => {
      const nextQuestions = [...(prev.questionsByExamId[examId] ?? [])];
      const [moved] = nextQuestions.splice(fromIndex, 1);
      nextQuestions.splice(toIndex, 0, moved);
      const renumbered = nextQuestions.map((q, idx) => ({...q, num: idx + 1}));

      const nextKey = [...(prev.answerKeysByExamId[examId] ?? [])];
      const mcqAnswers = renumbered
        .filter(q => q.kind !== 'essay')
        .map(q => q.answer);
      mcqAnswers.forEach((ans, idx) => {
        if (idx < nextKey.length) {
          nextKey[idx] = ans;
        }
      });

      return {
        ...prev,
        questionsByExamId: {...prev.questionsByExamId, [examId]: renumbered},
        answerKeysByExamId: {...prev.answerKeysByExamId, [examId]: nextKey},
      };
    });
    return true;
  }

  public duplicateQuestion(questionIndex: number): BuilderQuestionView | null {
    const existing = this.getQuestions()[questionIndex];
    if (!existing) {
      return null;
    }
    return this.addQuestion(
      existing.text,
      [...existing.choices] as [string, string, string, string],
      existing.answer,
      {
        kind: existing.kind ?? 'mcq',
        maxPoints: existing.maxPoints,
        rubric: existing.rubric,
      },
    );
  }

  public deleteQuestion(questionIndex: number): void {
    const examId = this.getState().selectedExamId;
    this.setState(prev => {
      const oldList = prev.questionsByExamId[examId] ?? [];
      const removed = oldList[questionIndex];
      const nextList = oldList
        .filter((_, idx) => idx !== questionIndex)
        .map((q, idx) => ({...q, num: idx + 1}));

      if (removed?.kind === 'essay') {
        return {
          ...prev,
          questionsByExamId: {...prev.questionsByExamId, [examId]: nextList},
        };
      }

      const removedMcqIdx = oldList
        .slice(0, questionIndex)
        .filter(q => q.kind !== 'essay').length;
      const prevKey = [...(prev.answerKeysByExamId[examId] ?? [])];
      if (removedMcqIdx < prevKey.length && prevKey.length > 1) {
        prevKey.splice(removedMcqIdx, 1);
      }

      const nextItemCount = Math.max(1, prevKey.length);
      const targetExam = prev.exams.find(e => e.id === examId);
      const paperSize = targetExam?.paperSize ?? 'A4';

      return {
        ...prev,
        exams: prev.exams.map(e =>
          e.id === examId ? {...e, items: nextItemCount} : e,
        ),
        questionsByExamId: {...prev.questionsByExamId, [examId]: nextList},
        answerKeysByExamId: {...prev.answerKeysByExamId, [examId]: prevKey},
        overlaysByExamId: {
          ...prev.overlaysByExamId,
          [examId]: createOverlaySpec(examId, paperSize, nextItemCount),
        },
      };
    });
  }

  public syncItemCountToQuestions(): number {
    const examId = this.getState().selectedExamId;
    const mcqQuestions = this.getMcqQuestions(examId);
    if (mcqQuestions.length === 0) {
      return this.getAnswerKey(examId).length;
    }

    const syncedKey = mcqQuestions.map(q => q.answer);
    const exam = this.getSelectedExam();
    this.setState(prev => ({
      ...prev,
      exams: prev.exams.map(e =>
        e.id === examId ? {...e, items: syncedKey.length} : e,
      ),
      answerKeysByExamId: {
        ...prev.answerKeysByExamId,
        [examId]: syncedKey,
      },
      overlaysByExamId: {
        ...prev.overlaysByExamId,
        [examId]: createOverlaySpec(examId, exam.paperSize, syncedKey.length),
      },
    }));
    return syncedKey.length;
  }

  public importQuestionsFromLines(rawText: string): number {
    const lines = rawText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    let added = 0;

    for (const line of lines) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 6) {
        const keyCandidate = parts[5].toUpperCase() as BubbleChoice;
        const answer: BubbleChoice = BUBBLE_CHOICES.includes(keyCandidate)
          ? keyCandidate
          : 'A';
        this.addQuestion(
          parts[0],
          [parts[1], parts[2], parts[3], parts[4]],
          answer,
        );
        added += 1;
      }
    }
    return added;
  }

  public setQuestionAnswer(questionIndex: number, answer: BubbleChoice): void {
    const examId = this.getState().selectedExamId;
    this.setState(prev => {
      const list = prev.questionsByExamId[examId] ?? [];
      if (list[questionIndex]?.kind === 'essay') {
        return prev;
      }
      const updated = list.map((q, idx) =>
        idx === questionIndex ? {...q, answer} : q,
      );
      const mcqIndex = list
        .slice(0, questionIndex)
        .filter(q => q.kind !== 'essay').length;
      const prevKey = [...(prev.answerKeysByExamId[examId] ?? [])];
      if (mcqIndex < prevKey.length) {
        prevKey[mcqIndex] = answer;
      }
      return {
        ...prev,
        questionsByExamId: {...prev.questionsByExamId, [examId]: updated},
        answerKeysByExamId: {...prev.answerKeysByExamId, [examId]: prevKey},
      };
    });
  }

  public cycleQuestionAnswer(questionIndex: number): BubbleChoice {
    const current = this.getQuestions()[questionIndex];
    const nextIdx = (BUBBLE_CHOICES.indexOf(current.answer) + 1) % 4;
    const nextChoice = BUBBLE_CHOICES[nextIdx];
    this.setQuestionAnswer(questionIndex, nextChoice);
    return nextChoice;
  }

  public cycleAnswerKeyTile(tileIndex: number): BubbleChoice {
    const examId = this.getState().selectedExamId;
    const current = this.getAnswerKey(examId)[tileIndex];
    const nextIdx = (BUBBLE_CHOICES.indexOf(current) + 1) % 4;
    const nextChoice = BUBBLE_CHOICES[nextIdx];

    this.setState(prev => {
      const updatedKey = [...(prev.answerKeysByExamId[examId] ?? [])];
      updatedKey[tileIndex] = nextChoice;
      let mcqSeen = 0;
      const updatedQuestions = (prev.questionsByExamId[examId] ?? []).map(q => {
        if (q.kind === 'essay') {
          return q;
        }
        const matched = mcqSeen === tileIndex;
        mcqSeen += 1;
        return matched ? {...q, answer: nextChoice} : q;
      });
      return {
        ...prev,
        answerKeysByExamId: {...prev.answerKeysByExamId, [examId]: updatedKey},
        questionsByExamId: {
          ...prev.questionsByExamId,
          [examId]: updatedQuestions,
        },
      };
    });
    return nextChoice;
  }

  public adjustAnswerKeyLength(delta: number): number {
    const examId = this.getState().selectedExamId;
    const current = this.getAnswerKey(examId);
    const nextLen = Math.max(1, Math.min(60, current.length + delta));
    const exam = this.getSelectedExam();

    this.setState(prev => {
      const prevKey = prev.answerKeysByExamId[examId] ?? [];
      const nextKey =
        nextLen > prevKey.length
          ? [...prevKey, ...buildDefaultKey(nextLen - prevKey.length)]
          : prevKey.slice(0, nextLen);

      return {
        ...prev,
        answerKeysByExamId: {...prev.answerKeysByExamId, [examId]: nextKey},
        exams: prev.exams.map(e =>
          e.id === examId ? {...e, items: nextLen} : e,
        ),
        overlaysByExamId: {
          ...prev.overlaysByExamId,
          [examId]: createOverlaySpec(examId, exam.paperSize, nextLen),
        },
      };
    });
    return nextLen;
  }

  public setPointsPerItem(points: PointWeight): void {
    const examId = this.getState().selectedExamId;
    this.setState(prev => ({
      ...prev,
      pointsByExamId: {...prev.pointsByExamId, [examId]: points},
    }));
  }

  public saveAssignments(
    examId: string,
    assignments: GeneratedSheetAssignment[],
  ): void {
    this.setState(prev => ({
      ...prev,
      assignmentsByExamId: {
        ...prev.assignmentsByExamId,
        [examId]: assignments,
      },
    }));
  }

  public renameSection(previousLabel: string, nextLabel: string): void {
    const prevKey = previousLabel.trim().toLowerCase();
    const cleanNext = nextLabel.trim();
    if (!prevKey || !cleanNext || prevKey === cleanNext.toLowerCase()) {
      return;
    }
    this.setState(prev => ({
      ...prev,
      exams: prev.exams.map(e =>
        e.section.trim().toLowerCase() === prevKey
          ? {...e, section: cleanNext}
          : e,
      ),
    }));
  }

  public recordScanFlagged(examId: string): void {
    this.setState(prev => ({
      ...prev,
      exams: prev.exams.map(e =>
        e.id === examId
          ? {...e, needsReviewCount: e.needsReviewCount + 1}
          : e,
      ),
    }));
  }

  public recordScanConfirmed(
    examId: string,
    alreadyConfirmed = false,
  ): void {
    this.setState(prev => ({
      ...prev,
      exams: prev.exams.map(e => {
        if (e.id !== examId) {
          return e;
        }
        const nextScanned = alreadyConfirmed
          ? e.scanned
          : Math.min(e.total, e.scanned + (e.scanned < e.total ? 1 : 0));
        return {
          ...e,
          scanned: nextScanned,
          needsReviewCount: Math.max(0, e.needsReviewCount - 1),
        };
      }),
    }));
  }

  public resetToEmptyWorkspace(): void {
    this.setState({
      exams: [],
      selectedExamId: '',
      activeFilter: 'All',
      questionsByExamId: {},
      answerKeysByExamId: {},
      pointsByExamId: {},
      assignmentsByExamId: {},
      overlaysByExamId: {},
    });
  }

  public resetAllData(): void {
    this.setState(buildInitialState());
  }

  public restoreState(snapshot: ExamState): void {
    // Ensure legacy snapshots without paperSize or overlays get safe defaults
    const normalizedExams = snapshot.exams.map(e => ({
      ...e,
      paperSize: e.paperSize ?? ('A4' as PaperSize),
    }));
    const overlays = snapshot.overlaysByExamId ?? {};
    normalizedExams.forEach(e => {
      if (!overlays[e.id]) {
        overlays[e.id] = createOverlaySpec(e.id, e.paperSize, e.items);
      }
    });
    this.setState({
      ...snapshot,
      exams: normalizedExams,
      overlaysByExamId: overlays,
    });
  }
}
