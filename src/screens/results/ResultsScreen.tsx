import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  DisplayHeading,
  NotchedCard,
  OwlMascot,
  PillButton,
  ScreenLayout,
  SegmentedControl,
} from '@components/index';
import {useRoster, useScanning} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {ScoreCalculator} from '@utils/ScoreCalculator';

type ResultsTab = 'analytics' | 'students';

export const ResultsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {students} = useRoster();
  const {service: scanningService} = useScanning();
  const [activeTab, setActiveTab] = useState<ResultsTab>('analytics');

  const summary = useMemo(
    () =>
      ScoreCalculator.summarizeClass(
        students.map(s => ({
          earnedPoints: s.score + (s.manualScore ?? 0),
          maxPoints: s.total + (s.manualMax ?? 0),
        })),
      ),
    [students],
  );

  const belowPassing = useMemo(
    () =>
      students.filter(
        s =>
          !ScoreCalculator.isPassing(
            s.score + (s.manualScore ?? 0),
            s.total + (s.manualMax ?? 0),
          ),
      ),
    [students],
  );

  return (
    <ScreenLayout activeTab="results">
      <View style={styles.headerRow}>
        <DisplayHeading lightText="Class" boldText="results" />
        <PillButton
          label="Reports"
          variant="dark"
          compact
          onPress={() => navigation.navigate(RootRoute.Reports)}
        />
      </View>

      <SegmentedControl
        value={activeTab}
        onChange={setActiveTab}
        options={[
          {label: 'Analytics', value: 'analytics'},
          {label: 'Student scores', value: 'students'},
        ]}
        style={styles.segment}
      />

      {activeTab === 'analytics' ? (
        <View>
          <View style={styles.kpiRow}>
            <NotchedCard backgroundColor={Colors.lime} style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Passing rate</Text>
              <Text style={styles.kpiValue}>{summary.passingRate}%</Text>
            </NotchedCard>
            <NotchedCard backgroundColor={Colors.purple} style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Mean score</Text>
              <Text style={styles.kpiValue}>{summary.meanScore}</Text>
            </NotchedCard>
          </View>

          <Text style={styles.sectionLabel}>Students below 75% passing</Text>
          {students.length === 0 ? (
            <View style={styles.allPassCard}>
              <OwlMascot pose="empty" size={96} />
              <Text style={styles.allPassText}>No results yet</Text>
              <Text style={styles.allPassSub}>
                Checked student scores and analytics will appear here.
              </Text>
            </View>
          ) : belowPassing.length === 0 ? (
            <View style={styles.allPassCard}>
              <OwlMascot pose="checked" size={58} />
              <Text style={styles.allPassText}>
                All students passed ≥75%!
              </Text>
            </View>
          ) : (
            <View>
              {belowPassing.map(student => (
                <Pressable
                  key={student.id}
                  onPress={() => {
                    scanningService.setActiveStudent(student.id);
                    navigation.navigate(RootRoute.Review, {scanId: student.id});
                  }}
                  style={({pressed}) => [
                    styles.row,
                    pressed && styles.rowPressed,
                  ]}>
                  <View>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.studentMeta}>
                      {student.section}
                      {student.manualMax
                        ? ` · OMR ${student.score}/${student.total} + Essay ${
                            student.manualScore ?? 0
                          }/${student.manualMax}`
                        : ''}
                    </Text>
                  </View>
                  <Text style={styles.failScore}>
                    {student.score + (student.manualScore ?? 0)} /{' '}
                    {student.total + (student.manualMax ?? 0)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View>
          {students.map(student => (
            <Pressable
              key={student.id}
              onPress={() => {
                scanningService.setActiveStudent(student.id);
                navigation.navigate(RootRoute.Review, {scanId: student.id});
              }}
              style={({pressed}) => [styles.row, pressed && styles.rowPressed]}>
              <View>
                <Text style={styles.studentName}>{student.name}</Text>
                <Text style={styles.studentMeta}>
                  {student.id} · {student.section}
                  {student.manualMax
                    ? ` · Essay ${student.manualScore ?? 0}/${student.manualMax}`
                    : ''}
                </Text>
              </View>
              <Text style={styles.scoreText}>
                {student.score + (student.manualScore ?? 0)} /{' '}
                {student.total + (student.manualMax ?? 0)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  segment: {
    marginBottom: 20,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
  },
  kpiLabel: {
    fontSize: 11,
    color: Colors.inkPrimary,
    opacity: 0.8,
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.inkPrimary,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.inkPrimary,
    marginBottom: 8,
  },
  allPassCard: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  allPassText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  allPassSub: {
    fontSize: 12,
    color: Colors.inkMuted,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  rowPressed: {
    opacity: 0.75,
  },
  studentName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkPrimary,
  },
  studentMeta: {
    fontSize: 12,
    color: Colors.inkMuted,
    marginTop: 2,
  },
  failScore: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.coralDeep,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
});
