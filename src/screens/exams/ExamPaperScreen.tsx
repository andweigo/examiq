import React, {useMemo, useState} from 'react';
import {Pressable, Share, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  BackHeader,
  DisplayHeading,
  OwlMascot,
  PillButton,
  QrMatrixSvg,
  ScreenLayout,
  SegmentedControl,
} from '@components/index';
import {
  BUBBLE_CHOICES,
  PAPER_SIZE_LIST,
  PAPER_SIZE_MAP,
} from '@constants/omr';
import {PaperSize} from '@core/types/common';
import {PdfExportMode} from '@engines/pdf/PdfExportEngine';
import {
  useExams,
  useProfileSettings,
  useRoster,
  useScanning,
  useServices,
  useToast,
} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

type PreviewTab = 'answer-sheet' | 'question-sheet';

export const ExamPaperScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {selectedExam, questions, service: examService} = useExams();
  const {selectedGeneratorStudent} = useRoster(selectedExam.section);
  const {teacher, service: profileService} = useProfileSettings();
  const {service: scanningService} = useScanning();
  const {qrCodec, pdfEngine} = useServices();
  const {showToast} = useToast();

  const [previewTab, setPreviewTab] = useState<PreviewTab>('answer-sheet');
  const [exportMode, setExportMode] = useState<PdfExportMode>('sheet-only');

  const paperSize: PaperSize = selectedExam.paperSize ?? 'A4';
  const paperSpec = PAPER_SIZE_MAP[paperSize];

  // Mirror the EXACT number of items configured by the teacher (column-major order matching PDF)
  const exactItemCount = Math.max(1, selectedExam.items);
  const rowsPerCol = Math.ceil(exactItemCount / 2);
  const orderedRows = useMemo(() => {
    const pairs: Array<{left: number; right: number | null}> = [];
    for (let r = 0; r < rowsPerCol; r += 1) {
      const leftNum = r + 1;
      const rightNum =
        r + 1 + rowsPerCol <= exactItemCount ? r + 1 + rowsPerCol : null;
      pairs.push({left: leftNum, right: rightNum});
    }
    return pairs;
  }, [exactItemCount, rowsPerCol]);

  const estimatedQuestionPages = Math.max(
    1,
    Math.ceil(questions.length / (paperSize === 'LONG' ? 12 : paperSize === 'SHORT' ? 9 : 10)),
  );

  const assignmentId = `${selectedExam.id}-${selectedGeneratorStudent.id}`;
  const qrString = qrCodec.encode({
    version: 2,
    assignmentId,
    examId: selectedExam.id,
    studentId: selectedGeneratorStudent.id,
    paperSize,
    itemCount: exactItemCount,
  });

  const handleChangePaperSize = (nextSize: PaperSize) => {
    const hadSheets = examService.hasGeneratedSheets(selectedExam.id);
    examService.setExamPaperSize(selectedExam.id, nextSize);
    showToast(`Paper size: ${nextSize}`);
    if (hadSheets) {
      profileService.pushAlert({
        title: `${selectedExam.subject} switched to ${nextSize} — reprint sheets`,
        detail:
          'Paper dimensions changed after sheets were generated. Export updated PDFs before scanning.',
        category: 'exam',
        targetRoute: 'ExamGenerator',
        targetExamId: selectedExam.id,
      });
    }
  };

  const handleSharePrint = async () => {
    if (
      (exportMode === 'questions-only' || exportMode === 'full-exam') &&
      questions.length === 0
    ) {
      showToast('Add questions first');
      return;
    }

    try {
      const pdf = await pdfEngine.generateSingleSheetPdf({
        subject: selectedExam.subject,
        term: selectedExam.term,
        date: selectedExam.date,
        studentName: selectedGeneratorStudent.name,
        studentId: selectedGeneratorStudent.id,
        section: selectedGeneratorStudent.section,
        itemCount: exactItemCount,
        paperSize,
        qrPayload: qrString,
        exportMode,
        includeQuestionnaire: exportMode === 'full-exam',
        questions,
      });

      if (pdf) {
        profileService.recordExport(pdf.fileName);
        showToast(pdf.savedToDownloads ? 'Saved to Downloads' : 'PDF ready');
        await pdfEngine.shareFile(pdf.filePath, 'application/pdf', pdf.fileName);
        return;
      }

      const fallbackMessage =
        exportMode === 'questions-only'
          ? [
              `${selectedExam.subject} · ${selectedExam.term} — Question Sheet (${paperSpec.label})`,
              ...questions.map(
                q =>
                  `${q.num}. ${q.text}\n   A. ${q.choices[0]}  B. ${q.choices[1]}  C. ${q.choices[2]}  D. ${q.choices[3]}`,
              ),
            ].join('\n\n')
          : [
              `ExamIQ ${paperSpec.label} OMR Answer Sheet (${exactItemCount} items)`,
              `Exam: ${selectedExam.subject} · ${selectedExam.term}`,
              `Student: ${selectedGeneratorStudent.name} (${selectedGeneratorStudent.id})`,
              `Section: ${selectedGeneratorStudent.section}`,
              `QR Payload: ${qrString}`,
            ].join('\n');

      await Share.share({
        title: `${selectedExam.subject} · ${selectedExam.term}`,
        message: fallbackMessage,
      });
    } catch {
      showToast('Unable to open system share sheet');
    }
  };

  const renderItemCell = (itemNum: number | null) => {
    if (itemNum === null) {
      return <View style={styles.bubbleRow} />;
    }
    return (
      <View style={styles.bubbleRow}>
        <View style={styles.timingTick} />
        <Text style={styles.itemNum}>{itemNum}.</Text>
        <View style={styles.bubbleChoices}>
          {BUBBLE_CHOICES.map(letter => (
            <View key={letter} style={styles.bubbleCircle}>
              <Text style={styles.bubbleLetter}>{letter}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const exportButtonLabel =
    exportMode === 'questions-only'
      ? 'Export Questions'
      : exportMode === 'full-exam'
      ? 'Export Full PDF'
      : 'Export OMR PDF';

  const paperVisual =
    paperSize === 'SHORT'
      ? {
          cardStyle: styles.paperCardShort,
          bubbleGap: 4,
          qGap: 9,
          qrSize: 70,
          sizeSummary: 'SHORT · 8.5 × 11 in (Compact)',
        }
      : paperSize === 'LONG'
      ? {
          cardStyle: styles.paperCardLong,
          bubbleGap: 11,
          qGap: 15,
          qrSize: 78,
          sizeSummary: 'LONG · 8.5 × 13 in (Extended)',
        }
      : {
          cardStyle: styles.paperCardA4,
          bubbleGap: 7,
          qGap: 12,
          qrSize: 74,
          sizeSummary: 'A4 · 210 × 297 mm (Standard)',
        };

  const exportFormatOptions: ReadonlyArray<{
    title: string;
    sub: string;
    value: PdfExportMode;
  }> = [
    {title: 'OMR sheet', sub: 'Bubbles only', value: 'sheet-only'},
    {title: 'Questions', sub: 'Paper only', value: 'questions-only'},
    {title: 'Full exam', sub: 'Questions + OMR', value: 'full-exam'},
  ];

  return (
    <ScreenLayout activeTab="exams">
      <BackHeader
        onBack={() =>
          navigation.navigate(RootRoute.ExamGenerator, {
            examId: selectedExam.id,
          })
        }
        right={
          <Text style={styles.rightMeta}>
            {paperSpec.code} · {paperSpec.dimensionsLabel}
          </Text>
        }
      />

      <DisplayHeading
        lightText="Exam"
        boldText="paper"
        style={styles.heading}
      />

      {/* Equal-Width Paper Size Selector */}
      <View style={styles.equalRow}>
        {PAPER_SIZE_LIST.map(p => {
          const active = p.code === paperSize;
          return (
            <Pressable
              key={p.code}
              onPress={() => handleChangePaperSize(p.code)}
              style={({pressed}) => [
                styles.equalChoiceBtn,
                active && styles.equalChoiceBtnActive,
                pressed && styles.pressed,
              ]}>
              <Text
                numberOfLines={1}
                style={[
                  styles.equalChoiceTitle,
                  active && styles.equalChoiceTitleActive,
                ]}>
                {p.code === 'SHORT'
                  ? 'Short'
                  : p.code === 'LONG'
                  ? 'Long'
                  : 'A4'}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.equalChoiceSub,
                  active && styles.equalChoiceSubActive,
                ]}>
                {p.dimensionsLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Live Document Preview Switcher: OMR Answer Sheet vs Printable Question Sheet */}
      <SegmentedControl<PreviewTab>
        compact
        value={previewTab}
        onChange={tab => {
          setPreviewTab(tab);
          if (tab === 'question-sheet' && exportMode === 'sheet-only') {
            setExportMode('questions-only');
          } else if (tab === 'answer-sheet' && exportMode === 'questions-only') {
            setExportMode('sheet-only');
          }
        }}
        options={[
          {label: 'Answer sheet', value: 'answer-sheet'},
          {label: 'Question sheet', value: 'question-sheet'},
        ]}
        style={styles.modeToggle}
      />

      <Text style={styles.paperDimensionCaption}>{paperVisual.sizeSummary}</Text>

      {previewTab === 'answer-sheet' ? (
        /* Standardized OMR Answer Sheet Preview (dynamically scaled by paper size) */
        <View style={[styles.paperCard, paperVisual.cardStyle]}>
          <View>
            <View style={styles.cornerRow}>
              <View style={styles.cornerMark} />
              <Text style={styles.templateTag}>
                OMR TEMPLATE V2 · {paperSpec.code}
              </Text>
              <View style={styles.cornerMark} />
            </View>

            <View style={styles.paperHeaderRow}>
              <View style={styles.paperHeaderInfo}>
                <Text style={styles.examTitle} numberOfLines={2}>
                  {selectedExam.subject} · {selectedExam.term}
                </Text>
                <Text style={styles.studentName} numberOfLines={1}>
                  {selectedGeneratorStudent.name}
                </Text>
                <Text style={styles.metaLine} numberOfLines={1}>
                  ID: {selectedGeneratorStudent.id}
                </Text>
                <Text style={styles.metaLine} numberOfLines={1}>
                  {selectedGeneratorStudent.section} · {selectedExam.date}, 2026
                </Text>
              </View>
              <QrMatrixSvg seed={qrString} size={paperVisual.qrSize} />
            </View>

            <View style={styles.instructionsRow}>
              <Text style={styles.instructionText}>
                Shade bubbles completely ({exactItemCount} items)
              </Text>
              <View style={styles.correctLegend}>
                <View style={styles.filledDot} />
                <Text style={styles.correctText}>Correct</Text>
              </View>
            </View>

            <View style={[styles.bubbleList, {gap: paperVisual.bubbleGap}]}>
              {orderedRows.map(pair => (
                <View key={pair.left} style={styles.pairRow}>
                  {renderItemCell(pair.left)}
                  {renderItemCell(pair.right)}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.paperFooter}>
            <View style={styles.cornerMark} />
            <Text style={styles.footerHint}>
              Do not fold or cover corner marks or QR code
            </Text>
            <View style={styles.cornerMark} />
          </View>
        </View>
      ) : (
        /* Printable Bond-Paper Question Sheet Preview (dynamically scaled by paper size) */
        <View style={[styles.paperCard, paperVisual.cardStyle]}>
          <View>
            <View style={styles.qSheetHeader}>
              <Text style={styles.qSchool}>{teacher.school}</Text>
              <Text style={styles.qExamTitle}>
                {selectedExam.subject} · {selectedExam.term}
              </Text>
              <Text style={styles.qMetaLine}>
                {selectedExam.section} · {selectedExam.date}, 2026 ·{' '}
                {paperSpec.shortLabel}
              </Text>

              <View style={styles.qNameStrip}>
                <Text style={styles.qStripText}>
                  Name: ______________________
                </Text>
                <Text style={styles.qStripText}>
                  Score: ____ / {questions.length || exactItemCount}
                </Text>
              </View>
            </View>

            {questions.length === 0 ? (
              <View style={styles.emptyQuestions}>
                <OwlMascot pose="empty" size={88} />
                <Text style={styles.emptyQTitle}>
                  No questions written for this exam yet
                </Text>
                <Text style={styles.emptyQSub}>
                  Open Exam Builder to add multiple-choice questions and preview
                  your printable questionnaire here.
                </Text>
                <Pressable
                  onPress={() =>
                    navigation.navigate(RootRoute.ExamBuilder, {
                      examId: selectedExam.id,
                    })
                  }
                  style={styles.builderChip}>
                  <Text style={styles.builderChipText}>
                    Open Exam Builder →
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.qList, {gap: paperVisual.qGap}]}>
                <Text style={styles.qDirection}>
                  Directions: Read each item carefully and shade the letter of
                  the best answer on your ExamIQ OMR sheet.
                </Text>
                {questions.map(q => {
                  const isEssay = q.kind === 'essay';
                  return (
                    <View key={q.num} style={styles.qItemBlock}>
                      <Text style={styles.qStem}>
                        {q.num}. {q.text}
                        {isEssay ? ` (${q.maxPoints ?? 10} pts · Essay)` : ''}
                      </Text>
                      {isEssay ? (
                        <View style={styles.essayLinesWrap}>
                          {q.rubric ? (
                            <Text style={styles.qEssayRubric}>
                              Criteria: {q.rubric}
                            </Text>
                          ) : null}
                          <View style={styles.essayLine} />
                          <View style={styles.essayLine} />
                          <View style={styles.essayLine} />
                        </View>
                      ) : (
                        <View style={styles.qChoicesGrid}>
                          {BUBBLE_CHOICES.map((letter, idx) => (
                            <Text key={letter} style={styles.qChoiceText}>
                              {letter}. {q.choices[idx]}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.qFooter}>
            <Text style={styles.footerHint}>
              {questions.length} question{questions.length === 1 ? '' : 's'} ·{' '}
              Est. {estimatedQuestionPages} {paperSpec.code} page
              {estimatedQuestionPages === 1 ? '' : 's'}
            </Text>
            <Pressable
              onPress={() =>
                navigation.navigate(RootRoute.ExamBuilder, {
                  examId: selectedExam.id,
                })
              }>
              <Text style={styles.editQuestionsLink}>Edit questions</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Equal-Sized 3-Mode PDF Export Format Selector */}
      <View style={styles.exportModeBlock}>
        <Text style={styles.exportModeLabel}>PDF EXPORT FORMAT</Text>
        <View style={styles.equalRow}>
          {exportFormatOptions.map(opt => {
            const active = exportMode === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setExportMode(opt.value)}
                style={({pressed}) => [
                  styles.equalChoiceBtn,
                  active && styles.equalChoiceBtnActive,
                  pressed && styles.pressed,
                ]}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.equalChoiceTitle,
                    active && styles.equalChoiceTitleActive,
                  ]}>
                  {opt.title}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.equalChoiceSub,
                    active && styles.equalChoiceSubActive,
                  ]}>
                  {opt.sub}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.bottomActions}>
        <PillButton
          label={exportButtonLabel}
          variant="muted"
          style={styles.flex}
          onPress={handleSharePrint}
        />
        <PillButton
          label="Test scan →"
          variant="dark"
          style={styles.flex}
          onPress={() => {
            scanningService.setActiveSession(
              selectedGeneratorStudent.id,
              selectedExam.id,
            );
            navigation.navigate(RootRoute.PaperScanner, {
              assignmentId,
              examId: selectedExam.id,
              studentId: selectedGeneratorStudent.id,
            });
          }}
        />
      </View>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  rightMeta: {
    fontSize: 11,
    color: Colors.inkMuted,
  },
  heading: {
    marginBottom: 14,
  },
  equalRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  equalChoiceBtn: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: Colors.surfaceWhite,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  equalChoiceBtnActive: {
    backgroundColor: Colors.inkPrimary,
    borderColor: Colors.inkPrimary,
  },
  equalChoiceTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.inkPrimary,
    textAlign: 'center',
  },
  equalChoiceTitleActive: {
    color: Colors.surfaceWhite,
  },
  equalChoiceSub: {
    fontSize: 9.5,
    color: Colors.inkMuted,
    textAlign: 'center',
  },
  equalChoiceSubActive: {
    color: Colors.lime,
  },
  pressed: {
    opacity: 0.8,
  },
  modeToggle: {
    marginBottom: 8,
  },
  paperDimensionCaption: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: Colors.inkMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  paperCard: {
    backgroundColor: Colors.surfaceWhite,
    borderWidth: 1,
    borderColor: '#D4D4CE',
    borderRadius: 14,
    justifyContent: 'space-between',
    alignSelf: 'center',
    marginBottom: 16,
  },
  paperCardShort: {
    width: '100%',
    minHeight: 370,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  paperCardA4: {
    width: '93%',
    minHeight: 455,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  paperCardLong: {
    width: '87%',
    minHeight: 560,
    paddingHorizontal: 14,
    paddingVertical: 22,
  },
  cornerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cornerMark: {
    width: 14,
    height: 14,
    backgroundColor: Colors.inkPrimary,
  },
  templateTag: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1,
    color: Colors.inkMuted,
  },
  paperHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E2DC',
  },
  paperHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  examTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  studentName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkPrimary,
    marginTop: 2,
  },
  metaLine: {
    fontSize: 9,
    color: Colors.inkMuted,
  },
  instructionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E2DC',
  },
  instructionText: {
    fontSize: 9,
    color: Colors.inkMuted,
  },
  correctLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filledDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.inkPrimary,
  },
  correctText: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.inkPrimary,
  },
  bubbleList: {
    gap: 6,
    paddingVertical: 12,
  },
  pairRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  bubbleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timingTick: {
    width: 5,
    height: 2.5,
    backgroundColor: Colors.inkPrimary,
    marginRight: 3,
  },
  itemNum: {
    width: 18,
    fontSize: 9,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  bubbleChoices: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bubbleCircle: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3A36',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleLetter: {
    fontSize: 7,
    fontWeight: '500',
    color: '#9A9A92',
  },
  paperFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E2DC',
  },
  footerHint: {
    fontSize: 8,
    color: Colors.inkMuted,
  },
  qSheetHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E2DC',
    paddingBottom: 10,
    marginBottom: 12,
    gap: 2,
  },
  qSchool: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
  },
  qExamTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  qMetaLine: {
    fontSize: 10,
    color: Colors.inkMuted,
  },
  qNameStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ECECE6',
  },
  qStripText: {
    fontSize: 9,
    color: Colors.inkSecondary,
  },
  qList: {
    gap: 12,
    marginBottom: 12,
  },
  qDirection: {
    fontSize: 9,
    fontStyle: 'italic',
    color: Colors.inkMuted,
    lineHeight: 14,
  },
  qItemBlock: {
    gap: 5,
  },
  qStem: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.inkPrimary,
    lineHeight: 16,
  },
  qChoicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
    paddingLeft: 10,
  },
  qChoiceText: {
    width: '50%',
    fontSize: 10,
    color: Colors.inkSecondary,
  },
  essayLinesWrap: {
    paddingLeft: 10,
    paddingTop: 4,
    gap: 12,
  },
  qEssayRubric: {
    fontSize: 9,
    fontStyle: 'italic',
    color: Colors.inkMuted,
  },
  essayLine: {
    height: 1,
    backgroundColor: '#D6D6D0',
  },
  emptyQuestions: {
    paddingVertical: 26,
    alignItems: 'center',
    gap: 6,
  },
  emptyQTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  emptyQSub: {
    fontSize: 11,
    color: Colors.inkMuted,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 10,
  },
  builderChip: {
    marginTop: 6,
    backgroundColor: Colors.inkPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.pill,
  },
  builderChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.lime,
  },
  qFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E2DC',
  },
  editQuestionsLink: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.purpleDeep,
  },
  exportModeBlock: {
    gap: 6,
    marginBottom: 14,
  },
  exportModeLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.7,
    color: Colors.inkSubtle,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    paddingBottom: 12,
  },
});
