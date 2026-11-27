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
  readonly yearLevel: string;
  readonly sectionName: string;
  readonly passingRate: number;
  readonly passedCount: number;
  readonly totalStudents: number;
}

export interface YearPassingSummary {
  readonly yearLevel: string;
  readonly sectionCount: number;
  readonly passingRate: number;
  readonly passedCount: number;
  readonly totalStudents: number;
}

export type ResultsGroupMode = 'section' | 'subject' | 'year';

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

  public static extractYearLevel(
    rawSection: string,
    classes: readonly ClassSectionView[] = [],
  ): string {
    const clean = rawSection.trim();
    if (!clean) {
      return 'Unassigned';
    }
    const lower = clean.toLowerCase();
    const matchedClass = classes.find(
      c => `${c.grade} ${c.section}`.trim().toLowerCase() === lower,
    );
    if (matchedClass?.grade?.trim()) {
      return matchedClass.grade.trim();
    }
    const match = clean.match(
      /^(Grade\s+\d+|Year\s+\d+|\d+(?:st|nd|rd|th)\s+Year|G\d+|BS[A-Z]+\s+\d+)/i,
    );
    if (match) {
      return match[1].trim();
    }
    const parts = clean.split(/\s+/);
    return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0];
  }

  public static extractSectionName(
    rawSection: string,
    classes: readonly ClassSectionView[] = [],
  ): string {
    const clean = rawSection.trim();
    if (!clean) {
      return 'General';
    }
    const lower = clean.toLowerCase();
    const matchedClass = classes.find(
      c => `${c.grade} ${c.section}`.trim().toLowerCase() === lower,
    );
    if (matchedClass?.section?.trim()) {
      return matchedClass.section.trim();
    }
    const yearLevel = DashboardSorter.extractYearLevel(clean, classes);
    if (clean.toLowerCase().startsWith(yearLevel.toLowerCase())) {
      const rest = clean.slice(yearLevel.length).replace(/^[\s\-·:]+/, '').trim();
      if (rest) {
        return rest;
      }
    }
    return clean;
  }

  public static sortYearLevels(
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
    classes.forEach(c => add(c.grade));
    exams.forEach(e => add(DashboardSorter.extractYearLevel(e.section, classes)));
    students.forEach(s =>
      add(DashboardSorter.extractYearLevel(s.section, classes)),
    );
    return Array.from(seen.values()).sort(DashboardSorter.compareNatural);
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
          inSection.map(s => ({
            earnedPoints: s.score + (s.manualScore ?? 0),
            maxPoints: s.total + (s.manualMax ?? 0),
          })),
        );
        return {
          section,
          yearLevel: DashboardSorter.extractYearLevel(section, classes),
          sectionName: DashboardSorter.extractSectionName(section, classes),
          passingRate: summary.passingRate,
          passedCount: summary.passedCount,
          totalStudents: summary.totalStudents,
        };
      })
      .filter(row => row.totalStudents > 0);
  }

  public static summarizeByYear(
    students: readonly StudentRecordView[],
    classes: readonly ClassSectionView[],
    exams: readonly ExamCardItem[],
  ): YearPassingSummary[] {
    const years = DashboardSorter.sortYearLevels(classes, exams, students);
    return years
      .map(yearLevel => {
        const key = yearLevel.toLowerCase();
        const inYear = students.filter(
          s =>
            DashboardSorter.extractYearLevel(s.section, classes).toLowerCase() ===
            key,
        );
        const uniqueSections = new Set(
          inYear.map(s => s.section.trim().toLowerCase()),
        );
        const summary = ScoreCalculator.summarizeClass(
          inYear.map(s => ({
            earnedPoints: s.score + (s.manualScore ?? 0),
            maxPoints: s.total + (s.manualMax ?? 0),
          })),
        );
        return {
          yearLevel,
          sectionCount: uniqueSections.size,
          passingRate: summary.passingRate,
          passedCount: summary.passedCount,
          totalStudents: summary.totalStudents,
        };
      })
      .filter(row => row.totalStudents > 0);
  }
}
