import {EntityId} from '@core/types/common';

/**
 * Strongly typed route registry covering all 21 ExamIQ mobile screens.
 */
export enum RootRoute {
  // Onboarding / Local Registration
  Onboarding = 'Onboarding',
  Registration = 'Registration',

  // Home Flow
  Dashboard = 'Dashboard',
  DeviceAlerts = 'DeviceAlerts',

  // Exams Flow
  Exams = 'Exams',
  ExamBuilder = 'ExamBuilder',
  AnswerKey = 'AnswerKey',
  GeneratingOverlay = 'GeneratingOverlay',
  ExamGenerator = 'ExamGenerator',
  ExamPaper = 'ExamPaper',

  // Scan & OMR Flow
  QrScanner = 'QrScanner',
  PaperScanner = 'PaperScanner',
  Alignment = 'Alignment',
  AutoCheck = 'AutoCheck',
  Review = 'Review',
  ScanHistory = 'ScanHistory',

  // Results & Reports Flow
  Results = 'Results',
  Reports = 'Reports',

  // Profile & Records Flow
  Students = 'Students',
  Classes = 'Classes',
  Subjects = 'Subjects',
  BackupRestore = 'BackupRestore',
  Profile = 'Profile',
  Settings = 'Settings',
}

export enum MainTabRoute {
  HomeTab = 'HomeTab',
  ExamsTab = 'ExamsTab',
  ScanTab = 'ScanTab',
  ResultsTab = 'ResultsTab',
  ProfileTab = 'ProfileTab',
}

export type RootStackParamList = {
  [RootRoute.Onboarding]: undefined;
  [RootRoute.Registration]: undefined;
  [RootRoute.Dashboard]: undefined;
  [RootRoute.DeviceAlerts]: undefined;
  [RootRoute.Exams]: {subjectId?: EntityId} | undefined;
  [RootRoute.ExamBuilder]: {examId: EntityId};
  [RootRoute.AnswerKey]: {examId: EntityId};
  [RootRoute.GeneratingOverlay]: {examId: EntityId};
  [RootRoute.ExamGenerator]: {examId: EntityId};
  [RootRoute.ExamPaper]: {examId: EntityId; studentId: EntityId};
  [RootRoute.QrScanner]: {examId?: EntityId} | undefined;
  [RootRoute.PaperScanner]: {assignmentId: EntityId; examId: EntityId; studentId: EntityId};
  [RootRoute.Alignment]: {scanId: EntityId; rawImageUri: string};
  [RootRoute.AutoCheck]: {scanId: EntityId};
  [RootRoute.Review]: {scanId: EntityId};
  [RootRoute.ScanHistory]: undefined;
  [RootRoute.Results]: {examId?: EntityId} | undefined;
  [RootRoute.Reports]: {examId?: EntityId} | undefined;
  [RootRoute.Students]: undefined;
  [RootRoute.Classes]: undefined;
  [RootRoute.Subjects]: undefined;
  [RootRoute.BackupRestore]: undefined;
  [RootRoute.Profile]: undefined;
  [RootRoute.Settings]: undefined;
};
