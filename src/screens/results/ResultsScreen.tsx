import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  DisplayHeading,
  FilterPills,
  FormModal,
  NotchedCard,
  OwlMascot,
  PillButton,
  ScreenLayout,
  SegmentedControl,
} from '@components/index';
import {useExams, useRoster, useScanning} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';
import {DashboardSorter, ResultsGroupMode} from '@utils/DashboardSorter';
import {ScoreCalculator} from '@utils/ScoreCalculator';

type ResultsTab = 'analytics' | 'students';
type StudentSortMode = 'section' | 'score-desc' | 'score-asc' | 'name';

const GROUP_OPTIONS: ReadonlyArray<{label: string; value: ResultsGroupMode}> = [
  {label: 'Section', value: 'section'},
  {label: 'Subject', value: 'subject'},
  {label: 'Year / Grade', value: 'year'},
];

const STUDENT_SORT_OPTIONS: ReadonlyArray<{
  label: string;
  value: StudentSortMode;
}> = [
  {label: 'Class', value: 'section'},
  {label: 'Highest', value: 'score-desc'},
  {label: 'Lowest', value: 'score-asc'},
  {label: 'A–Z', value: 'name'},
];

export const ResultsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {exams} = useExams();
  const {students, classes, subjects} = useRoster();
  const {service: scanningService} = useScanning();

  const [activeTab, setActiveTab] = useState<ResultsTab>('analytics');
  const [groupMode, setGroupMode] = useState<ResultsGroupMode>('section');
  const [studentSort, setStudentSort] = useState<StudentSortMode>('section');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const sortedYears = useMemo(
    () => DashboardSorter.sortYearLevels(classes, exams, students),
    [classes, exams, students],
  );

  const sortedSections = useMemo(
    () => DashboardSorter.sortSections(classes, exams, students),
    [classes, exams, students],
  );

  const sortedSubjects = useMemo(
    () => DashboardSorter.sortSubjects(subjects),
    [subjects],
  );

  const sortedSubjectNames = useMemo(
    () => DashboardSorter.sortSubjectNames(subjects, exams),
    [subjects, exams],
  );

  const activeYearFilter =
    yearFilter !== 'ALL' &&
    sortedYears.some(y => y.toLowerCase() === yearFilter.toLowerCase())
      ? yearFilter
      : 'ALL';

  const sectionsForSelectedYear = useMemo(() => {
    if (activeYearFilter === 'ALL') {
      return sortedSections;
    }
    const yearKey = activeYearFilter.toLowerCase();
    return sortedSections.filter(
      sec =>
        DashboardSorter.extractYearLevel(sec, classes).toLowerCase() ===
        yearKey,
    );
  }, [sortedSections, activeYearFilter, classes]);

  const activeSectionFilter =
    sectionFilter !== 'ALL' &&
    sectionsForSelectedYear.some(
      s => s.toLowerCase() === sectionFilter.toLowerCase(),
    )
      ? sectionFilter
      : 'ALL';

  const activeSubjectFilter =
    subjectFilter !== 'ALL' &&
    sortedSubjectNames.some(
      s => s.toLowerCase() === subjectFilter.toLowerCase(),
    )
      ? subjectFilter
      : 'ALL';

  const activeFilterCount =
    (activeYearFilter !== 'ALL' ? 1 : 0) +
    (activeSectionFilter !== 'ALL' ? 1 : 0) +
    (activeSubjectFilter !== 'ALL' ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  // Sections that have exams matching the active subject filter
  const sectionsMatchingSubject = useMemo(() => {
    if (activeSubjectFilter === 'ALL') {
      return null;
    }
    const subKey = activeSubjectFilter.toLowerCase();
    const matched = new Set<string>();
    exams.forEach(e => {
      if (e.subject.trim().toLowerCase() === subKey && e.section.trim()) {
        matched.add(e.section.trim().toLowerCase());
      }
    });
    return matched;
  }, [exams, activeSubjectFilter]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const year = DashboardSorter.extractYearLevel(s.section, classes);
      if (
        activeYearFilter !== 'ALL' &&
        year.toLowerCase() !== activeYearFilter.toLowerCase()
      ) {
        return false;
      }
      if (
        activeSectionFilter !== 'ALL' &&
        s.section.trim().toLowerCase() !== activeSectionFilter.toLowerCase()
      ) {
        return false;
      }
      if (
        sectionsMatchingSubject !== null &&
        sectionsMatchingSubject.size > 0 &&
        !sectionsMatchingSubject.has(s.section.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [
    students,
    classes,
    activeYearFilter,
    activeSectionFilter,
    sectionsMatchingSubject,
  ]);

  const sortedFilteredStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
      const pctA = ScoreCalculator.percentage(
        a.score + (a.manualScore ?? 0),
        a.total + (a.manualMax ?? 0),
      );
      const pctB = ScoreCalculator.percentage(
        b.score + (b.manualScore ?? 0),
        b.total + (b.manualMax ?? 0),
      );
      if (studentSort === 'score-desc') {
        return pctB - pctA || DashboardSorter.compareNatural(a.name, b.name);
      }
      if (studentSort === 'score-asc') {
        return pctA - pctB || DashboardSorter.compareNatural(a.name, b.name);
      }
      if (studentSort === 'name') {
        return DashboardSorter.compareNatural(a.name, b.name);
      }
      const secCmp = DashboardSorter.compareNatural(a.section, b.section);
      return secCmp !== 0
        ? secCmp
        : DashboardSorter.compareNatural(a.name, b.name);
    });
  }, [filteredStudents, studentSort]);

  const summary = useMemo(
    () =>
      ScoreCalculator.summarizeClass(
        filteredStudents.map(s => ({
          earnedPoints: s.score + (s.manualScore ?? 0),
          maxPoints: s.total + (s.manualMax ?? 0),
        })),
      ),
    [filteredStudents],
  );

  const sectionSummaries = useMemo(
    () =>
      DashboardSorter.summarizeBySection(filteredStudents, classes, exams),
    [filteredStudents, classes, exams],
  );

  const yearSummaries = useMemo(
    () => DashboardSorter.summarizeByYear(filteredStudents, classes, exams),
    [filteredStudents, classes, exams],
  );

  const subjectSummaries = useMemo(() => {
    const filtered =
      activeSubjectFilter === 'ALL'
        ? sortedSubjects
        : sortedSubjects.filter(
            s => s.name.toLowerCase() === activeSubjectFilter.toLowerCase(),
          );
    return filtered.map(sub => {
      const subExams = exams.filter(
        e => e.subject.trim().toLowerCase() === sub.name.trim().toLowerCase(),
      );
      const examSections = new Set(
        subExams.map(e => e.section.trim().toLowerCase()),
      );
      const matchedStudents =
        examSections.size > 0
          ? filteredStudents.filter(st =>
              examSections.has(st.section.trim().toLowerCase()),
            )
          : [];
      if (matchedStudents.length > 0) {
        const calc = ScoreCalculator.summarizeClass(
          matchedStudents.map(st => ({
            earnedPoints: st.score + (st.manualScore ?? 0),
            maxPoints: st.total + (st.manualMax ?? 0),
          })),
        );
        return {
          id: sub.id,
          name: sub.name,
          color: sub.color,
          passingRate: calc.passingRate,
          detail: `${calc.passedCount}/${calc.totalStudents} passed`,
        };
      }
      return {
        id: sub.id,
        name: sub.name,
        color: sub.color,
        passingRate: sub.passingRate,
        detail: sub.sections || 'All sections',
      };
    });
  }, [sortedSubjects, activeSubjectFilter, exams, filteredStudents]);

  const belowPassing = useMemo(
    () =>
      sortedFilteredStudents.filter(
        s =>
          !ScoreCalculator.isPassing(
            s.score + (s.manualScore ?? 0),
            s.total + (s.manualMax ?? 0),
          ),
      ),
    [sortedFilteredStudents],
  );

  const resetFilters = () => {
    setYearFilter('ALL');
    setSectionFilter('ALL');
    setSubjectFilter('ALL');
  };

  const activeGroupLabel =
    activeTab === 'analytics'
      ? groupMode === 'section'
        ? 'Class / Section'
        : groupMode === 'subject'
        ? 'Subject'
        : 'Year / Grade'
      : studentSort === 'section'
      ? 'Class'
      : studentSort === 'score-desc'
      ? 'Highest'
      : studentSort === 'score-asc'
      ? 'Lowest'
      : 'A–Z';

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

      {/* Minimal Borderless Sort & Filter Row */}
      {students.length > 0 || sortedSubjects.length > 0 ? (
        <View style={styles.toolbarWrap}>
          <View style={styles.toolbarRow}>
            <Text style={styles.toolbarCount}>
              {filteredStudents.length}{' '}
              {filteredStudents.length === 1 ? 'student' : 'students'}
            </Text>

            <Pressable
              onPress={() => setFilterSheetOpen(true)}
              hitSlop={8}
              style={({pressed}) => [
                styles.sortLink,
                pressed && styles.rowPressed,
              ]}>
              {hasActiveFilters ? <View style={styles.filterDot} /> : null}
              <Text style={styles.sortLinkMuted}>Sort:</Text>
              <Text style={styles.sortLinkValue}>
                {activeGroupLabel}
                {hasActiveFilters ? ` (${activeFilterCount})` : ''} ▾
              </Text>
            </Pressable>
          </View>

          {hasActiveFilters ? (
            <View style={styles.activeTagRow}>
              {activeYearFilter !== 'ALL' ? (
                <Pressable
                  onPress={() => {
                    setYearFilter('ALL');
                    setSectionFilter('ALL');
                  }}
                  style={styles.activeTag}>
                  <Text style={styles.activeTagText}>
                    {activeYearFilter} ×
                  </Text>
                </Pressable>
              ) : null}
              {activeSectionFilter !== 'ALL' ? (
                <Pressable
                  onPress={() => setSectionFilter('ALL')}
                  style={styles.activeTag}>
                  <Text style={styles.activeTagText}>
                    {activeSectionFilter} ×
                  </Text>
                </Pressable>
              ) : null}
              {activeSubjectFilter !== 'ALL' ? (
                <Pressable
                  onPress={() => setSubjectFilter('ALL')}
                  style={styles.activeTag}>
                  <Text style={styles.activeTagText}>
                    {activeSubjectFilter} ×
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

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

          {/* Sorted Passing Rate Breakdown (Per Class/Section, Subject, or Year/Grade) */}
          <View style={styles.breakdownSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>
                {groupMode === 'section'
                  ? 'Passing rate by class & section'
                  : groupMode === 'subject'
                  ? 'Passing rate by subject'
                  : 'Passing rate by year / grade'}
              </Text>
            </View>

            {groupMode === 'section' ? (
              sectionSummaries.length === 0 ? (
                <Text style={styles.mutedNote}>
                  No class section records match the active filter.
                </Text>
              ) : (
                sectionSummaries.map(row => (
                  <Pressable
                    key={row.section}
                    onPress={() =>
                      setSectionFilter(
                        activeSectionFilter.toLowerCase() ===
                          row.section.toLowerCase()
                          ? 'ALL'
                          : row.section,
                      )
                    }
                    style={({pressed}) => [
                      styles.row,
                      pressed && styles.rowPressed,
                    ]}>
                    <View style={styles.rowLeft}>
                      <View
                        style={[
                          styles.dot,
                          {
                            backgroundColor:
                              row.passingRate >= 75
                                ? Colors.limeDeep
                                : Colors.coral,
                          },
                        ]}
                      />
                      <View>
                        <Text style={styles.studentName}>{row.section}</Text>
                        <Text style={styles.studentMeta}>
                          {row.yearLevel} · {row.passedCount}/{row.totalStudents}{' '}
                          passed
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.scoreText}>{row.passingRate}%</Text>
                  </Pressable>
                ))
              )
            ) : groupMode === 'year' ? (
              yearSummaries.length === 0 ? (
                <Text style={styles.mutedNote}>
                  No year level records match the active filter.
                </Text>
              ) : (
                yearSummaries.map(row => (
                  <Pressable
                    key={row.yearLevel}
                    onPress={() =>
                      setYearFilter(
                        activeYearFilter.toLowerCase() ===
                          row.yearLevel.toLowerCase()
                          ? 'ALL'
                          : row.yearLevel,
                      )
                    }
                    style={({pressed}) => [
                      styles.row,
                      pressed && styles.rowPressed,
                    ]}>
                    <View style={styles.rowLeft}>
                      <View
                        style={[
                          styles.dot,
                          {
                            backgroundColor:
                              row.passingRate >= 75
                                ? Colors.limeDeep
                                : Colors.coral,
                          },
                        ]}
                      />
                      <View>
                        <Text style={styles.studentName}>{row.yearLevel}</Text>
                        <Text style={styles.studentMeta}>
                          {row.sectionCount}{' '}
                          {row.sectionCount === 1 ? 'section' : 'sections'} ·{' '}
                          {row.passedCount}/{row.totalStudents} passed
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.scoreText}>{row.passingRate}%</Text>
                  </Pressable>
                ))
              )
            ) : subjectSummaries.length === 0 ? (
              <Text style={styles.mutedNote}>
                No subjects match the active filter.
              </Text>
            ) : (
              subjectSummaries.map(sub => (
                <Pressable
                  key={sub.id}
                  onPress={() =>
                    setSubjectFilter(
                      activeSubjectFilter.toLowerCase() ===
                        sub.name.toLowerCase()
                        ? 'ALL'
                        : sub.name,
                    )
                  }
                  style={({pressed}) => [
                    styles.row,
                    pressed && styles.rowPressed,
                  ]}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.dot, {backgroundColor: sub.color}]} />
                    <View>
                      <Text style={styles.studentName}>{sub.name}</Text>
                      <Text style={styles.studentMeta}>{sub.detail}</Text>
                    </View>
                  </View>
                  <Text style={styles.scoreText}>{sub.passingRate}%</Text>
                </Pressable>
              ))
            )}
          </View>

          <Text style={styles.sectionLabel}>Students below 75% passing</Text>
          {filteredStudents.length === 0 ? (
            <View style={styles.allPassCard}>
              <OwlMascot pose="empty" size={96} />
              <Text style={styles.allPassText}>
                {hasActiveFilters ? 'No matching students' : 'No results yet'}
              </Text>
              <Text style={styles.allPassSub}>
                {hasActiveFilters
                  ? 'Try clearing or changing your year, section, or subject filter.'
                  : 'Checked student scores and analytics will appear here.'}
              </Text>
              {hasActiveFilters ? (
                <Pressable onPress={resetFilters} style={styles.resetPill}>
                  <Text style={styles.resetPillText}>Reset filters</Text>
                </Pressable>
              ) : null}
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
                  <View style={styles.flex}>
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
      ) : sortedFilteredStudents.length === 0 ? (
        <View style={styles.allPassCard}>
          <OwlMascot pose="empty" size={96} />
          <Text style={styles.allPassText}>
            {hasActiveFilters ? 'No matching students' : 'No student scores yet'}
          </Text>
          <Text style={styles.allPassSub}>
            {hasActiveFilters
              ? 'Try another year, section, or subject filter.'
              : 'Scan papers to record student scores offline.'}
          </Text>
          {hasActiveFilters ? (
            <Pressable onPress={resetFilters} style={styles.resetPill}>
              <Text style={styles.resetPillText}>Reset filters</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View>
          {sortedFilteredStudents.map(student => (
            <Pressable
              key={student.id}
              onPress={() => {
                scanningService.setActiveStudent(student.id);
                navigation.navigate(RootRoute.Review, {scanId: student.id});
              }}
              style={({pressed}) => [styles.row, pressed && styles.rowPressed]}>
              <View style={styles.flex}>
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

      {/* Sort & Filter Sheet for Year, Section, Class & Subject */}
      <FormModal
        visible={filterSheetOpen}
        title="Sort & filter results"
        subtitle="Break down passing rates by year, section, or subject"
        onClose={() => setFilterSheetOpen(false)}
        footer={
          <View style={styles.modalActions}>
            {hasActiveFilters ? (
              <PillButton
                label="Reset"
                variant="muted"
                style={styles.flex}
                onPress={() => {
                  resetFilters();
                  setGroupMode('section');
                  setStudentSort('section');
                }}
              />
            ) : null}
            <PillButton
              label="Done"
              variant="dark"
              style={styles.flex}
              onPress={() => setFilterSheetOpen(false)}
            />
          </View>
        }>
        {activeTab === 'analytics' ? (
          <View style={styles.sheetSection}>
            <Text style={styles.sheetLabel}>GROUP PASSING RATE BY</Text>
            <View style={styles.sortRow}>
              {GROUP_OPTIONS.map(opt => {
                const active = groupMode === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setGroupMode(opt.value)}
                    style={[styles.sortBtn, active && styles.sortBtnActive]}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.sortBtnText,
                        active && styles.sortBtnTextActive,
                      ]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.sheetSection}>
            <Text style={styles.sheetLabel}>SORT STUDENTS BY</Text>
            <View style={styles.sortRow}>
              {STUDENT_SORT_OPTIONS.map(opt => {
                const active = studentSort === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setStudentSort(opt.value)}
                    style={[styles.sortBtn, active && styles.sortBtnActive]}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.sortBtnText,
                        active && styles.sortBtnTextActive,
                      ]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {sortedYears.length > 0 ? (
          <View style={styles.sheetSection}>
            <Text style={styles.sheetLabel}>YEAR / GRADE LEVEL</Text>
            <FilterPills<string>
              size="sm"
              value={activeYearFilter}
              onChange={nextYear => {
                setYearFilter(nextYear);
                setSectionFilter('ALL');
              }}
              options={[
                {label: 'All years', value: 'ALL'},
                ...sortedYears.map(y => ({label: y, value: y})),
              ]}
            />
          </View>
        ) : null}

        {sectionsForSelectedYear.length > 0 ? (
          <View style={styles.sheetSection}>
            <Text style={styles.sheetLabel}>CLASS / SECTION</Text>
            <FilterPills<string>
              size="sm"
              value={activeSectionFilter}
              onChange={setSectionFilter}
              options={[
                {label: 'All sections', value: 'ALL'},
                ...sectionsForSelectedYear.map(s => ({label: s, value: s})),
              ]}
            />
          </View>
        ) : null}

        {sortedSubjectNames.length > 0 ? (
          <View style={styles.sheetSection}>
            <Text style={styles.sheetLabel}>SUBJECT</Text>
            <FilterPills<string>
              size="sm"
              value={activeSubjectFilter}
              onChange={setSubjectFilter}
              options={[
                {label: 'All subjects', value: 'ALL'},
                ...sortedSubjectNames.map(s => ({label: s, value: s})),
              ]}
            />
          </View>
        ) : null}
      </FormModal>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  segment: {
    marginBottom: 12,
  },
  toolbarWrap: {
    gap: 8,
    marginBottom: 16,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  toolbarCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  sortLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.coral,
  },
  sortLinkMuted: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
  sortLinkValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  activeTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  activeTag: {
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  activeTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.inkPrimary,
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
  breakdownSection: {
    marginBottom: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.inkPrimary,
    marginBottom: 8,
  },
  mutedNote: {
    fontSize: 12,
    color: Colors.inkMuted,
    paddingVertical: 10,
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
  resetPill: {
    marginTop: 8,
    backgroundColor: Colors.inkPrimary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radii.pill,
  },
  resetPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.lime,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
    fontSize: 11,
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
  sheetSection: {
    gap: 8,
  },
  sheetLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: Colors.inkMuted,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sortBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceWhite,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortBtnActive: {
    backgroundColor: Colors.inkPrimary,
    borderColor: Colors.inkPrimary,
  },
  sortBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.inkSecondary,
  },
  sortBtnTextActive: {
    color: Colors.surfaceWhite,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
});
