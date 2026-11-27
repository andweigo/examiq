import {ServiceContainer} from '@app/ServiceContainer';
import {AnswerKey, ExamResult} from '@domain/index';
import {BubbleResponse} from '@domain/value-objects/BubbleResponse';
import {DashboardSorter} from '@utils/DashboardSorter';
import {ScoreCalculator} from '@utils/ScoreCalculator';

describe('ExamIQ OOP Core & Functional Flows', () => {
  beforeEach(() => {
    ServiceContainer.resetForTesting();
  });

  test('QrPayloadCodec encodes, verifies checksum, and decodes offline (v1 & v2)', () => {
    const {qrCodec} = ServiceContainer.getInstance();
    const raw = qrCodec.encode({
      version: 1,
      assignmentId: 'asgn-01',
      examId: 'ex-math-q1',
      studentId: '2026-0001',
    });

    expect(qrCodec.isValid(raw)).toBe(true);
    const decoded = qrCodec.decode(raw);
    expect(decoded.studentId).toBe('2026-0001');
    expect(decoded.examId).toBe('ex-math-q1');
    expect(qrCodec.isValid(`${raw}X`)).toBe(false);

    const rawV2 = qrCodec.encode({
      version: 2,
      assignmentId: 'ex-sci-mid-2026-0005',
      examId: 'ex-sci-mid',
      studentId: '2026-0005',
      paperSize: 'LONG',
      itemCount: 30,
    });
    expect(qrCodec.isValid(rawV2)).toBe(true);
    const decodedV2 = qrCodec.decode(rawV2);
    expect(decodedV2.version).toBe(2);
    expect(decodedV2.paperSize).toBe('LONG');
    expect(decodedV2.itemCount).toBe(30);
  });

  test('AnswerKey cycles choices A->B->C->D->A and recalculates points', () => {
    const key = new AnswerKey({
      id: 'ak-1',
      examId: 'ex-math-q1',
      entries: [
        {itemNumber: 1, correctChoice: 'A', points: 1},
        {itemNumber: 2, correctChoice: 'D', points: 1},
      ],
    });

    expect(key.cycleChoice(1)).toBe('B');
    expect(key.cycleChoice(2)).toBe('A');
    key.applyUniformPoints(5);
    expect(key.totalPoints).toBe(10);
  });

  test('ExamService creates exam, imports questions, syncs answer key, and resizes items', () => {
    const {examService} = ServiceContainer.getInstance();
    const created = examService.createExam({
      subject: 'Filipino',
      term: 'Quiz 1',
      section: 'Grade 10 Rizal',
      date: 'Nov 27',
      color: '#6BD4E6',
      items: 12,
      totalStudents: 40,
    });

    expect(examService.getSelectedExam().id).toBe(created.id);
    const imported = examService.importQuestionsFromLines(
      'Ano ang pandiwa? | Kilos | Pangalan | Kulay | Lugar | A\nPiliin ang pang-uri | Tumakbo | Maganda | Bahay | Aso | B',
    );
    expect(imported).toBe(2);
    expect(examService.getAnswerKey(created.id)[0]).toBe('A');
    expect(examService.getAnswerKey(created.id)[1]).toBe('B');

    const resized = examService.adjustAnswerKeyLength(4);
    expect(resized).toBe(16);

    const updated = examService.updateExam(created.id, {
      subject: 'Filipino',
      term: 'Quiz 1 Revised',
      section: 'Grade 10 Bonifacio',
      date: 'Nov 28',
      color: '#6BD4E6',
      items: 20,
      totalStudents: 38,
    });
    expect(updated?.term).toBe('Quiz 1 Revised');
    expect(examService.getAnswerKey(created.id).length).toBe(20);

    examService.deleteExam(created.id);
    expect(examService.getState().exams.some(e => e.id === created.id)).toBe(
      false,
    );
  });

  test('RosterService filters section students and imports CSV cleanly', () => {
    const {rosterService} = ServiceContainer.getInstance();
    const added = rosterService.importStudentsFromCsv(
      'Name,Section\nCarlo Bautista,Grade 10 Rizal\nMikaela Cruz,Grade 10 Bonifacio',
      'Grade 10 Rizal',
    );
    expect(added).toBe(2);

    const rizalStudents = rosterService.getStudentsForSection('Grade 10 Rizal');
    expect(rizalStudents.some(s => s.name === 'Carlo Bautista')).toBe(true);
    expect(rizalStudents.some(s => s.name === 'Mikaela Cruz')).toBe(false);
  });

  test('ExamResult flags blank & conflict responses cleanly', () => {
    const result = new ExamResult({
      id: 'res-1',
      examId: 'ex-math-q1',
      studentId: '2026-0001',
      assignmentId: 'asgn-01',
      responses: [
        new BubbleResponse({
          itemNumber: 1,
          expectedChoice: 'A',
          detectedChoices: ['A'],
          points: 1,
          confidence: 0.98,
        }),
        new BubbleResponse({
          itemNumber: 4,
          expectedChoice: 'A',
          detectedChoices: [],
          points: 1,
          confidence: 0.2,
        }),
        new BubbleResponse({
          itemNumber: 5,
          expectedChoice: 'C',
          detectedChoices: ['A', 'C'],
          points: 1,
          confidence: 0.65,
        }),
      ],
    });

    expect(result.earnedPoints).toBe(1);
    expect(result.flaggedItems.map(i => i.itemNumber)).toEqual([4, 5]);
    expect(result.scanStatus).toBe('review');
  });

  test('ScanningService manual override recalculates score up/down and confirms scan', () => {
    const container = ServiceContainer.getInstance();
    const initialScore = container.rosterService.getState().students[0].score;

    // Verify blank item #4 as key 'A' (+1)
    const up = container.scanningService.setReviewTileChoice(3, 'A');
    expect(up.delta).toBe(1);
    expect(container.rosterService.getState().students[0].score).toBe(
      initialScore + 1,
    );

    // Revert item #4 back to blank (-1)
    const down = container.scanningService.setReviewTileChoice(3, 'blank');
    expect(down.delta).toBe(-1);
    expect(container.rosterService.getState().students[0].score).toBe(
      initialScore,
    );

    container.scanningService.confirmActiveScan();
    expect(container.rosterService.getState().students[0].status).toBe(
      'Checked',
    );
  });

  test('ServiceContainer exports and restores full offline backup snapshot', () => {
    const container = ServiceContainer.getInstance();
    const snapshot = container.createBackupSnapshot();

    container.rosterService.addStudent('Temporary Student', 'Grade 10 Rizal');
    expect(
      container.rosterService
        .getState()
        .students.some(s => s.name === 'Temporary Student'),
    ).toBe(true);

    container.restoreBackupSnapshot(snapshot);
    expect(
      container.rosterService
        .getState()
        .students.some(s => s.name === 'Temporary Student'),
    ).toBe(false);
  });

  test('ScoreCalculator summarizes class passing rate and mean accurately', () => {
    const summary = ScoreCalculator.summarizeClass([
      {earnedPoints: 45, maxPoints: 50},
      {earnedPoints: 30, maxPoints: 50},
      {earnedPoints: 40, maxPoints: 50},
      {earnedPoints: 50, maxPoints: 50},
    ]);
    expect(summary.passedCount).toBe(3);
    expect(summary.passingRate).toBe(75);
    expect(summary.meanScore).toBe(41.3);
  });

  test('ExamService supports paper size changes, question reorder/duplicate, exact item sync, and alignment overlay generation', () => {
    const {examService} = ServiceContainer.getInstance();
    const created = examService.createExam({
      subject: 'Science',
      term: 'Quiz 2',
      section: 'Grade 10 Rizal',
      date: 'Nov 27',
      color: '#C6F453',
      items: 10,
      paperSize: 'SHORT',
      totalStudents: 35,
    });

    expect(created.paperSize).toBe('SHORT');
    examService.addQuestion('Question One', ['A1', 'B1', 'C1', 'D1'], 'A');
    examService.addQuestion('Question Two', ['A2', 'B2', 'C2', 'D2'], 'C');

    expect(examService.reorderQuestion(1, 'up')).toBe(true);
    expect(examService.getQuestions(created.id)[0].text).toBe('Question Two');
    expect(examService.getAnswerKey(created.id)[0]).toBe('C');
    expect(examService.getAnswerKey(created.id)[1]).toBe('A');

    const duplicated = examService.duplicateQuestion(0);
    expect(duplicated?.text).toBe('Question Two');
    expect(examService.getQuestions(created.id).length).toBe(3);

    const syncedCount = examService.syncItemCountToQuestions();
    expect(syncedCount).toBe(3);
    expect(examService.getSelectedExam().items).toBe(3);

    examService.setExamPaperSize(created.id, 'LONG');
    const overlay = examService.generateAlignmentOverlay(created.id);
    expect(overlay.paperSize).toBe('LONG');
    expect(overlay.itemCount).toBe(3);
    expect(overlay.rowsPerColumn).toBe(2);
    expect(overlay.overlaySignature.length).toBeGreaterThan(0);
  });

  test('RosterService imports structured Excel rows with duplicate skip and automatic section creation', () => {
    const {rosterService} = ServiceContainer.getInstance();
    const firstBatch = rosterService.importParsedStudents(
      [
        {studentId: '2026-0901', name: 'Bianca Navarro', section: 'Grade 11 Newton'},
        {studentId: '2026-0902', name: 'Devon Morales', section: 'Grade 11 Newton'},
        {studentId: '2026-0901', name: 'Bianca Navarro', section: 'Grade 11 Newton'},
      ],
      'Grade 10 Rizal',
      'Elena Reyes',
    );

    expect(firstBatch.addedCount).toBe(2);
    expect(firstBatch.skippedDuplicates).toBe(1);
    expect(firstBatch.createdSections).toBe(1);
    expect(
      rosterService
        .getState()
        .classes.some(c => c.grade === 'Grade 11' && c.section === 'Newton'),
    ).toBe(true);
  });

  test('ProfileSettingsService & ServiceContainer enforce PIN verification before wiping all local data', async () => {
    const container = ServiceContainer.getInstance();
    expect(container.profileSettingsService.getState().isRegistered).toBe(false);

    container.profileSettingsService.completeRegistration({
      name: 'Prof. Elena Reyes',
      school: 'Calapan National High School',
      role: 'Mathematics & Science Teacher',
      pin: '2580',
    });

    expect(container.profileSettingsService.getState().isRegistered).toBe(true);
    expect(container.profileSettingsService.verifyDevicePin('1111')).toBe(false);
    expect(container.profileSettingsService.verifyDevicePin('2580')).toBe(true);

    container.rosterService.addStudent('Temp Wipe Check', 'Grade 10 Rizal');

    // Wrong PIN must not wipe data
    const wrongResult = await container.wipeAllDataWithPin('9999');
    expect(wrongResult).toBe(false);
    expect(container.profileSettingsService.getState().isRegistered).toBe(true);
    expect(
      container.rosterService
        .getState()
        .students.some(s => s.name === 'Temp Wipe Check'),
    ).toBe(true);

    // Correct PIN wipes stores and resets back to Registration
    const okResult = await container.wipeAllDataWithPin('2580');
    expect(okResult).toBe(true);
    expect(container.profileSettingsService.getState().isRegistered).toBe(false);
    expect(container.profileSettingsService.getState().pinHash).toBeNull();
    expect(
      container.rosterService
        .getState()
        .students.some(s => s.name === 'Temp Wipe Check'),
    ).toBe(false);
  });

  test('registerTeacherProfile isolates multi-teacher workspaces across logout, new accounts, and restarts', async () => {
    const container = ServiceContainer.getInstance();
    const accA = await container.registerTeacherProfile({
      name: 'Juan Dela Cruz',
      school: 'Manila Science High School',
      role: 'Physics Teacher',
      pin: '4321',
    });

    expect(container.profileSettingsService.getState().isRegistered).toBe(true);
    expect(container.profileSettingsService.getState().teacher.name).toBe(
      'Juan Dela Cruz',
    );
    expect(container.profileSettingsService.getState().teacher.initials).toBe(
      'JC',
    );
    // New teacher starts with a clean isolated workspace
    expect(container.rosterService.getState().classes.length).toBe(0);
    expect(container.rosterService.getState().students.length).toBe(0);
    expect(container.examService.getState().exams.length).toBe(0);

    container.rosterService.addClassSection('Grade 11', 'Einstein', 'Juan Dela Cruz');
    container.rosterService.addStudent('Maria Cruz', 'Grade 11 Einstein');
    expect(container.rosterService.getState().students.length).toBe(1);

    const savedSnapshot = container.serializeCurrentState();

    // Simulate cold restart by resetting container and hydrating snapshot
    ServiceContainer.resetForTesting();
    const restarted = ServiceContainer.getInstance();
    expect(restarted.profileSettingsService.getState().isRegistered).toBe(false);

    restarted.restoreBackupSnapshot(savedSnapshot, false);
    expect(restarted.profileSettingsService.getState().isRegistered).toBe(true);
    expect(restarted.profileSettingsService.getState().teacher.name).toBe(
      'Juan Dela Cruz',
    );
    expect(restarted.profileSettingsService.getState().teacher.school).toBe(
      'Manila Science High School',
    );
    expect(restarted.profileSettingsService.verifyDevicePin('4321')).toBe(true);
    expect(
      restarted.rosterService
        .getState()
        .students.some(s => s.name === 'Maria Cruz'),
    ).toBe(true);

    // Logout snapshots Teacher A to vault and clears live workspace
    await restarted.logoutTeacherSession();
    expect(restarted.profileSettingsService.getState().isRegistered).toBe(false);
    expect(restarted.rosterService.getState().students.length).toBe(0);
    expect(restarted.rosterService.getState().classes.length).toBe(0);
    expect(restarted.getSavedAccounts().length).toBe(1);
    expect(restarted.getSavedAccounts()[0].studentCount).toBe(1);

    // Teacher B registers on the same device: must NOT see Teacher A's classes/students
    const accB = await restarted.registerTeacherProfile({
      name: 'Ana Santos',
      school: 'Quezon City High School',
      role: 'English Teacher',
    });
    expect(restarted.rosterService.getState().students.length).toBe(0);
    expect(restarted.rosterService.getState().classes.length).toBe(0);
    restarted.rosterService.addClassSection('Grade 9', 'Luna', 'Ana Santos');
    restarted.rosterService.addStudent('Carlos Lim', 'Grade 9 Luna');

    await restarted.logoutTeacherSession();
    expect(restarted.getSavedAccounts().length).toBe(2);

    // Unlocking Teacher A requires correct PIN and restores ONLY Teacher A's data
    expect(await restarted.unlockSavedTeacherSession('0000', accA)).toBe(false);
    expect(await restarted.unlockSavedTeacherSession('4321', accA)).toBe(true);
    expect(restarted.profileSettingsService.getState().isRegistered).toBe(true);
    expect(restarted.rosterService.getState().students.map(s => s.name)).toEqual([
      'Maria Cruz',
    ]);
    // Security alert from failed PIN attempt is recorded in Teacher A's alert log
    expect(
      restarted.profileSettingsService
        .getState()
        .alerts.some(a => a.category === 'security'),
    ).toBe(true);

    // Switch to Teacher B: restores ONLY Teacher B's data
    await restarted.logoutTeacherSession();
    expect(await restarted.unlockSavedTeacherSession(undefined, accB)).toBe(true);
    expect(restarted.rosterService.getState().students.map(s => s.name)).toEqual([
      'Carlos Lim',
    ]);
  });

  test('ProfileSettingsService manages deep-linked alerts with dismiss and clearReadAlerts', () => {
    const {profileSettingsService} = ServiceContainer.getInstance();
    profileSettingsService.pushAlert({
      title: '2 flagged items on Maria Cruz',
      detail: 'Items #4, #12 need quick verification.',
      category: 'scan',
      targetRoute: 'Review',
      targetExamId: 'ex-math-q1',
      targetStudentId: '2026-0002',
    });

    const added = profileSettingsService.getState().alerts[0];
    expect(added.category).toBe('scan');
    expect(added.targetRoute).toBe('Review');
    expect(added.unread).toBe(true);

    profileSettingsService.markAllAlertsRead();
    expect(
      profileSettingsService.getState().alerts.every(a => !a.unread),
    ).toBe(true);

    profileSettingsService.pushAlert({
      title: 'Backup recommended',
      category: 'backup',
      targetRoute: 'BackupRestore',
    });
    const freshUnread = profileSettingsService.getState().alerts[0];

    profileSettingsService.clearReadAlerts();
    expect(profileSettingsService.getState().alerts.map(a => a.id)).toEqual([
      freshUnread.id,
    ]);

    profileSettingsService.dismissAlert(freshUnread.id);
    expect(profileSettingsService.getState().alerts.length).toBe(0);
  });

  test('ScanningService provides per-bubble fillRatios for calibration preview and preserves them on verify', () => {
    const container = ServiceContainer.getInstance();
    container.scanningService.setActiveSession('2026-0002', 'ex-math-q1');
    container.scanningService.runOfflineOmrEvaluation('balanced', true);

    const tiles = container.scanningService.getState().reviewTiles;
    expect(tiles.length).toBeGreaterThan(0);
    const firstTile = tiles[0];
    expect(firstTile.fillRatios).toBeDefined();
    expect(typeof firstTile.fillRatios?.A).toBe('number');
    expect(typeof firstTile.fillRatios?.D).toBe('number');

    const beforeRatios = firstTile.fillRatios;
    const {tile} = container.scanningService.setReviewTileChoice(0, 'B');
    expect(tile.fillRatios).toEqual(beforeRatios);
  });

  test('RosterService supports optional manual Student ID / LRN with duplicate detection and synced class counts', () => {
    const {rosterService} = ServiceContainer.getInstance();
    const initialRizalCount = rosterService
      .getState()
      .classes.find(c => c.section === 'Rizal')!.students;

    const custom = rosterService.addStudent(
      'Paolo Mendoza',
      'Grade 10 Rizal',
      'LRN-109823412001',
    );
    expect(custom.id).toBe('LRN-109823412001');
    expect(rosterService.isStudentIdTaken('LRN-109823412001')).toBe(true);
    expect(
      rosterService.getState().classes.find(c => c.section === 'Rizal')!
        .students,
    ).toBe(initialRizalCount + 1);

    rosterService.deleteStudent(custom.id);
    expect(rosterService.isStudentIdTaken('LRN-109823412001')).toBe(false);
    expect(
      rosterService.getState().classes.find(c => c.section === 'Rizal')!
        .students,
    ).toBe(initialRizalCount);
  });

  test('ProfileSettingsService requires current PIN before changing an existing device PIN', () => {
    const {profileSettingsService} = ServiceContainer.getInstance();

    // Setting initial PIN succeeds without a prior PIN
    expect(profileSettingsService.changeDevicePin('1234')).toBe(true);
    expect(profileSettingsService.verifyDevicePin('1234')).toBe(true);

    // Changing without current PIN or with wrong current PIN fails and logs a security alert
    expect(profileSettingsService.changeDevicePin('5678')).toBe(false);
    expect(profileSettingsService.changeDevicePin('5678', '0000')).toBe(false);
    expect(profileSettingsService.verifyDevicePin('1234')).toBe(true);
    expect(
      profileSettingsService
        .getState()
        .alerts.some(
          a => a.category === 'security' && a.title.includes('Failed PIN'),
        ),
    ).toBe(true);

    // Changing with correct current PIN updates PIN cleanly
    expect(profileSettingsService.changeDevicePin('5678', '1234')).toBe(true);
    expect(profileSettingsService.verifyDevicePin('1234')).toBe(false);
    expect(profileSettingsService.verifyDevicePin('5678')).toBe(true);
  });

  test('ScanningService.reapplyOmrSensitivity dynamically reclassifies light and lagpas shading across Strict/Balanced/Lenient', () => {
    const container = ServiceContainer.getInstance();
    container.scanningService.applyNativeOmrAnalysis({
      markersDetected: 4,
      rotationAngleDeg: 0.2,
      lightingStatus: 'Clear',
      sharpnessScore: 0.9,
      rawImageUri: 'file://raw.jpg',
      alignedImageUri: 'file://aligned.jpg',
      score: 0,
      total: 2,
      flaggedCount: 2,
      items: [
        {
          num: 1,
          detected: 'B (Half)',
          key: 'B',
          type: 'flagged',
          flagReason: 'half_shaded',
          label: 'B · Half',
          fillRatios: {A: 0.08, B: 0.32, C: 0.07, D: 0.09},
          bleedRatios: {A: 0.02, B: 0.04, C: 0.02, D: 0.03},
        },
        {
          num: 2,
          detected: 'C (Messy)',
          key: 'C',
          type: 'flagged',
          flagReason: 'over_shaded',
          label: 'C · Messy',
          fillRatios: {A: 0.07, B: 0.08, C: 0.72, D: 0.06},
          bleedRatios: {A: 0.02, B: 0.02, C: 0.23, D: 0.02},
        },
      ],
    });

    // Under Strict (min 46%, lagpas >= 20%): Item #1 stays half_shaded, Item #2 stays over_shaded
    container.scanningService.reapplyOmrSensitivity('strict', true);
    expect(container.scanningService.getState().reviewTiles[0].flagReason).toBe(
      'half_shaded',
    );
    expect(container.scanningService.getState().reviewTiles[1].flagReason).toBe(
      'over_shaded',
    );

    // Under Balanced (min 36%, lagpas >= 26%): Item #2 clears lagpas -> correct, Item #1 stays half_shaded
    const balChanges = container.scanningService.reapplyOmrSensitivity(
      'balanced',
      true,
    );
    expect(balChanges).toBe(1);
    expect(container.scanningService.getState().reviewTiles[0].flagReason).toBe(
      'half_shaded',
    );
    expect(container.scanningService.getState().reviewTiles[1].type).toBe(
      'correct',
    );

    // Under Lenient (min 28%, lagpas >= 34%): Item #1 (32% light pencil) also becomes correct!
    const lenChanges = container.scanningService.reapplyOmrSensitivity(
      'lenient',
      true,
    );
    expect(lenChanges).toBe(1);
    expect(container.scanningService.getState().reviewTiles[0].type).toBe(
      'correct',
    );
  });

  test('DashboardSorter naturally sorts classes/sections, groups by subject or section, and orders urgent exams first', () => {
    const sampleExams = [
      {
        id: 'e1',
        subject: 'Science',
        term: 'Q1',
        section: 'Grade 10 Rizal',
        date: 'Nov 27',
        scanned: 38,
        total: 40,
        color: '#C6F453',
        items: 50,
        paperSize: 'A4' as const,
        passingRate: 85,
        needsReviewCount: 0,
      },
      {
        id: 'e2',
        subject: 'English',
        term: 'Q1',
        section: 'Grade 9 Luna',
        date: 'Nov 27',
        scanned: 10,
        total: 40,
        color: '#6BD4E6',
        items: 40,
        paperSize: 'A4' as const,
        passingRate: 78,
        needsReviewCount: 3,
      },
      {
        id: 'e3',
        subject: 'Mathematics',
        term: 'Q1',
        section: 'Grade 10 Bonifacio',
        date: 'Nov 27',
        scanned: 25,
        total: 40,
        color: '#958BFF',
        items: 50,
        paperSize: 'A4' as const,
        passingRate: 80,
        needsReviewCount: 1,
      },
    ];

    // Natural section sort puts Grade 9 Luna -> Grade 10 Bonifacio -> Grade 10 Rizal
    const bySection = DashboardSorter.groupExams(sampleExams, 'section');
    expect(bySection.map(g => g.label)).toEqual([
      'Grade 9 Luna',
      'Grade 10 Bonifacio',
      'Grade 10 Rizal',
    ]);

    // Alphabetical subject sort puts English -> Mathematics -> Science
    const bySubject = DashboardSorter.groupExams(sampleExams, 'subject');
    expect(bySubject.map(g => g.label)).toEqual([
      'English',
      'Mathematics',
      'Science',
    ]);

    // Urgent sort puts highest needsReviewCount first
    const byUrgent = DashboardSorter.sortExams(sampleExams, 'progress');
    expect(byUrgent.map(e => e.id)).toEqual(['e2', 'e3', 'e1']);
  });

  test('Hybrid MCQ + Essay exams keep OMR items strictly MCQ while storing manual teacher essay scores separately', () => {
    const {examService, rosterService} = ServiceContainer.getInstance();
    const created = examService.createExam({
      subject: 'English',
      term: 'Midterm',
      section: 'Grade 10 Rizal',
      date: 'Nov 27',
      color: '#958BFF',
      items: 2,
      totalStudents: 30,
    });

    examService.addQuestion('Select the noun', ['Run', 'Book', 'Fast', 'Red'], 'B');
    examService.addQuestion('Select the verb', ['Jump', 'Blue', 'Desk', 'Tall'], 'A');
    examService.addQuestion(
      'Explain the main theme of the story in 5 sentences.',
      ['', '', '', ''],
      'A',
      {kind: 'essay', maxPoints: 10, rubric: 'Clarity 5, Evidence 5'},
    );

    // OMR answer key and item count only include the 2 multiple-choice items
    expect(examService.getMcqQuestions(created.id).length).toBe(2);
    expect(examService.getEssayQuestions(created.id).length).toBe(1);
    expect(examService.getEssayMaxPoints(created.id)).toBe(10);
    expect(examService.getAnswerKey(created.id).length).toBe(2);

    // Teacher adds manual essay score separately without touching OMR score
    const st = rosterService.addStudent('Liam Torres', 'Grade 10 Rizal');
    rosterService.setStudentScore(st.id, 2, 2, 'Checked');
    rosterService.setStudentManualScore(st.id, 8, 10, 'Well reasoned');

    const updated = rosterService
      .getState()
      .students.find(s => s.id === st.id)!;
    expect(updated.score).toBe(2);
    expect(updated.total).toBe(2);
    expect(updated.manualScore).toBe(8);
    expect(updated.manualMax).toBe(10);
    expect(updated.manualNote).toBe('Well reasoned');
  });
});
