import {
  ClassSectionView,
  ExamCardItem,
  StudentRecordView,
  SubjectView,
} from '@data/database/SeedData';
import {ScoreCalculator} from '@utils/ScoreCalculator';

export type DashboardSortMode = 'section' | 'subject' | 'progress';

export interface ExamGroup {
  readonly groupKey: string;
  readonly label: string;
  readonly exams: ExamCardItem[];
}

export interface SectionPassingSummary {
  readonly section: string;
  readonly passingRate: number;
  readonly passedCount: number;
  readonly totalStudents: number;
}

/**
 * Pure domain utility for natural sorting & grouping of classes, sections,
 * subjects, and exams on the Teacher Dashboard.
 */
export class DashboardSorter {
  /**
   * Natural alphanumeric comparator so "Grade 9" comes before "Grade 10 Bonifacio",
   * which comes before "Grade 10 Rizal" and "Grade 11 Newton".
   */
  public static compareNatural(a: string, b: string): number {
    return a
      .trim()
      .localeCompare(b.trim(), undefined, {numeric: true, sensitivity: 'base'});
  }

  public static sortSections(
    classes: readonly ClassSectionView[],
    exams: readonly ExamCardItem[],
    students: readonly StudentRecordView[],
  ): string[] {
    const seen = new Map<string, string>();
    const add = (raw: string) => {
      const clean = raw.trim();
      if (!clean) {
        return;
      }
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, clean);
      }
    };

    classes.forEach(c => add(`${c.grade} ${c.section}`));
    exams.forEach(e => add(e.section));
    students.forEach(s => add(s.section));

    return Array.from(seen.values()).sort(DashboardSorter.compareNatural);
  }

  public static sortSubjectNames(
    subjects: readonly SubjectView[],
    exams: readonly ExamCardItem[],
  ): string[] {
    const seen = new Map<string, string>();
    const add = (raw: string) => {
      const clean = raw.trim();
      if (!clean) {
        return;
      }
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, clean);
      }
    };

    subjects.forEach(s => add(s.name));
    exams.forEach(e => add(e.subject));

    return Array.from(seen.values()).sort(DashboardSorter.compareNatural);
  }

  public static sortSubjects(subjects: readonly SubjectView[]): SubjectView[] {
    return [...subjects].sort((a, b) =>
      DashboardSorter.compareNatural(a.name, b.name),
    );
  }

  public static sortExams(
    exams: readonly ExamCardItem[],
    mode: DashboardSortMode,
  ): ExamCardItem[] {
    return [...exams].sort((a, b) => {
      if (mode === 'subject') {
        const subCmp = DashboardSorter.compareNatural(a.subject, b.subject);
        if (subCmp !== 0) {
          return subCmp;
        }
        const secCmp = DashboardSorter.compareNatural(a.section, b.section);
        if (secCmp !== 0) {
          return secCmp;
        }
        return DashboardSorter.compareNatural(a.term, b.term);
      }

      if (mode === 'progress') {
        // Urgent first: flagged items -> most remaining unscanned -> natural section order
        if (b.needsReviewCount !== a.needsReviewCount) {
          return b.needsReviewCount - a.needsReviewCount;
        }
        const remA = Math.max(0, a.total - a.scanned);
        const remB = Math.max(0, b.total - b.scanned);
        if (remB !== remA) {
          return remB - remA;
        }
        const secCmp = DashboardSorter.compareNatural(a.section, b.section);
        if (secCmp !== 0) {
          return secCmp;
        }
        return DashboardSorter.compareNatural(a.subject, b.subject);
      }

      // Default: 'section' (natural Grade & Section -> Subject -> Term)
      const secCmp = DashboardSorter.compareNatural(a.section, b.section);
      if (secCmp !== 0) {
        return secCmp;
      }
      const subCmp = DashboardSorter.compareNatural(a.subject, b.subject);
      if (subCmp !== 0) {
        return subCmp;
      }
      return DashboardSorter.compareNatural(a.term, b.term);
    });
  }

  public static groupExams(
    exams: readonly ExamCardItem[],
    mode: DashboardSortMode,
  ): ExamGroup[] {
    const sorted = DashboardSorter.sortExams(exams, mode);
    if (sorted.length === 0) {
      return [];
    }

    if (mode === 'progress') {
      return [{groupKey: 'urgent', label: 'Sorted by urgency', exams: sorted}];
    }

    const groups: ExamGroup[] = [];
    const byKey = new Map<string, ExamGroup>();

    for (const exam of sorted) {
      const label =
        mode === 'subject'
          ? exam.subject.trim() || 'General'
          : exam.section.trim() || 'Unassigned section';
      const key = label.toLowerCase();
      const existing = byKey.get(key);
      if (existing) {
        existing.exams.push(exam);
      } else {
        const next: ExamGroup = {groupKey: key, label, exams: [exam]};
        byKey.set(key, next);
        groups.push(next);
      }
    }

    return groups;
  }

  public static summarizeBySection(
    students: readonly StudentRecordView[],
    classes: readonly ClassSectionView[],
    exams: readonly ExamCardItem[],
  ): SectionPassingSummary[] {
    const sections = DashboardSorter.sortSections(classes, exams, students);
    return sections
      .map(section => {
        const key = section.toLowerCase();
        const inSection = students.filter(
          s => s.section.trim().toLowerCase() === key,
        );
        const summary = ScoreCalculator.summarizeClass(
          inSection.map(s => ({earnedPoints: s.score, maxPoints: s.total})),
        );
        return {
          section,
          passingRate: summary.passingRate,
          passedCount: summary.passedCount,
          totalStudents: summary.totalStudents,
        };
      })
      .filter(row => row.totalStudents > 0);
  }
}
