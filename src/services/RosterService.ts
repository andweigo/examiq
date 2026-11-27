import {ObservableStore} from '@core/base/ObservableStore';
import {
  ClassSectionView,
  INITIAL_CLASSES,
  INITIAL_STUDENTS,
  INITIAL_SUBJECTS,
  StudentRecordView,
  SubjectView,
} from '@data/database/SeedData';
import {Colors} from '@theme/colors';
import {IdGenerator} from '@utils/IdGenerator';

export interface RosterState {
  readonly students: StudentRecordView[];
  readonly classes: ClassSectionView[];
  readonly subjects: SubjectView[];
  readonly selectedGenStudentId: string;
}

const SUBJECT_COLOR_CYCLE = [
  Colors.purple,
  Colors.lime,
  Colors.coral,
  Colors.cyan,
];

const EMPTY_STUDENT_PLACEHOLDER: StudentRecordView = {
  id: 'UNASSIGNED',
  name: 'No student yet',
  section: 'Unassigned',
  score: 0,
  total: 10,
  status: 'Pending',
};

/**
 * OOP Application Service for Students, Classes/Sections, and Subjects.
 */
export class RosterService extends ObservableStore<RosterState> {
  constructor() {
    super({
      students: INITIAL_STUDENTS.map(s => ({...s})),
      classes: INITIAL_CLASSES.map(c => ({...c})),
      subjects: INITIAL_SUBJECTS.map(s => ({...s})),
      selectedGenStudentId: INITIAL_STUDENTS[0].id,
    });
  }

  public getStudentsForSection(sectionLabel?: string): StudentRecordView[] {
    const {students} = this.getState();
    if (!sectionLabel) {
      return students;
    }
    const normalized = sectionLabel.trim().toLowerCase();
    return students.filter(
      s => s.section.trim().toLowerCase() === normalized,
    );
  }

  public getSelectedGeneratorStudent(sectionLabel?: string): StudentRecordView {
    const state = this.getState();
    const pool = this.getStudentsForSection(sectionLabel);
    return (
      pool.find(s => s.id === state.selectedGenStudentId) ??
      pool[0] ??
      state.students[0] ??
      EMPTY_STUDENT_PLACEHOLDER
    );
  }

  public selectGeneratorStudent(studentId: string): void {
    this.setState(prev => ({...prev, selectedGenStudentId: studentId}));
  }

  public updateStudentScore(
    studentId: string,
    delta: number,
    status?: string,
  ): void {
    this.setState(prev => ({
      ...prev,
      students: prev.students.map(s =>
        s.id === studentId
          ? {
              ...s,
              score: Math.min(s.total, Math.max(0, s.score + delta)),
              status: status ?? s.status,
            }
          : s,
      ),
    }));
  }

  public setStudentScore(
    studentId: string,
    score: number,
    total: number,
    status?: string,
  ): void {
    this.setState(prev => ({
      ...prev,
      students: prev.students.map(s =>
        s.id === studentId
          ? {
              ...s,
              score: Math.min(total, Math.max(0, score)),
              total,
              status: status ?? s.status,
            }
          : s,
      ),
    }));
  }

  /**
   * Records a teacher's manual assessment (e.g. Essay / constructed-response points)
   * separately from the system-checked OMR multiple-choice score.
   */
  public setStudentManualScore(
    studentId: string,
    manualScore: number,
    manualMax: number,
    manualNote?: string,
  ): void {
    const safeMax = Math.max(0, Math.round(manualMax));
    const safeScore = Math.min(safeMax, Math.max(0, Math.round(manualScore)));
    this.setState(prev => ({
      ...prev,
      students: prev.students.map(s =>
        s.id === studentId
          ? {
              ...s,
              manualScore: safeScore,
              manualMax: safeMax,
              manualNote: manualNote?.trim() || undefined,
            }
          : s,
      ),
    }));
  }

  public isStudentIdTaken(candidateId: string, ignoreId?: string): boolean {
    const clean = candidateId.trim().toLowerCase();
    if (!clean) {
      return false;
    }
    return this.getState().students.some(
      s =>
        s.id.toLowerCase() === clean &&
        (!ignoreId || s.id.toLowerCase() !== ignoreId.trim().toLowerCase()),
    );
  }

  public updateStudentRecord(
    studentId: string,
    name: string,
    section: string,
    nextStudentId?: string,
  ): void {
    const cleanNewId = nextStudentId?.trim();
    const targetId =
      cleanNewId && !this.isStudentIdTaken(cleanNewId, studentId)
        ? cleanNewId
        : studentId;

    this.setState(prev => {
      const existing = prev.students.find(s => s.id === studentId);
      const nextSection = section.trim() || existing?.section || 'Grade 10 Rizal';
      const movedSection =
        existing &&
        existing.section.toLowerCase() !== nextSection.toLowerCase();

      const nextClasses = movedSection
        ? prev.classes.map(c => {
            const label = `${c.grade} ${c.section}`.toLowerCase();
            if (label === existing.section.toLowerCase()) {
              return {...c, students: Math.max(0, c.students - 1)};
            }
            if (label === nextSection.toLowerCase()) {
              return {...c, students: c.students + 1};
            }
            return c;
          })
        : prev.classes;

      return {
        ...prev,
        students: prev.students.map(s =>
          s.id === studentId
            ? {
                ...s,
                id: targetId,
                name: name.trim() || s.name,
                section: nextSection,
              }
            : s,
        ),
        classes: nextClasses,
        selectedGenStudentId:
          prev.selectedGenStudentId === studentId
            ? targetId
            : prev.selectedGenStudentId,
      };
    });
  }

  public deleteStudent(studentId: string): void {
    this.setState(prev => {
      const removed = prev.students.find(s => s.id === studentId);
      const nextStudents = prev.students.filter(s => s.id !== studentId);
      const nextSelected =
        prev.selectedGenStudentId === studentId
          ? nextStudents[0]?.id ?? ''
          : prev.selectedGenStudentId;
      const nextClasses = removed
        ? prev.classes.map(c =>
            `${c.grade} ${c.section}`.toLowerCase() ===
            removed.section.toLowerCase()
              ? {...c, students: Math.max(0, c.students - 1)}
              : c,
          )
        : prev.classes;
      return {
        ...prev,
        students: nextStudents,
        classes: nextClasses,
        selectedGenStudentId: nextSelected,
      };
    });
  }

  public addStudent(
    name: string,
    section: string,
    customStudentId?: string,
  ): StudentRecordView {
    const existingIds = new Set(
      this.getState().students.map(s => s.id.toLowerCase()),
    );
    let resolvedId = customStudentId?.trim() ?? '';
    const currentYear = new Date().getFullYear();
    if (!resolvedId || existingIds.has(resolvedId.toLowerCase())) {
      let seq = this.getState().students.length + 1;
      resolvedId = IdGenerator.nextStudentCode(currentYear, seq);
      while (existingIds.has(resolvedId.toLowerCase())) {
        seq += 1;
        resolvedId = IdGenerator.nextStudentCode(currentYear, seq);
      }
    }

    const firstClass = this.getState().classes[0];
    const fallbackSection = firstClass
      ? `${firstClass.grade} ${firstClass.section}`
      : 'Unassigned';

    const student: StudentRecordView = {
      id: resolvedId,
      name: name.trim(),
      section: section.trim() || fallbackSection,
      score: 0,
      total: 50,
      status: 'Pending',
    };
    this.setState(prev => ({
      ...prev,
      students: [...prev.students, student],
      classes: prev.classes.map(c =>
        `${c.grade} ${c.section}`.toLowerCase() ===
        student.section.toLowerCase()
          ? {...c, students: c.students + 1}
          : c,
      ),
    }));
    return student;
  }

  public importStudentsFromCsv(csvText: string, defaultSection: string): number {
    const lines = csvText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    const parsed: Array<{studentId: string; name: string; section: string}> = [];
    for (const line of lines) {
      if (line.toLowerCase().startsWith('name,')) {
        continue;
      }
      const [namePart, sectionPart] = line.split(',').map(p => p.trim());
      if (namePart) {
        parsed.push({
          studentId: '',
          name: namePart,
          section: sectionPart || defaultSection,
        });
      }
    }
    return this.importParsedStudents(parsed, defaultSection).addedCount;
  }

  /**
   * Imports structured student rows from native Excel (.xlsx) or CSV files
   * with duplicate ID protection and automatic Grade/Section creation.
   */
  public importParsedStudents(
    rows: ReadonlyArray<{studentId: string; name: string; section: string}>,
    defaultSection: string,
    defaultAdvisor = 'Class Advisor',
  ): {addedCount: number; skippedDuplicates: number; createdSections: number} {
    let addedCount = 0;
    let skippedDuplicates = 0;
    let createdSections = 0;

    const existingIds = new Set(
      this.getState().students.map(s => s.id.toLowerCase()),
    );
    const existingNames = new Set(
      this.getState().students.map(
        s => `${s.name.toLowerCase()}|${s.section.toLowerCase()}`,
      ),
    );
    const knownSectionLabels = new Set(
      this.getState().classes.map(c => `${c.grade} ${c.section}`.toLowerCase()),
    );

    const newStudents: StudentRecordView[] = [];
    const newClasses: ClassSectionView[] = [];
    const currentYear = new Date().getFullYear();
    let seq = this.getState().students.length + 1;
    const firstClass = this.getState().classes[0];
    const fallbackSection = firstClass
      ? `${firstClass.grade} ${firstClass.section}`
      : 'Unassigned';

    for (const row of rows) {
      const cleanName = row.name.trim();
      if (!cleanName) {
        continue;
      }
      const cleanSection = row.section.trim() || defaultSection || fallbackSection;
      let candidateId = row.studentId.trim();
      if (!candidateId) {
        candidateId = IdGenerator.nextStudentCode(currentYear, seq);
        while (existingIds.has(candidateId.toLowerCase())) {
          seq += 1;
          candidateId = IdGenerator.nextStudentCode(currentYear, seq);
        }
      }

      if (
        existingIds.has(candidateId.toLowerCase()) ||
        existingNames.has(`${cleanName.toLowerCase()}|${cleanSection.toLowerCase()}`)
      ) {
        skippedDuplicates += 1;
        continue;
      }

      existingIds.add(candidateId.toLowerCase());
      existingNames.add(`${cleanName.toLowerCase()}|${cleanSection.toLowerCase()}`);
      seq += 1;

      if (!knownSectionLabels.has(cleanSection.toLowerCase())) {
        knownSectionLabels.add(cleanSection.toLowerCase());
        const match = cleanSection.match(/^(Grade\s*\d+)\s+(.+)$/i);
        newClasses.push({
          id: IdGenerator.nextPrefixedId('cls'),
          grade: match ? match[1] : 'Grade 10',
          section: match ? match[2] : cleanSection,
          students: 0,
          advisor: defaultAdvisor,
        });
        createdSections += 1;
      }

      newStudents.push({
        id: candidateId,
        name: cleanName,
        section: cleanSection,
        score: 0,
        total: 50,
        status: 'Pending',
      });
      addedCount += 1;
    }

    if (newStudents.length > 0 || newClasses.length > 0) {
      this.setState(prev => {
        const mergedClasses = [...prev.classes, ...newClasses].map(c => {
          const label = `${c.grade} ${c.section}`.toLowerCase();
          const addedInSection = newStudents.filter(
            s => s.section.toLowerCase() === label,
          ).length;
          return addedInSection > 0
            ? {...c, students: c.students + addedInSection}
            : c;
        });

        return {
          ...prev,
          students: [...prev.students, ...newStudents],
          classes: mergedClasses,
        };
      });
    }

    return {addedCount, skippedDuplicates, createdSections};
  }

  public reassignDefaultAdvisor(newAdvisorName: string): void {
    const clean = newAdvisorName.trim();
    if (!clean) {
      return;
    }
    this.setState(prev => ({
      ...prev,
      classes: prev.classes.map(c =>
        c.advisor === 'Elena Reyes' ? {...c, advisor: clean} : c,
      ),
    }));
  }

  public resetToEmptyWorkspace(): void {
    this.setState({
      students: [],
      classes: [],
      subjects: [],
      selectedGenStudentId: '',
    });
  }

  public resetAllData(): void {
    this.setState({
      students: INITIAL_STUDENTS.map(s => ({...s})),
      classes: INITIAL_CLASSES.map(c => ({...c})),
      subjects: INITIAL_SUBJECTS.map(s => ({...s})),
      selectedGenStudentId: INITIAL_STUDENTS[0].id,
    });
  }

  public addClassSection(
    grade: string,
    section: string,
    advisor: string,
  ): ClassSectionView {
    const entry: ClassSectionView = {
      id: IdGenerator.nextPrefixedId('cls'),
      grade: grade.trim() || 'Grade 10',
      section: section.trim() || 'New Section',
      students: 0,
      advisor: advisor.trim() || 'Class Advisor',
    };
    this.setState(prev => ({...prev, classes: [...prev.classes, entry]}));
    return entry;
  }

  public updateClassSection(
    classId: string,
    grade: string,
    section: string,
    advisor: string,
  ): {previousLabel: string; nextLabel: string} | null {
    const existing = this.getState().classes.find(c => c.id === classId);
    if (!existing) {
      return null;
    }
    const nextGrade = grade.trim() || existing.grade;
    const nextSection = section.trim() || existing.section;
    const nextAdvisor = advisor.trim() || existing.advisor;
    const previousLabel = `${existing.grade} ${existing.section}`.trim();
    const nextLabel = `${nextGrade} ${nextSection}`.trim();
    const sectionRenamed =
      previousLabel.toLowerCase() !== nextLabel.toLowerCase();

    this.setState(prev => ({
      ...prev,
      classes: prev.classes.map(c =>
        c.id === classId
          ? {
              ...c,
              grade: nextGrade,
              section: nextSection,
              advisor: nextAdvisor,
            }
          : c,
      ),
      students: sectionRenamed
        ? prev.students.map(s =>
            s.section.trim().toLowerCase() === previousLabel.toLowerCase()
              ? {...s, section: nextLabel}
              : s,
          )
        : prev.students,
    }));

    return {previousLabel, nextLabel};
  }

  public deleteClassSection(classId: string): void {
    this.setState(prev => ({
      ...prev,
      classes: prev.classes.filter(c => c.id !== classId),
    }));
  }

  public addSubject(
    name: string,
    code: string,
    sections: string,
    color?: string,
  ): SubjectView {
    const resolvedColor =
      color ??
      SUBJECT_COLOR_CYCLE[
        this.getState().subjects.length % SUBJECT_COLOR_CYCLE.length
      ];
    const entry: SubjectView = {
      id: IdGenerator.nextPrefixedId('sub'),
      name: name.trim(),
      code: code.trim().toUpperCase(),
      sections: sections.trim() || '1 section',
      passingRate: 0,
      color: resolvedColor,
    };
    this.setState(prev => ({...prev, subjects: [...prev.subjects, entry]}));
    return entry;
  }

  public updateSubject(
    subjectId: string,
    name: string,
    code: string,
    sections: string,
    color: string,
  ): void {
    this.setState(prev => ({
      ...prev,
      subjects: prev.subjects.map(s =>
        s.id === subjectId
          ? {
              ...s,
              name: name.trim() || s.name,
              code: code.trim().toUpperCase() || s.code,
              sections: sections.trim() || s.sections,
              color: color || s.color,
            }
          : s,
      ),
    }));
  }

  public deleteSubject(subjectId: string): void {
    this.setState(prev => ({
      ...prev,
      subjects: prev.subjects.filter(s => s.id !== subjectId),
    }));
  }

  public getTotalStudentRecordsCount(): number {
    return this.getState().students.length;
  }

  public restoreState(snapshot: RosterState): void {
    this.setState(snapshot);
  }
}
