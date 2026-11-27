import React from 'react';
import {Pressable, Share, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  BackHeader,
  DisplayHeading,
  NotchedCard,
  OwlMascot,
  ScreenLayout,
} from '@components/index';
import {
  useExams,
  useProfileSettings,
  useRoster,
  useServices,
  useToast,
} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {ScoreCalculator} from '@utils/ScoreCalculator';

export const ReportsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {selectedExam} = useExams();
  const {sectionStudents} = useRoster(selectedExam.section);
  const {teacher, exports: exportHistory, service} = useProfileSettings();
  const {pdfEngine} = useServices();
  const {showToast} = useToast();

  const shareGradeSheet = async () => {
    if (sectionStudents.length === 0) {
      showToast('No students in this section');
      return;
    }
    const fileName = `${selectedExam.section}_${selectedExam.subject}_Grades.csv`.replace(
      /\s+/g,
      '_',
    );
    const csvRows = [
      'Student ID,Name,Section,OMR Score,OMR Total,Essay Score,Essay Max,Total Earned,Total Possible,Percentage,Status',
      ...sectionStudents.map(s => {
        const mScore = s.manualScore ?? 0;
        const mMax = s.manualMax ?? 0;
        const {earnedPoints, maxPoints} =
          ScoreCalculator.combinedStudentScore(s);
        return `${s.id},"${s.name}",${s.section},${s.score},${s.total},${mScore},${mMax},${earnedPoints},${maxPoints},${ScoreCalculator.percentage(
          earnedPoints,
          maxPoints,
        )}%,${
          ScoreCalculator.isPassing(earnedPoints, maxPoints)
            ? 'Passed'
            : 'Below 75%'
        }`;
      }),
    ].join('\n');

    try {
      const nativeFile = await pdfEngine.exportGradeSheetCsv(fileName, csvRows);
      if (nativeFile) {
        service.recordExport(
          nativeFile.fileName,
          nativeFile.filePath,
          'text/csv',
        );
        showToast(nativeFile.savedToDownloads ? 'CSV saved' : 'CSV exported');
        await pdfEngine.shareFile(
          nativeFile.filePath,
          'text/csv',
          nativeFile.fileName,
        );
        return;
      }
      service.recordExport(fileName);
      showToast('CSV saved');
      await Share.share({title: fileName, message: csvRows});
    } catch {
      // User dismissed share sheet
    }
  };

  const sharePassingSummary = async () => {
    if (sectionStudents.length === 0) {
      showToast('No students in this section');
      return;
    }
    const fileName = `${selectedExam.section}_Summary.pdf`.replace(/\s+/g, '_');
    const summary = ScoreCalculator.summarizeClass(
      sectionStudents.map(s => ScoreCalculator.combinedStudentScore(s)),
    );

    try {
      const nativePdf = await pdfEngine.generatePassingSummaryPdf({
        fileName,
        examTitle: `${selectedExam.subject} · ${selectedExam.term}`,
        schoolName: teacher.school,
        teacherName: teacher.name,
        passingRate: summary.passingRate,
        passedCount: summary.passedCount,
        totalStudents: summary.totalStudents,
        meanScore: summary.meanScore,
        students: sectionStudents,
      });

      if (nativePdf) {
        service.recordExport(
          nativePdf.fileName,
          nativePdf.filePath,
          'application/pdf',
        );
        showToast(nativePdf.savedToDownloads ? 'PDF saved' : 'PDF ready');
        await pdfEngine.shareFile(
          nativePdf.filePath,
          'application/pdf',
          nativePdf.fileName,
        );
        return;
      }

      const reportText = [
        `ExamIQ Passing Rate Summary — ${selectedExam.subject} (${selectedExam.term})`,
        `Section: ${selectedExam.section}`,
        `Passing Rate (≥75%): ${summary.passingRate}% (${summary.passedCount}/${summary.totalStudents})`,
        `Mean Score: ${summary.meanScore}`,
      ].join('\n');
      service.recordExport(fileName);
      showToast('Summary saved');
      await Share.share({title: fileName, message: reportText});
    } catch {
      // User dismissed share sheet
    }
  };

  return (
    <ScreenLayout activeTab="results">
      <BackHeader onBack={() => navigation.navigate(RootRoute.Results)} />

      <DisplayHeading
        lightText="Export"
        boldText="reports"
        style={styles.heading}
      />

      <View style={styles.cards}>
        <NotchedCard backgroundColor={Colors.lime} onPress={shareGradeSheet}>
          <Text style={styles.cardType}>Spreadsheet (.csv · Excel-ready)</Text>
          <Text style={styles.cardTitle}>Class Grade Sheet</Text>
          <Text style={styles.cardSub}>
            {selectedExam.section} · {sectionStudents.length} students
          </Text>
        </NotchedCard>

        <NotchedCard
          backgroundColor={Colors.cyan}
          onPress={sharePassingSummary}>
          <Text style={styles.cardType}>Printable Document (.pdf)</Text>
          <Text style={styles.cardTitle}>Passing Rate Summary</Text>
          <Text style={styles.cardSub}>
            {selectedExam.subject} · Ready for school submission
          </Text>
        </NotchedCard>
      </View>

      <Text style={styles.sectionLabel}>Recent device exports</Text>
      <View>
        {exportHistory.length === 0 ? (
          <View style={styles.emptyExports}>
            <OwlMascot pose="empty" size={84} />
            <Text style={styles.emptyExportsText}>No exports yet</Text>
          </View>
        ) : (
          exportHistory.map(item => (
            <Pressable
              key={item.id}
              onPress={async () => {
                if (item.filePath) {
                  try {
                    await pdfEngine.shareFile(
                      item.filePath,
                      item.mimeType ?? 'application/octet-stream',
                      item.fileName,
                    );
                    return;
                  } catch {
                    showToast('File moved or unavailable');
                    return;
                  }
                }
                showToast('Re-export to share');
              }}
              style={styles.row}>
              <Text style={styles.fileName}>{item.fileName}</Text>
              <Text style={styles.fileDate}>{item.date}</Text>
            </Pressable>
          ))
        )}
      </View>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  heading: {
    marginBottom: 20,
  },
  cards: {
    gap: 12,
    marginBottom: 24,
  },
  cardType: {
    fontSize: 11,
    color: Colors.inkPrimary,
    opacity: 0.78,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.inkPrimary,
    marginTop: 2,
  },
  cardSub: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.inkPrimary,
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.inkPrimary,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  fileName: {
    fontSize: 12,
    color: Colors.inkPrimary,
  },
  fileDate: {
    fontSize: 12,
    color: Colors.inkMuted,
  },
  emptyExports: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 4,
  },
  emptyExportsText: {
    fontSize: 12,
    color: Colors.inkMuted,
  },
});
