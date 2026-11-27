import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  DisplayHeading,
  OwlMascot,
  PillButton,
  ScreenLayout,
} from '@components/index';
import {useExams, useRoster, useScanning} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

export const AutoCheckScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {selectedExam} = useExams();
  const {students} = useRoster();
  const {activeStudentId, flaggedTileNumbers} = useScanning();

  const [stage, setStage] = useState(0);

  const activeStudent = students.find(s => s.id === activeStudentId) ??
    students[0] ?? {
      id: 'UNASSIGNED',
      name: 'No student yet',
      section: selectedExam.section,
      score: 0,
      total: selectedExam.items,
      status: 'Pending',
    };
  const itemCount = Math.max(1, selectedExam.items);

  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [
      setTimeout(() => setStage(1), 260),
      setTimeout(() => setStage(2), 620),
      setTimeout(() => setStage(3), 980),
      setTimeout(() => setStage(4), 1300),
    ];

    return () => {
      timers.forEach(t => clearTimeout(t));
    };
  }, []);

  const isDone = stage >= 4;
  const progressPct = Math.round((stage / 4) * 100);

  const mascotPose = !isDone
    ? 'grading'
    : flaggedTileNumbers.length > 0
    ? 'reviewing'
    : 'checked';

  const statusCaption =
    stage === 0
      ? 'Aligning corner registration marks...'
      : stage === 1
      ? `Scanning ${itemCount} shaded bubbles...`
      : stage === 2
      ? 'Comparing answers against local SQLite key...'
      : stage === 3
      ? 'Double-checking blanks and conflicts...'
      : flaggedTileNumbers.length > 0
      ? `Checked! ${flaggedTileNumbers.length} item${
          flaggedTileNumbers.length === 1 ? '' : 's'
        } need quick verification`
      : `All ${itemCount} items checked cleanly!`;

  const flaggedLabel =
    flaggedTileNumbers.length > 0
      ? `${flaggedTileNumbers.length} items (${flaggedTileNumbers
          .slice(0, 4)
          .map(n => `#${n}`)
          .join(', ')}${flaggedTileNumbers.length > 4 ? '…' : ''})`
      : '0 items';

  return (
    <ScreenLayout dark scrollable={false} contentPadding={24}>
      <View style={styles.container}>
        <View>
          <DisplayHeading
            dark
            lightText={isDone ? 'Checking' : 'Automated'}
            boldText={isDone ? 'complete' : 'checking'}
          />
          <Text style={styles.subtitle}>
            {activeStudent.name} · {selectedExam.subject} · Offline SQLite key
          </Text>
        </View>

        {/* Animated Checking Mascot Hero Stage */}
        <View style={styles.mascotStage}>
          <OwlMascot pose={mascotPose} size={122} />
          <Text style={styles.mascotCaption}>{statusCaption}</Text>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {width: `${progressPct}%`}]} />
          </View>
        </View>

        <View style={styles.checklist}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>1. Perspective alignment</Text>
            <Text style={stage >= 1 ? styles.rowLime : styles.rowPending}>
              {stage >= 1 ? 'Done' : 'Running...'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>
              2. Shaded bubble detection ({itemCount} items)
            </Text>
            <Text style={stage >= 2 ? styles.rowLime : styles.rowPending}>
              {stage >= 2 ? 'Done' : 'Reading...'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>
              3. Compare with local answer key
            </Text>
            <Text style={stage >= 3 ? styles.rowLime : styles.rowPending}>
              {stage >= 3
                ? `${activeStudent.score} / ${activeStudent.total}`
                : 'Scoring...'}
            </Text>
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.rowLabel}>
              4. Flagged for manual verification
            </Text>
            <Text style={stage >= 4 ? styles.rowCoral : styles.rowPending}>
              {stage >= 4 ? flaggedLabel : 'Checking...'}
            </Text>
          </View>
        </View>

        <PillButton
          label={
            isDone
              ? 'Review checked answers →'
              : 'Checking student answer sheet...'
          }
          variant="lime"
          onPress={() => {
            if (!isDone) {
              return;
            }
            navigation.navigate(RootRoute.Review, {
              scanId: `scan-${activeStudent.id}`,
            });
          }}
        />
      </View>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 18,
    paddingBottom: 20,
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineDark,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 12,
    color: Colors.surfaceWhite,
    flex: 1,
    paddingRight: 8,
  },
  rowLime: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.lime,
  },
  rowPending: {
    fontSize: 12,
    color: Colors.inkOnDarkMuted,
  },
  rowCoral: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.coral,
  },
});
