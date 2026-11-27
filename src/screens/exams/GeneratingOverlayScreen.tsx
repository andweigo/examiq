import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  DisplayHeading,
  OwlMascot,
  PillButton,
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
import {Radii} from '@theme/spacing';

/**
 * Generating screen triggered when saving the Answer Key.
 * Persists the key, computes the canonical OMR Alignment Overlay for the exam's
 * paper size & exact item count, and prepares student QR v2 assignments.
 */
export const GeneratingOverlayScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const container = useServices();
  const {selectedExam, answerKey, totalConfiguredPoints, service: examService} =
    useExams();
  const {sectionStudents, service: rosterService} = useRoster(
    selectedExam.section,
  );
  const {service: profileService} = useProfileSettings();
  const {qrCodec} = container;
  const {showToast} = useToast();

  const [step, setStep] = useState(0);
  const [signature, setSignature] = useState('');
  const ranRef = useRef(false);

  const paperSpec = PAPER_SIZE_MAP[selectedExam.paperSize ?? 'A4'];

  // Run the 4-step generation pipeline exactly once per mount without resetting on store updates
  useEffect(() => {
    if (ranRef.current) {
      return;
    }
    ranRef.current = true;

    const activeExam = examService.getSelectedExam();
    const activeKey = examService.getAnswerKey(activeExam.id);
    const activeStudents = rosterService.getStudentsForSection(
      activeExam.section,
    );
    const activePaperSpec = PAPER_SIZE_MAP[activeExam.paperSize ?? 'A4'];

    const timers: Array<ReturnType<typeof setTimeout>> = [];

    timers.push(setTimeout(() => setStep(1), 220));
    timers.push(
      setTimeout(() => {
        const overlay = examService.generateAlignmentOverlay(activeExam.id);
        setSignature(overlay.overlaySignature);
        setStep(2);
      }, 540),
    );
    timers.push(
      setTimeout(() => {
        const now = new Date().toISOString();
        const assignments = activeStudents.map(st => {
          const assignmentId = `${activeExam.id}-${st.id}`;
          return {
            assignmentId,
            examId: activeExam.id,
            studentId: st.id,
            qrPayload: qrCodec.encode({
              version: 2,
              assignmentId,
              examId: activeExam.id,
              studentId: st.id,
              paperSize: activeExam.paperSize,
              itemCount: activeKey.length,
            }),
            createdAt: now,
          };
        });
        examService.saveAssignments(activeExam.id, assignments);
        setStep(3);
      }, 880),
    );
    timers.push(
      setTimeout(() => {
        setStep(4);
        profileService.pushAlert({
          title: `${activePaperSpec.code} answer key overlay locked for ${activeExam.subject}`,
          detail: `${activeKey.length} items ready for printing and live stencil scanning.`,
          category: 'exam',
          targetRoute: 'ExamPaper',
          targetExamId: activeExam.id,
        });
        void container.flushNow();
        showToast(`Overlay locked (${activePaperSpec.code})`);
      }, 1200),
    );

    return () => {
      timers.forEach(t => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressPct = Math.round((step / 4) * 100);
  const ready = step >= 4;

  const steps = [
    {
      label: `1. Save answer key (${answerKey.length} items · ${totalConfiguredPoints} pts)`,
      done: step >= 1,
      value: step >= 1 ? 'Saved' : 'Saving...',
    },
    {
      label: `2. Compute ${paperSpec.code} corner & bubble overlay`,
      done: step >= 2,
      value: step >= 2 ? `${Math.ceil(answerKey.length / 2)} rows × 2 col` : 'Mapping...',
    },
    {
      label: `3. Bind offline QR v2 sheets (${sectionStudents.length} students)`,
      done: step >= 3,
      value: step >= 3 ? `${sectionStudents.length} ready` : 'Encoding...',
    },
    {
      label: '4. Lock OMR alignment overlay template',
      done: step >= 4,
      value: step >= 4 ? `#${signature.slice(0, 6)}` : 'Locking...',
    },
  ];

  return (
    <ScreenLayout dark scrollable={false} contentPadding={24}>
      <View style={styles.container}>
        <View>
          <DisplayHeading
            dark
            lightText={ready ? 'Alignment' : 'Generating'}
            boldText={ready ? 'overlay ready' : 'exam overlay'}
          />
          <Text style={styles.subtitle}>
            {selectedExam.subject} · {selectedExam.term} ·{' '}
            {paperSpec.shortLabel}
          </Text>
        </View>

        {/* Prominent Animated Mascot Checking / Building Stage */}
        <View style={styles.mascotStage}>
          <OwlMascot pose={ready ? 'checked' : 'grading'} size={118} />
          <Text style={styles.mascotCaption}>
            {ready
              ? `Locked ${paperSpec.code} overlay for ${answerKey.length} items`
              : step < 2
              ? 'Verifying answer key & computing OMR coordinates...'
              : 'Binding student QR v2 sheets & locking template...'}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, {width: `${progressPct}%`}]}
            />
          </View>
        </View>

        {/* Checklist */}
        <View style={styles.checklist}>
          {steps.map(item => (
            <View key={item.label} style={styles.row}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text
                style={item.done ? styles.rowLime : styles.rowPending}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.footerActions}>
          <PillButton
            label={ready ? 'Open exam generator →' : 'Building overlay...'}
            variant="lime"
            onPress={() => {
              if (!ready) {
                return;
              }
              navigation.replace(RootRoute.ExamGenerator, {
                examId: selectedExam.id,
              });
            }}
          />
          {ready ? (
            <PillButton
              label="Preview printable exam paper"
              variant="darkSurface"
              onPress={() =>
                navigation.replace(RootRoute.ExamPaper, {
                  examId: selectedExam.id,
                  studentId: sectionStudents[0]?.id ?? '2026-0001',
                })
              }
            />
          ) : null}
        </View>
      </View>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 22,
    paddingBottom: 20,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.inkOnDarkMuted,
    marginTop: 8,
  },
  mascotStage: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: Colors.surfaceDarkElevated,
  },
  mascotCaption: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.surfaceWhite,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radii.pill,
    backgroundColor: Colors.lime,
  },
  checklist: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineDark,
    gap: 10,
  },
  rowLabel: {
    fontSize: 12,
    color: Colors.surfaceWhite,
    flex: 1,
  },
  rowLime: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.lime,
  },
  rowPending: {
    fontSize: 12,
    color: Colors.inkOnDarkMuted,
  },
  footerActions: {
    gap: 10,
  },
});
