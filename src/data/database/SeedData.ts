import {
  BubbleChoice,
  OmrSensitivity,
  PaperSize,
  PointWeight,
} from '@core/types/common';
import {Colors} from '@theme/colors';

export interface TeacherProfileView {
  name: string;
  initials: string;
  role: string;
  school: string;
  email: string;
  deviceId: string;
}

export interface DeviceSettingsView {
  autoCapture: boolean;
  flagDoubleShade: boolean;
  autoLocalBackup: boolean;
  lowScoreAlerts: boolean;
  omrSensitivity: OmrSensitivity;
}

export interface ExamCardItem {
  id: string;
  subject: string;
  term: string;
  section: string;
  date: string;
  scanned: number;
  total: number;
  color: string;
  items: number;
  paperSize: PaperSize;
  passingRate: number;
  needsReviewCount: number;
}

export interface StudentRecordView {
  id: string;
  name: string;
  section: string;
  score: number;
  total: number;
  manualScore?: number;
  manualMax?: number;
  manualNote?: string;
  status: string;
}

export interface ClassSectionView {
  id: string;
  grade: string;
  section: string;
  students: number;
  advisor: string;
}

export interface SubjectView {
  id: string;
  name: string;
  code: string;
  sections: string;
  passingRate: number;
  color: string;
}

export type QuestionKind = 'mcq' | 'essay';

export interface BuilderQuestionView {
  num: number;
  kind?: QuestionKind;
  text: string;
  choices: [string, string, string, string];
  answer: BubbleChoice;
  maxPoints?: number;
  rubric?: string;
}

export type OmrFlagReason =
  | 'blank'
  | 'double_shaded'
  | 'half_shaded'
  | 'over_shaded';

export interface ReviewTileView {
  num: number;
  detected: string;
  key: BubbleChoice;
  type: 'correct' | 'wrong' | 'blank' | 'flagged';
  label: string;
  flagReason?: OmrFlagReason;
  fillRatios?: Partial<Record<BubbleChoice, number>>;
  bleedRatios?: Partial<Record<BubbleChoice, number>>;
}

export interface ScanHistoryItemView {
  id: string;
  studentId: string;
  name: string;
  meta: string;
  status: string;
  color: string;
}

export type AlertCategory =
  | 'scan'
  | 'score'
  | 'exam'
  | 'roster'
  | 'backup'
  | 'security';

export interface DeviceAlertView {
  id: string;
  title: string;
  detail?: string;
  time: string;
  unread: boolean;
  category?: AlertCategory;
  targetRoute?: string;
  targetExamId?: string;
  targetStudentId?: string;
}

export interface ExportHistoryView {
  id: string;
  fileName: string;
  date: string;
}

export interface BackupStatusView {
  databaseSizeLabel: string;
  lastBackupLabel: string;
}

export const INITIAL_TEACHER: TeacherProfileView = {
  name: 'Elena Reyes',
  initials: 'ER',
  role: 'Mathematics & Science Teacher',
  school: 'Calapan National High School',
  email: 'elena.reyes@school.local',
  deviceId: 'Pixel 7a · SQLite v3.45',
};

export const INITIAL_SETTINGS: DeviceSettingsView = {
  autoCapture: true,
  flagDoubleShade: true,
  autoLocalBackup: true,
  lowScoreAlerts: true,
  omrSensitivity: 'balanced',
};

export const INITIAL_EXAMS: ExamCardItem[] = [
  {
    id: 'ex-math-q1',
    subject: 'Mathematics',
    term: 'Quarterly',
    section: 'Grade 10 Rizal',
    date: 'Nov 24',
    scanned: 38,
    total: 40,
    color: Colors.purple,
    items: 16,
    paperSize: 'A4',
    passingRate: 78,
    needsReviewCount: 2,
  },
  {
    id: 'ex-sci-q3',
    subject: 'Science',
    term: 'Quiz 3',
    section: 'Grade 10 Rizal',
    date: 'Nov 20',
    scanned: 40,
    total: 40,
    color: Colors.lime,
    items: 20,
    paperSize: 'SHORT',
    passingRate: 92,
    needsReviewCount: 0,
  },
  {
    id: 'ex-eng-mid',
    subject: 'English',
    term: 'Midterm',
    section: 'Grade 10 Bonifacio',
    date: 'Nov 28',
    scanned: 0,
    total: 38,
    color: Colors.coral,
    items: 30,
    paperSize: 'LONG',
    passingRate: 81,
    needsReviewCount: 0,
  },
  {
    id: 'ex-math-pre',
    subject: 'Mathematics',
    term: 'Pre-test',
    section: 'Grade 10 Rizal',
    date: 'Nov 12',
    scanned: 40,
    total: 40,
    color: Colors.cyan,
    items: 16,
    paperSize: 'A4',
    passingRate: 85,
    needsReviewCount: 0,
  },
];

export const INITIAL_STUDENTS: StudentRecordView[] = [
  {
    id: '2026-0001',
    name: 'Juan Dela Cruz',
    section: 'Grade 10 Rizal',
    score: 38,
    total: 50,
    status: 'Review',
  },
  {
    id: '2026-0002',
    name: 'Maria Santos',
    section: 'Grade 10 Rizal',
    score: 47,
    total: 50,
    status: 'Checked',
  },
  {
    id: '2026-0003',
    name: 'Pedro Reyes',
    section: 'Grade 10 Rizal',
    score: 31,
    total: 50,
    status: 'Failed, retry',
  },
  {
    id: '2026-0004',
    name: 'Ana Villanueva',
    section: 'Grade 10 Bonifacio',
    score: 42,
    total: 50,
    status: 'Saved',
  },
  {
    id: '2026-0005',
    name: 'Luis Garcia',
    section: 'Grade 10 Bonifacio',
    score: 34,
    total: 50,
    status: 'Saved',
  },
  {
    id: '2026-0006',
    name: 'Sofia Mendoza',
    section: 'Grade 10 Rizal',
    score: 45,
    total: 50,
    status: 'Checked',
  },
];

export const INITIAL_CLASSES: ClassSectionView[] = [
  {
    id: 'cls-1',
    grade: 'Grade 10',
    section: 'Rizal',
    students: 40,
    advisor: 'Elena Reyes',
  },
  {
    id: 'cls-2',
    grade: 'Grade 10',
    section: 'Bonifacio',
    students: 38,
    advisor: 'Elena Reyes',
  },
  {
    id: 'cls-3',
    grade: 'Grade 9',
    section: 'Mabini',
    students: 40,
    advisor: 'Marco Dizon',
  },
];

export const INITIAL_SUBJECTS: SubjectView[] = [
  {
    id: 'sub-1',
    name: 'Mathematics',
    code: 'MATH-10',
    sections: '2 sections',
    passingRate: 78,
    color: Colors.purple,
  },
  {
    id: 'sub-2',
    name: 'Science',
    code: 'SCI-10',
    sections: '1 section',
    passingRate: 92,
    color: Colors.lime,
  },
  {
    id: 'sub-3',
    name: 'English',
    code: 'ENG-10',
    sections: '1 section',
    passingRate: 81,
    color: Colors.coral,
  },
];

export const INITIAL_QUESTIONS: BuilderQuestionView[] = [
  {
    num: 1,
    text: 'Solve for x: 2x + 7 = 19',
    choices: ['6', '7', '8', '5'],
    answer: 'A',
  },
  {
    num: 2,
    text: 'What is the slope of y = 3x - 4?',
    choices: ['-4', '1/3', '3', '-3'],
    answer: 'C',
  },
  {
    num: 3,
    text: 'Factor completely: x² - 9',
    choices: ['(x-3)²', '(x-3)(x+3)', '(x+3)²', 'x(x-9)'],
    answer: 'B',
  },
  {
    num: 4,
    text: 'Value of sin(30°) in exact form',
    choices: ['1/2', '√3/2', '1', '√2/2'],
    answer: 'A',
  },
];

export const INITIAL_ANSWER_KEY: BubbleChoice[] = [
  'A', 'C', 'B', 'A',
  'C', 'D', 'A', 'A',
  'B', 'D', 'C', 'A',
  'B', 'C', 'D', 'A',
];

export const INITIAL_POINTS_PER_ITEM: PointWeight = 1;

export const INITIAL_REVIEW_TILES: ReviewTileView[] = [
  {num: 1, detected: 'A', key: 'A', type: 'correct', label: 'A', fillRatios: {A: 0.84, B: 0.08, C: 0.06, D: 0.07}},
  {num: 2, detected: 'B', key: 'C', type: 'wrong', label: 'B → C', fillRatios: {A: 0.07, B: 0.78, C: 0.09, D: 0.06}},
  {num: 3, detected: 'B', key: 'B', type: 'correct', label: 'B', fillRatios: {A: 0.08, B: 0.88, C: 0.05, D: 0.07}},
  {num: 4, detected: 'Blank', key: 'A', type: 'blank', label: 'Blank', fillRatios: {A: 0.11, B: 0.08, C: 0.07, D: 0.09}},
  {num: 5, detected: 'A + C', key: 'C', type: 'flagged', label: 'A + C', fillRatios: {A: 0.56, B: 0.07, C: 0.69, D: 0.08}},
  {num: 6, detected: 'D', key: 'D', type: 'correct', label: 'D', fillRatios: {A: 0.06, B: 0.07, C: 0.08, D: 0.91}},
  {num: 7, detected: 'A', key: 'A', type: 'correct', label: 'A', fillRatios: {A: 0.81, B: 0.09, C: 0.06, D: 0.08}},
  {num: 8, detected: 'D', key: 'A', type: 'wrong', label: 'D → A', fillRatios: {A: 0.08, B: 0.07, C: 0.09, D: 0.76}},
];

export const INITIAL_SCAN_HISTORY: ScanHistoryItemView[] = [
  {
    id: 'scan-1',
    studentId: '2026-0001',
    name: 'Juan Dela Cruz',
    meta: 'Mathematics · 9:41',
    status: 'Review',
    color: Colors.purple,
  },
  {
    id: 'scan-2',
    studentId: '2026-0002',
    name: 'Maria Santos',
    meta: 'Mathematics · 9:38',
    status: 'Checked',
    color: Colors.lime,
  },
  {
    id: 'scan-3',
    studentId: '2026-0003',
    name: 'Pedro Reyes',
    meta: 'Science · 9:30',
    status: 'Failed, retry',
    color: Colors.coral,
  },
  {
    id: 'scan-4',
    studentId: '2026-0004',
    name: 'Ana Villanueva',
    meta: 'Mathematics · 9:27',
    status: 'Saved locally',
    color: '#FFFFFF',
  },
  {
    id: 'scan-5',
    studentId: '2026-0005',
    name: 'Luis Garcia',
    meta: 'Mathematics · 9:24',
    status: 'Saved locally',
    color: '#FFFFFF',
  },
];

export const INITIAL_ALERTS: DeviceAlertView[] = [
  {
    id: 'alert-1',
    title: '2 answers flagged on Juan Dela Cruz',
    detail: 'Items #4 (Blank) and #5 (Double shade) need quick verification.',
    time: '9:41 AM',
    unread: true,
    category: 'scan',
    targetRoute: 'Review',
    targetStudentId: '2026-0001',
    targetExamId: 'ex-math-q1',
  },
  {
    id: 'alert-2',
    title: 'SQLite backup saved to Downloads',
    detail: 'Encrypted local snapshot stored in Downloads/ExamIQ.',
    time: 'Yesterday',
    unread: true,
    category: 'backup',
    targetRoute: 'BackupRestore',
  },
  {
    id: 'alert-3',
    title: 'Science Quiz 3 reached 92% passing',
    detail: 'All 40/40 Grade 10 Rizal answer sheets verified offline.',
    time: 'Nov 20',
    unread: false,
    category: 'score',
    targetRoute: 'Results',
    targetExamId: 'ex-sci-q3',
  },
];

export const INITIAL_EXPORTS: ExportHistoryView[] = [
  {id: 'exp-1', fileName: 'Science_Quiz3_Grades.xlsx', date: 'Nov 20'},
  {id: 'exp-2', fileName: 'Math_Pretest_Summary.pdf', date: 'Nov 12'},
];

export const INITIAL_BACKUP_STATUS: BackupStatusView = {
  databaseSizeLabel: '14.8 MB',
  lastBackupLabel: 'Yesterday, 4:15 PM',
};
