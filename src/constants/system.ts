import {DEFAULT_PASSING_PERCENTAGE} from '@constants/grading';
import {OMR_TEMPLATE_VERSION} from '@constants/omr';

export interface SystemMetadata {
  readonly appName: string;
  readonly tagline: string;
  readonly version: string;
  readonly buildNumber: number;
  readonly packageId: string;
  readonly developer: string;
  readonly architecture: string;
  readonly omrTemplate: string;
  readonly paperSupport: string;
  readonly networkMode: string;
}

export const SYSTEM_INFO: SystemMetadata = {
  appName: 'ExamIQ',
  tagline: 'Offline OMR & Exam Management System',
  version: '1.0.0',
  buildNumber: 1,
  packageId: 'com.examiq.app',
  developer: 'Andrei Obligar',
  architecture: '100% Offline-First · Local SQLite · Native CameraX & ML Kit',
  omrTemplate: OMR_TEMPLATE_VERSION,
  paperSupport: 'A4 (210×297mm), Short / Letter (8.5×11"), Long / Folio (8.5×13")',
  networkMode: 'Zero-cloud local execution (No internet required)',
};

export interface FormulaGuideItem {
  readonly title: string;
  readonly formula: string;
  readonly explanation: string;
}

export const PASSING_COMPUTATION_GUIDE: readonly FormulaGuideItem[] = [
  {
    title: '1. Individual Score Percentage',
    formula: 'Student % = round((Earned Points ÷ Total Items) × 100, 1)',
    explanation:
      'Each item checked as correct awards its assigned point weight. Percentages are rounded to one decimal place (e.g. 38 ÷ 50 = 76.0%).',
  },
  {
    title: '2. Individual Passing Status',
    formula: `Passed if Student % ≥ ${DEFAULT_PASSING_PERCENTAGE}%`,
    explanation: `Aligned with the Philippine academic standard (${DEFAULT_PASSING_PERCENTAGE}% passing cut-off). Students scoring below ${DEFAULT_PASSING_PERCENTAGE}% are listed under "Students below ${DEFAULT_PASSING_PERCENTAGE}% passing" for quick intervention.`,
  },
  {
    title: '3. Overall Class Passing Rate',
    formula: 'Passing Rate = round((Passed Students ÷ Total Graded Students) × 100)%',
    explanation:
      'Counts every student meeting or exceeding 75%, divides by the total number of students in the class/roster, and rounds to the nearest whole percent.',
  },
  {
    title: '4. Class Mean Score',
    formula: 'Mean Score = round((Sum of Earned Scores ÷ Total Students) × 10) ÷ 10',
    explanation:
      'Computes the arithmetic average of earned points across all students in the active roster (rounded to 1 decimal place).',
  },
  {
    title: '5. OMR Flagged Shading Safeguard',
    formula: 'Blank / Double-Shaded / Half-Shaded / Lagpas → 0 pts until Teacher Verified',
    explanation:
      'To protect grading fairness, irregular shading is never guessed automatically. Flagged items hold 0 points until the teacher inspects the % fill bars and confirms the student’s actual answer.',
  },
];

export interface PolicySection {
  readonly heading: string;
  readonly body: string;
}

/**
 * Philippine Data Privacy Act of 2012 (Republic Act No. 10173) compliant
 * offline privacy notice for teachers, schools, and students.
 */
export const PRIVACY_POLICY_RA10173: readonly PolicySection[] = [
  {
    heading: '1. Data Privacy Act Commitment (RA 10173)',
    body: 'ExamIQ is engineered in strict adherence to the Republic Act No. 10173 (Philippine Data Privacy Act of 2012) and its Implementing Rules and Regulations (IRR), upholding the core principles of Transparency, Legitimate Purpose, and Proportionality.',
  },
  {
    heading: '2. 100% Offline, Local-Only Storage',
    body: 'ExamIQ operates completely offline with zero cloud servers, zero external analytics, zero advertisements, and zero internet data transmission. All teacher profiles, class rosters, optional Student IDs / LRNs, exam papers, answer keys, scores, and scanned sheet photos remain strictly inside this device’s private SQLite database (examiq_offline.db).',
  },
  {
    heading: '3. Personal Information Processed & Legitimate Purpose',
    body: 'Only academic records explicitly entered or imported by the teacher are stored locally: Teacher Name, School, Role, Student Names, Sections, optional Student IDs / LRNs, and exam grading records. Data is processed solely for exam generation, on-device QR/OMR checking, class analytics, and teacher-initiated report exports.',
  },
  {
    heading: '4. Device Permissions (Proportionality)',
    body: '• Camera: Used exclusively for live offline QR identification and OMR sheet capture. Frames are processed locally on-device and never uploaded.\n• File Picker & Downloads Export: Used only when you manually import Excel/CSV student lists, export PDF/CSV reports, or save/restore SQLite (.db) backups to Downloads/ExamIQ.',
  },
  {
    heading: '5. Organizational & Technical Security Safeguards (Sec. 20)',
    body: '• Multi-Teacher Account Isolation: Logging out clears the live workspace and isolates each teacher’s classes, students, and exams inside separate local account vaults.\n• PIN Lock Protection: Optional 4–6 digit hashed device PIN restricts unlocking accounts, changing PINs (current PIN required), and erasing local data, with failed attempts logged in Device Alerts.',
  },
  {
    heading: '6. Data Subject Rights (Sec. 16, RA 10173)',
    body: 'Teachers and schools retain full, immediate control to fulfill Data Subject Rights offline:\n• Right to be Informed: Documented transparently in System Settings.\n• Right to Access & Portability: Export student rosters, grade sheets (.csv), PDF summaries, or full SQLite backups anytime.\n• Right to Rectification: Edit student records and manually verify or override any OMR grade.\n• Right to Erasure / Blocking: Delete individual students, exams, or perform a PIN-verified permanent wipe of all local data.',
  },
  {
    heading: '7. Personal Information Controller (PIC) & Retention',
    body: 'Because ExamIQ never transmits or receives personal data externally, the teacher or educational institution operating this device serves as the Personal Information Controller (PIC). Records are retained only while stored on this device and are permanently erased upon local wipe or app uninstallation. Keep exported backups and printed sheets secured.',
  },
  {
    heading: '8. Developer & Privacy Contact',
    body: 'ExamIQ is independently developed by Andrei Obligar. For system inquiries, compliance documentation, or institutional support regarding offline deployment, coordinate directly through the developer Andrei Obligar.',
  },
];

export const TERMS_OF_OFFLINE_USAGE: readonly PolicySection[] = [
  {
    heading: '1. Offline Software Scope',
    body: 'ExamIQ is provided as a standalone offline mobile utility for educators to create multiple-choice exams, print QR-coded OMR sheets, scan shaded papers via camera, and compute class grades without an internet connection.',
  },
  {
    heading: '2. Local Backup Responsibility',
    body: 'Because no cloud synchronization exists, all records reside solely on this device. Teachers are responsible for exporting regular SQLite (.db) backups to safe storage before replacing a phone, clearing app storage, or uninstalling ExamIQ.',
  },
  {
    heading: '3. Educator Grade Verification',
    body: 'Automated OMR detection is a grading aid. Lighting, wrinkled papers, light pencil marks, half-shading, or over-shading (lagpas) can trigger flagged items. The teacher holds final academic responsibility to verify flagged tiles and confirm official student scores before submitting grades.',
  },
  {
    heading: '4. Official Sheet Format & Print Integrity',
    body: 'For accurate QR recognition and perspective alignment, use official ExamIQ-exported PDFs (A4, Short, or Long) with all four corner alignment squares, row timing ticks, and QR codes printed clearly without cropping or scaling distortion.',
  },
  {
    heading: '5. Shared Device & Student Privacy Duty',
    body: 'When using ExamIQ on a shared faculty device, enable a device PIN and log out after each session so student scores and personal records remain protected under institutional policies and RA 10173.',
  },
  {
    heading: '6. Attribution & Version Notice',
    body: 'ExamIQ (Version 1.0.0) and its offline OMR template workflow are developed by Andrei Obligar. All features operate locally on-device with no hidden subscriptions or external telemetry.',
  },
];
