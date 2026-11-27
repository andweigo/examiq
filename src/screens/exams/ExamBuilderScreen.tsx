import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  BackHeader,
  DisplayHeading,
  FilterPills,
  FormModal,
  MinimalField,
  OwlMascot,
  PillButton,
  ScreenLayout,
  SegmentedControl,
} from '@components/index';
import {BUBBLE_CHOICES} from '@constants/omr';
import {BubbleChoice} from '@core/types/common';
import {QuestionKind} from '@data/database/SeedData';
import {useExams, useToast} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

const ESSAY_POINT_PRESETS = [5, 10, 15, 20] as const;

const SAMPLE_IMPORT_TEXT = [
  'Solve for y: 3y - 6 = 15 | 5 | 7 | 8 | 9 | B',
  'What is the value of 2^5? | 16 | 25 | 32 | 64 | C',
  'Derivative of x^2 with respect to x | x | 2x | x^2 | 2 | B',
].join('\n');

export const ExamBuilderScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    selectedExam,
    questions,
    mcqQuestions,
    essayQuestions,
    essayMaxPoints,
    service,
  } = useExams();
  const {showToast} = useToast();

  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [questionKind, setQuestionKind] = useState<QuestionKind>('mcq');
  const [prompt, setPrompt] = useState('');
  const [choiceA, setChoiceA] = useState('');
  const [choiceB, setChoiceB] = useState('');
  const [choiceC, setChoiceC] = useState('');
  const [choiceD, setChoiceD] = useState('');
  const [correctChoice, setCorrectChoice] = useState<BubbleChoice>('A');
  const [essayPoints, setEssayPoints] = useState('10');
  const [essayRubric, setEssayRubric] = useState('');

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState(SAMPLE_IMPORT_TEXT);

  const openAddModal = () => {
    setEditingIndex(null);
    setQuestionKind('mcq');
    setPrompt('');
    setChoiceA('');
    setChoiceB('');
    setChoiceC('');
    setChoiceD('');
    setCorrectChoice('A');
    setEssayPoints('10');
    setEssayRubric('');
    setQuestionModalOpen(true);
  };

  const openEditModal = (idx: number) => {
    const q = questions[idx];
    if (!q) {
      return;
    }
    setEditingIndex(idx);
    setQuestionKind(q.kind ?? 'mcq');
    setPrompt(q.text);
    setChoiceA(q.choices[0]);
    setChoiceB(q.choices[1]);
    setChoiceC(q.choices[2]);
    setChoiceD(q.choices[3]);
    setCorrectChoice(q.answer);
    setEssayPoints(String(q.maxPoints ?? 10));
    setEssayRubric(q.rubric ?? '');
    setQuestionModalOpen(true);
  };

  const handleSaveQuestion = () => {
    if (!prompt.trim()) {
      showToast('Enter question prompt');
      return;
    }
    const choices: [string, string, string, string] = [
      choiceA.trim() || 'Choice A',
      choiceB.trim() || 'Choice B',
      choiceC.trim() || 'Choice C',
      choiceD.trim() || 'Choice D',
    ];
    const parsedMaxPts = Math.max(1, parseInt(essayPoints, 10) || 10);

    if (editingIndex !== null) {
      service.updateQuestion(editingIndex, prompt, choices, correctChoice, {
        kind: questionKind,
        maxPoints: parsedMaxPts,
        rubric: essayRubric,
      });
      showToast(`Updated Q#${editingIndex + 1}`);
    } else {
      const added = service.addQuestion(prompt, choices, correctChoice, {
        kind: questionKind,
        maxPoints: parsedMaxPts,
        rubric: essayRubric,
      });
      showToast(
        questionKind === 'essay'
          ? `Added Essay (${parsedMaxPts} pts)`
          : `Added Q#${added.num} (${added.answer})`,
      );
    }
    setQuestionModalOpen(false);
  };

  const handleDeleteQuestion = () => {
    if (editingIndex === null) {
      return;
    }
    service.deleteQuestion(editingIndex);
    showToast(`Deleted Q#${editingIndex + 1}`);
    setQuestionModalOpen(false);
  };

  const handleReorder = (dir: 'up' | 'down') => {
    if (editingIndex === null) {
      return;
    }
    const moved = service.reorderQuestion(editingIndex, dir);
    if (moved) {
      const nextIdx = dir === 'up' ? editingIndex - 1 : editingIndex + 1;
      setEditingIndex(nextIdx);
      showToast(`Moved to Q#${nextIdx + 1}`);
    }
  };

  const handleDuplicate = () => {
    if (editingIndex === null) {
      return;
    }
    const copy = service.duplicateQuestion(editingIndex);
    if (copy) {
      setQuestionModalOpen(false);
      showToast(`Duplicated as Q#${copy.num}`);
    }
  };

  const handleImport = () => {
    const importedCount = service.importQuestionsFromLines(importText);
    if (importedCount === 0) {
      showToast('Invalid question format');
      return;
    }
    setImportModalOpen(false);
    showToast(`Imported ${importedCount} questions`);
  };

  return (
    <ScreenLayout activeTab="exams" scrollable={false}>
      <View style={styles.stickyTop}>
        <BackHeader
          onBack={() => navigation.navigate(RootRoute.Exams)}
          right={
            <Pressable
              onPress={() =>
                navigation.navigate(RootRoute.AnswerKey, {
                  examId: selectedExam.id,
                })
              }>
              <Text style={styles.linkPurple}>Answer key →</Text>
            </Pressable>
          }
        />

        <DisplayHeading
          lightText="Exam"
          boldText="builder"
          style={styles.heading}
        />
        <Text style={styles.subtitle}>
          {selectedExam.subject} · {selectedExam.term} · {selectedExam.paperSize}
          {essayQuestions.length > 0
            ? ` · ${mcqQuestions.length} OMR + ${essayQuestions.length} Essay (${essayMaxPoints} pts)`
            : ''}
        </Text>

        {/* Sticky Import + Add Question Bar (always visible while scrolling) */}
        <View style={styles.actionRow}>
          <PillButton
            label="Import file"
            variant="outline"
            compact
            style={styles.actionBtn}
            onPress={() => setImportModalOpen(true)}
          />
          <PillButton
            label="+ Add question"
            variant="dark"
            compact
            style={styles.actionBtn}
            onPress={openAddModal}
          />
        </View>

        {/* Optional 1-tap sync notice if MCQ count differs from OMR sheet items */}
        {mcqQuestions.length > 0 && mcqQuestions.length !== selectedExam.items ? (
          <View style={styles.syncBanner}>
            <Text style={styles.syncText}>
              {mcqQuestions.length} OMR questions · Sheet set to{' '}
              {selectedExam.items} items
            </Text>
            <Pressable
              onPress={() => {
                const count = service.syncItemCountToQuestions();
                showToast(`Synced to ${count} items`);
              }}
              style={styles.syncPill}>
              <Text style={styles.syncPillText}>
                Match {mcqQuestions.length}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollList}>
        {questions.length === 0 ? (
          <View style={styles.emptyCard}>
            <OwlMascot pose="empty" size={96} />
            <Text style={styles.emptyTitle}>No questions yet</Text>
            <Text style={styles.emptySub}>
              Tap &quot;+ Add question&quot; to add Multiple Choice (OMR) or
              Essay (manual) items.
            </Text>
          </View>
        ) : (
          <View style={styles.questionList}>
            {questions.map((q, qIdx) => {
              const isEssay = q.kind === 'essay';
              return (
                <View
                  key={`${q.num}-${q.text.slice(0, 12)}`}
                  style={styles.questionCard}>
                  <View style={styles.questionHeader}>
                    <Pressable
                      onPress={() => openEditModal(qIdx)}
                      style={styles.flex}>
                      <Text style={styles.questionPrompt}>
                        {q.num}. {q.text}
                      </Text>
                    </Pressable>
                    <View style={styles.headerBadges}>
                      <Pressable
                        onPress={() => openEditModal(qIdx)}
                        style={styles.editBadge}>
                        <Text style={styles.editBadgeText}>Edit</Text>
                      </Pressable>
                      {isEssay ? (
                        <View style={styles.essayBadge}>
                          <Text style={styles.essayBadgeText}>
                            Essay · {q.maxPoints ?? 10}p
                          </Text>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => {
                            const nextKey = service.cycleQuestionAnswer(qIdx);
                            showToast(`Q${q.num} key: ${nextKey}`);
                          }}
                          style={styles.keyBadge}>
                          <Text style={styles.keyBadgeText}>
                            Key: {q.answer}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>

                  {isEssay ? (
                    <View style={styles.essayMetaBox}>
                      <Text style={styles.essayMetaText}>
                        Manual teacher check · Not scanned on OMR bubble sheet
                      </Text>
                      {q.rubric ? (
                        <Text style={styles.essayRubricText}>
                          Rubric: {q.rubric}
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.choicesGrid}>
                      {q.choices.map((choiceText, cIdx) => {
                        const letter = BUBBLE_CHOICES[cIdx];
                        const isAnswer = letter === q.answer;
                        return (
                          <Pressable
                            key={letter}
                            onPress={() =>
                              service.setQuestionAnswer(qIdx, letter)
                            }
                            style={[
                              styles.choicePill,
                              isAnswer
                                ? styles.choicePillActive
                                : styles.choicePillIdle,
                            ]}>
                            <Text
                              style={[
                                styles.choiceText,
                                isAnswer
                                  ? styles.choiceTextActive
                                  : styles.choiceTextIdle,
                              ]}>
                              <Text style={styles.choiceLetter}>
                                {letter}.{' '}
                              </Text>
                              {choiceText}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Minimalist Add / Edit Question Modal */}
      <FormModal
        visible={questionModalOpen}
        title={
          editingIndex !== null
            ? `Edit Question #${editingIndex + 1}`
            : 'New question'
        }
        subtitle="Changes automatically sync with Answer Key & Exam Paper"
        onClose={() => setQuestionModalOpen(false)}
        footer={
          <View style={styles.modalActions}>
            {editingIndex !== null ? (
              <PillButton
                label="Delete"
                variant="muted"
                onPress={handleDeleteQuestion}
              />
            ) : null}
            <PillButton
              label={editingIndex !== null ? 'Save changes' : 'Add question'}
              variant="dark"
              style={styles.flex}
              onPress={handleSaveQuestion}
            />
          </View>
        }>
        {editingIndex !== null ? (
          <View style={styles.reorderRow}>
            <Pressable
              onPress={() => handleReorder('up')}
              disabled={editingIndex === 0}
              style={[
                styles.miniToolBtn,
                editingIndex === 0 && styles.miniToolDisabled,
              ]}>
              <Text style={styles.miniToolText}>↑ Move up</Text>
            </Pressable>
            <Pressable
              onPress={() => handleReorder('down')}
              disabled={editingIndex === questions.length - 1}
              style={[
                styles.miniToolBtn,
                editingIndex === questions.length - 1 && styles.miniToolDisabled,
              ]}>
              <Text style={styles.miniToolText}>↓ Move down</Text>
            </Pressable>
            <Pressable onPress={handleDuplicate} style={styles.miniToolBtn}>
              <Text style={styles.miniToolText}>Duplicate</Text>
            </Pressable>
          </View>
        ) : null}

        <SegmentedControl<QuestionKind>
          compact
          value={questionKind}
          onChange={setQuestionKind}
          options={[
            {label: 'Multiple choice (OMR)', value: 'mcq'},
            {label: 'Essay (Manual)', value: 'essay'},
          ]}
        />

        <MinimalField
          variant="soft"
          label={questionKind === 'essay' ? 'Essay prompt' : 'Prompt'}
          value={prompt}
          onChangeText={setPrompt}
          placeholder={
            questionKind === 'essay'
              ? 'Write the essay prompt or open-ended task...'
              : 'Type the question here...'
          }
          multiline
        />

        {questionKind === 'essay' ? (
          <>
            <View style={styles.group}>
              <Text style={styles.microLabel}>MAX ESSAY POINTS</Text>
              <FilterPills<string>
                size="sm"
                value={essayPoints}
                onChange={setEssayPoints}
                options={ESSAY_POINT_PRESETS.map(p => ({
                  label: `${p} pts`,
                  value: String(p),
                }))}
              />
              <MinimalField
                variant="soft"
                label="Custom points"
                value={essayPoints}
                onChangeText={setEssayPoints}
                keyboardType="number-pad"
                placeholder="10"
              />
            </View>

            <MinimalField
              variant="soft"
              label="Rubric / grading guide (optional)"
              value={essayRubric}
              onChangeText={setEssayRubric}
              placeholder="e.g. Clarity 5 pts, Evidence 5 pts"
              multiline
            />
          </>
        ) : (
          <>
            <View style={styles.group}>
              <Text style={styles.microLabel}>CHOICES</Text>
              <View style={styles.twoCol}>
                <MinimalField
                  variant="soft"
                  prefix="A"
                  value={choiceA}
                  onChangeText={setChoiceA}
                  placeholder="First option"
                  containerStyle={styles.flex}
                />
                <MinimalField
                  variant="soft"
                  prefix="B"
                  value={choiceB}
                  onChangeText={setChoiceB}
                  placeholder="Second option"
                  containerStyle={styles.flex}
                />
              </View>
              <View style={styles.twoCol}>
                <MinimalField
                  variant="soft"
                  prefix="C"
                  value={choiceC}
                  onChangeText={setChoiceC}
                  placeholder="Third option"
                  containerStyle={styles.flex}
                />
                <MinimalField
                  variant="soft"
                  prefix="D"
                  value={choiceD}
                  onChangeText={setChoiceD}
                  placeholder="Fourth option"
                  containerStyle={styles.flex}
                />
              </View>
            </View>

            <View style={styles.group}>
              <Text style={styles.microLabel}>CORRECT ANSWER</Text>
              <FilterPills<BubbleChoice>
                size="sm"
                value={correctChoice}
                onChange={setCorrectChoice}
                options={BUBBLE_CHOICES.map(c => ({label: `Key: ${c}`, value: c}))}
              />
            </View>
          </>
        )}
      </FormModal>

      {/* Minimalist Import Questions Modal */}
      <FormModal
        visible={importModalOpen}
        title="Import questions"
        subtitle="One per line: Question | A | B | C | D | Key"
        onClose={() => setImportModalOpen(false)}
        footer={
          <View style={styles.modalActions}>
            <PillButton
              label="Cancel"
              variant="muted"
              style={styles.flex}
              onPress={() => setImportModalOpen(false)}
            />
            <PillButton
              label="Import items"
              variant="dark"
              style={styles.flex}
              onPress={handleImport}
            />
          </View>
        }>
        <MinimalField
          variant="soft"
          value={importText}
          onChangeText={setImportText}
          multiline
          style={styles.importArea}
        />
      </FormModal>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  linkPurple: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.purpleDeep,
  },
  stickyTop: {
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
    backgroundColor: Colors.canvasLight,
  },
  heading: {
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.inkMuted,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 11,
  },
  scrollList: {
    paddingTop: 4,
    paddingBottom: 32,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  syncText: {
    flex: 1,
    fontSize: 11,
    color: Colors.inkSecondary,
    fontWeight: '500',
  },
  syncPill: {
    backgroundColor: Colors.inkPrimary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.pill,
  },
  syncPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.lime,
  },
  emptyCard: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.inkMuted,
    textAlign: 'center',
  },
  questionList: {
    paddingBottom: 12,
  },
  questionCard: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editBadge: {
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  editBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkSecondary,
  },
  questionPrompt: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    color: Colors.inkPrimary,
  },
  keyBadge: {
    backgroundColor: Colors.lime,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  keyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  essayBadge: {
    backgroundColor: Colors.purpleSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  essayBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.purpleDeep,
  },
  essayMetaBox: {
    marginTop: 8,
    gap: 3,
  },
  essayMetaText: {
    fontSize: 11,
    color: Colors.inkMuted,
  },
  essayRubricText: {
    fontSize: 11,
    color: Colors.inkSecondary,
    fontStyle: 'italic',
  },
  choicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  choicePill: {
    width: '48.8%',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  choicePillActive: {
    backgroundColor: Colors.inkPrimary,
    borderColor: Colors.inkPrimary,
  },
  choicePillIdle: {
    backgroundColor: Colors.surfaceWhite,
    borderColor: Colors.hairlineLight,
  },
  choiceText: {
    fontSize: 11,
  },
  choiceTextActive: {
    color: Colors.surfaceWhite,
    fontWeight: '600',
  },
  choiceTextIdle: {
    color: Colors.inkSecondary,
  },
  choiceLetter: {
    opacity: 0.72,
  },
  reorderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  miniToolBtn: {
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radii.pill,
  },
  miniToolDisabled: {
    opacity: 0.4,
  },
  miniToolText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.inkPrimary,
  },
  group: {
    gap: 8,
  },
  microLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.7,
    color: Colors.inkSubtle,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 8,
  },
  importArea: {
    minHeight: 132,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
