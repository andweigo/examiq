import React, {useCallback, useMemo, useState} from 'react';
import {BackHandler, Pressable, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  BackHeader,
  ConfirmDialog,
  DisplayHeading,
  FilterPills,
  OwlMascot,
  PillButton,
  QrMatrixSvg,
  ScreenLayout,
} from '@components/index';
import {PAPER_SIZE_MAP} from '@constants/omr';
import {
  useExams,
  useProfileSettings,
  useRoster,
  useServices,
  useToast,
} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';

export const ExamGeneratorScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {selectedExam, alignmentOverlay, service: examService} = useExams();
  const {
    sectionStudents,
    selectedGeneratorStudent,
    service: rosterService,
  } = useRoster(selectedExam.section);
  const {service: profileService} = useProfileSettings();
  const {qrCodec, pdfEngine} = useServices();
  const {showToast} = useToast();

  const [exitDialogOpen, setExitDialogOpen] = useState(false);

  const paperSpec = PAPER_SIZE_MAP[selectedExam.paperSize ?? 'A4'];

  const confirmExitGenerator = useCallback(() => {
    setExitDialogOpen(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (exitDialogOpen) {
          setExitDialogOpen(false);
          return true;
        }
        confirmExitGenerator();
        return true;
      });
      return () => sub.remove();
    }, [exitDialogOpen, confirmExitGenerator]),
  );

  const studentOptions = useMemo(() => {
    const firstNamesCount = new Map<string, number>();
    sectionStudents.forEach(s => {
      const first = s.name.split(' ')[0];
      firstNamesCount.set(first, (firstNamesCount.get(first) ?? 0) + 1);
    });

    return sectionStudents.map(student => {
      const parts = student.name.split(' ');
      const first = parts[0];
      const needsLastInitial = (firstNamesCount.get(first) ?? 0) > 1 && parts[1];
      return {
        label: needsLastInitial ? `${first} ${parts[1][0]}.` : first,
        value: student.id,
      };
    });
  }, [sectionStudents]);

  const hasValidExam = Boolean(selectedExam.id);
  const hasStudents = sectionStudents.length > 0 && Boolean(selectedGeneratorStudent.id);

  const qrString = useMemo(() => {
    if (!hasValidExam || !selectedGeneratorStudent.id) {
      return '';
    }
    return qrCodec.encode({
      version: 2,
      assignmentId: `${selectedExam.id}-${selectedGeneratorStudent.id}`,
      examId: selectedExam.id,
      studentId: selectedGeneratorStudent.id,
      paperSize: selectedExam.paperSize,
      itemCount: selectedExam.items,
    });
  }, [
    hasValidExam,
    qrCodec,
    selectedExam.id,
    selectedExam.paperSize,
    selectedExam.items,
    selectedGeneratorStudent.id,
  ]);

  const handleGenerateBatchPdfs = async () => {
    if (!hasValidExam || sectionStudents.length === 0) {
      showToast('Add students to this section first');
      return;
    }
    const now = new Date().toISOString();
    const assignments = sectionStudents.map(student => {
      const assignmentId = `${selectedExam.id}-${student.id}`;
      return {
        assignmentId,
        examId: selectedExam.id,
        studentId: student.id,
        qrPayload: qrCodec.encode({
          version: 2,
          assignmentId,
          examId: selectedExam.id,
          studentId: student.id,
          paperSize: selectedExam.paperSize,
          itemCount: selectedExam.items,
        }),
        createdAt: now,
      };
    });

    examService.saveAssignments(selectedExam.id, assignments);

    try {
      const nativePdf = await pdfEngine.generateBatchSheetsPdf(
        selectedExam.subject,
        selectedExam.term,
        selectedExam.paperSize,
        sectionStudents.map((student, idx) => ({
          subject: selectedExam.subject,
          term: selectedExam.term,
          date: selectedExam.date,
          studentName: student.name,
          studentId: student.id,
          section: student.section,
          itemCount: selectedExam.items,
          paperSize: selectedExam.paperSize,
          qrPayload: assignments[idx].qrPayload,
        })),
      );

      if (nativePdf) {
        profileService.recordExport(
          nativePdf.fileName,
          nativePdf.filePath,
          'application/pdf',
        );
        profileService.pushAlert(
          `Saved ${nativePdf.pageCount}-page ${paperSpec.code} PDF (${nativePdf.fileName})`,
        );
        showToast(
          nativePdf.savedToDownloads ? 'PDF saved to Downloads' : 'PDF ready',
        );
        await pdfEngine.shareFile(
          nativePdf.filePath,
          'application/pdf',
          nativePdf.fileName,
        );
        return;
      }
    } catch {
      showToast('PDF export failed');
      return;
    }

    const pdfName = `${selectedExam.subject}_${selectedExam.term}_${paperSpec.code}.pdf`.replace(
      /\s+/g,
      '_',
    );
    profileService.recordExport(pdfName);
    showToast(`Generated ${assignments.length} sheets`);
  };

  if (!hasValidExam) {
    return (
      <ScreenLayout activeTab="exams">
        <BackHeader onBack={() => navigation.navigate(RootRoute.Exams)} />
        <View style={styles.emptyWrap}>
          <OwlMascot pose="empty" size={96} />
          <Text style={styles.emptyTitle}>No exam selected</Text>
          <Text style={styles.emptySub}>
            Create an exam first to preview and generate printable QR OMR sheets.
          </Text>
          <PillButton
            label="Go to Exams"
            variant="dark"
            compact
            onPress={() => navigation.navigate(RootRoute.Exams)}
          />
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout activeTab="exams">
      <BackHeader
        onBack={confirmExitGenerator}
        right={
          <Pressable
            onPress={() =>
              navigation.navigate(RootRoute.AnswerKey, {
                examId: selectedExam.id,
              })
            }>
            <Text style={styles.editKeyLink}>Edit key</Text>
          </Pressable>
        }
      />

      <DisplayHeading
        lightText="Exam"
        boldText="generator"
        style={styles.heading}
      />

      {!hasStudents ? (
        <View style={styles.emptyWrap}>
          <OwlMascot pose="empty" size={96} />
          <Text style={styles.emptyTitle}>
            No students in {selectedExam.section}
          </Text>
          <Text style={styles.emptySub}>
            Enroll students in {selectedExam.section} before generating
            individual QR-coded sheets.
          </Text>
          <PillButton
            label="Add students"
            variant="dark"
            compact
            onPress={() => navigation.navigate(RootRoute.Students)}
          />
        </View>
      ) : (
        <>

      {/* Fixed-Height Student Preview Pills */}
      <View style={styles.selectorBlock}>
        <Text style={styles.label}>
          Preview assigned QR sheet ({sectionStudents.length} students ·{' '}
          {paperSpec.shortLabel})
        </Text>
        <FilterPills
          size="sm"
          options={studentOptions}
          value={selectedGeneratorStudent.id}
          onChange={studentId => rosterService.selectGeneratorStudent(studentId)}
        />
      </View>

      {/* OMR Sheet Preview Card with Centered QR Identity Card */}
      <View style={styles.previewCard}>
        <View style={styles.cornerRow}>
          <View style={styles.cornerMark} />
          <Text style={styles.cornerHint}>
            4 Corner Marks · {paperSpec.code}
          </Text>
          <View style={styles.cornerMark} />
        </View>

        <View style={styles.sheetHeaderRow}>
          <View style={styles.sheetHeaderInfo}>
            <Text style={styles.sheetExam} numberOfLines={2}>
              {selectedExam.subject} · {selectedExam.term}
            </Text>
            <Text style={styles.sheetStudent} numberOfLines={1}>
              {selectedGeneratorStudent.name}
            </Text>
            <Text style={styles.sheetSub} numberOfLines={1}>
              {selectedGeneratorStudent.id} · {selectedGeneratorStudent.section}
            </Text>
          </View>
          <QrMatrixSvg seed={qrString} size={70} />
        </View>

        <View style={styles.miniBubblesGrid}>
          <Text style={styles.miniBubbleText}>1. ○ A ○ B ○ C ○ D</Text>
          <Text style={styles.miniBubbleText}>
            {Math.ceil(selectedExam.items / 2) + 1}. ○ A ○ B ○ C ○ D
          </Text>
          <Text style={styles.miniBubbleText}>2. ○ A ○ B ○ C ○ D</Text>
          <Text style={styles.miniBubbleText}>
            {Math.min(
              selectedExam.items,
              Math.ceil(selectedExam.items / 2) + 2,
            )}
            . ○ A ○ B ○ C ○ D
          </Text>
        </View>

        <View style={styles.sheetFooter}>
          <View style={styles.cornerMark} />
          <Text style={styles.cornerHint}>
            {selectedExam.items} OMR items
            {alignmentOverlay
              ? ` · Overlay #${alignmentOverlay.overlaySignature.slice(0, 6)}`
              : ''}
          </Text>
          <View style={styles.cornerMark} />
        </View>
      </View>

      <PillButton
        label="Open full exam paper"
        variant="muted"
        style={styles.secondaryBtn}
        onPress={() =>
          navigation.navigate(RootRoute.ExamPaper, {
            examId: selectedExam.id,
            studentId: selectedGeneratorStudent.id,
          })
        }
      />
      <PillButton
        label={`Generate ${sectionStudents.length} printable ${paperSpec.code} PDFs`}
        variant="dark"
        onPress={handleGenerateBatchPdfs}
      />
        </>
      )}

      <ConfirmDialog
        visible={exitDialogOpen}
        badge="Unsaved progress"
        title="Exit exam generator?"
        message="Are you sure you want to leave? Any unsaved progress will not be saved."
        tone="destructive"
        cancelLabel="Stay"
        confirmLabel="Leave"
        onCancel={() => setExitDialogOpen(false)}
        onConfirm={() => {
          setExitDialogOpen(false);
          navigation.navigate(RootRoute.Exams);
        }}
      />
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  emptyWrap: {
    paddingVertical: 36,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.inkPrimary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 12,
    color: Colors.inkMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  editKeyLink: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  heading: {
    marginBottom: 16,
  },
  selectorBlock: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    color: Colors.inkMuted,
    marginBottom: 8,
  },
  previewCard: {
    backgroundColor: Colors.surfaceWhite,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
  },
  cornerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cornerMark: {
    width: 10,
    height: 10,
    backgroundColor: Colors.inkPrimary,
  },
  cornerHint: {
    fontSize: 9,
    color: Colors.inkMuted,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  sheetHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  sheetExam: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  sheetStudent: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkPrimary,
    marginTop: 2,
  },
  sheetSub: {
    fontSize: 10,
    color: Colors.inkMuted,
    marginTop: 2,
  },
  miniBubblesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
    paddingVertical: 10,
  },
  miniBubbleText: {
    width: '50%',
    fontSize: 10,
    color: Colors.inkMuted,
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.hairlineLight,
  },
  secondaryBtn: {
    marginBottom: 10,
  },
});
