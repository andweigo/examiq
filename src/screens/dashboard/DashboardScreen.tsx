import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  BellIcon,
  CalendarIcon,
  DisplayHeading,
  FilterPills,
  FormModal,
  MenuIcon,
  NotchedCard,
  OwlMascot,
  PillButton,
  ScreenLayout,
  SegmentedControl,
} from '@components/index';
import {useSidebar} from '@context/SidebarContext';
import {
  useExams,
  useProfileSettings,
  useRoster,
  useScanning,
} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';
import {
  DashboardSorter,
  DashboardSortMode,
} from '@utils/DashboardSorter';
import {ScoreCalculator} from '@utils/ScoreCalculator';

type HomeFilter = 'to-scan' | 'needs-review';
type AnalyticsBreakdownMode = 'subject' | 'section';

const SORT_OPTIONS: ReadonlyArray<{label: string; value: DashboardSortMode}> = [
  {label: 'Class / Section', value: 'section'},
  {label: 'Subject', value: 'subject'},
  {label: 'Urgent', value: 'progress'},
];

export const DashboardScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {exams, service: examService} = useExams();
  const {classes, subjects, students} = useRoster();
  const {service: scanningService} = useScanning();
  const {unreadAlertCount} = useProfileSettings();
  const {openSidebar} = useSidebar();

  const [homeTab, setHomeTab] = useState<HomeFilter>('to-scan');
  const [sortMode, setSortMode] = useState<DashboardSortMode>('section');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [breakdownMode, setBreakdownMode] =
    useState<AnalyticsBreakdownMode>('subject');

  const sortedSections = useMemo(
    () => DashboardSorter.sortSections(classes, exams, students),
    [classes, exams, students],
  );

  const sortedSubjectNames = useMemo(
    () => DashboardSorter.sortSubjectNames(subjects, exams),
    [subjects, exams],
  );

  const sortedSubjects = useMemo(
    () => DashboardSorter.sortSubjects(subjects),
    [subjects],
  );

  const activeSectionFilter =
    sectionFilter !== 'ALL' &&
    sortedSections.some(s => s.toLowerCase() === sectionFilter.toLowerCase())
      ? sectionFilter
      : 'ALL';

  const activeSubjectFilter =
    subjectFilter !== 'ALL' &&
    sortedSubjectNames.some(
      s => s.toLowerCase() === subjectFilter.toLowerCase(),
    )
      ? subjectFilter
      : 'ALL';

  const hasActiveFilters =
    activeSectionFilter !== 'ALL' || activeSubjectFilter !== 'ALL';

  const filteredExams = useMemo(() => {
    const byTab =
      homeTab === 'to-scan'
        ? exams
        : exams.filter(e => e.needsReviewCount > 0);

    return byTab.filter(e => {
      const matchSection =
        activeSectionFilter === 'ALL' ||
        e.section.trim().toLowerCase() === activeSectionFilter.toLowerCase();
      const matchSubject =
        activeSubjectFilter === 'ALL' ||
        e.subject.trim().toLowerCase() === activeSubjectFilter.toLowerCase();
      return matchSection && matchSubject;
    });
  }, [exams, homeTab, activeSectionFilter, activeSubjectFilter]);

  const examGroups = useMemo(
    () => DashboardSorter.groupExams(filteredExams, sortMode),
    [filteredExams, sortMode],
  );

  const showGroupHeaders =
    sortMode !== 'progress' &&
    (examGroups.length > 1 || sortedSections.length > 1 || sortedSubjectNames.length > 1);

  const heroMascotPose =
    homeTab === 'to-scan'
      ? 'writing'
      : filteredExams.length > 0
      ? 'reviewing'
      : 'checked';

  const filteredStudentsForSummary = useMemo(() => {
    if (activeSectionFilter === 'ALL') {
      return students;
    }
    const key = activeSectionFilter.toLowerCase();
    return students.filter(s => s.section.trim().toLowerCase() === key);
  }, [students, activeSectionFilter]);

  const summary = useMemo(
    () =>
      ScoreCalculator.summarizeClass(
        filteredStudentsForSummary.map(s => ({
          earnedPoints: s.score,
          maxPoints: s.total,
        })),
      ),
    [filteredStudentsForSummary],
  );

  const sectionSummaries = useMemo(
    () => DashboardSorter.summarizeBySection(students, classes, exams),
    [students, classes, exams],
  );

  const resetFilters = () => {
    setSectionFilter('ALL');
    setSubjectFilter('ALL');
  };

  return (
    <ScreenLayout activeTab="home">
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={openSidebar}
          accessibilityRole="button"
          accessibilityLabel="Open screens sidebar"
          style={styles.circleBtn}>
          <MenuIcon size={18} color={Colors.inkPrimary} strokeWidth={1.9} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate(RootRoute.DeviceAlerts)}
          style={styles.circleBtn}>
          <BellIcon size={17} color={Colors.inkPrimary} strokeWidth={1.8} />
          {unreadAlertCount > 0 ? <View style={styles.unreadDot} /> : null}
        </Pressable>
      </View>

      {/* Display Heading + Reactive Owl Mascot */}
      <View style={styles.heroRow}>
        <DisplayHeading lightText="Pick the next" boldText="paper to check" />
        <OwlMascot pose={heroMascotPose} size={72} />
      </View>

      {/* Segmented Toggle */}
      <SegmentedControl
        value={homeTab}
        onChange={setHomeTab}
        options={[
          {label: 'To scan', value: 'to-scan'},
          {label: 'Needs review', value: 'needs-review'},
        ]}
        style={styles.segment}
      />

      {/* Single Clean Sort & Filter Row */}
      {exams.length > 0 ? (
        <View style={styles.toolbarWrap}>
          <View style={styles.toolbarRow}>
            <Text style={styles.toolbarCount}>
              {filteredExams.length}{' '}
              {filteredExams.length === 1 ? 'exam' : 'exams'}
            </Text>

            <Pressable
              onPress={() => setSortSheetOpen(true)}
              style={({pressed}) => [
                styles.filterTrigger,
                hasActiveFilters && styles.filterTriggerActive,
                pressed && styles.pressed,
              ]}>
              <Text
                style={[
                  styles.filterTriggerText,
                  hasActiveFilters && styles.filterTriggerTextActive,
                ]}>
                {sortMode === 'section'
                  ? 'Class'
                  : sortMode === 'subject'
                  ? 'Subject'
                  : 'Urgent'}
                {hasActiveFilters
                  ? ` · ${(activeSectionFilter !== 'ALL' ? 1 : 0) + (activeSubjectFilter !== 'ALL' ? 1 : 0)} filtered`
                  : ''}{' '}
                ▾
              </Text>
            </Pressable>
          </View>

          {hasActiveFilters ? (
            <View style={styles.activeTagRow}>
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

      {/* Sorted & Grouped Notched Exam Cards */}
      <View style={styles.cardStack}>
        {exams.length === 0 ? (
          <View style={styles.allReviewedCard}>
            <OwlMascot pose="empty" size={96} />
            <Text style={styles.allReviewedTitle}>Your workspace is ready</Text>
            <Text style={styles.allReviewedSub}>
              Create your first exam or add students to start generating OMR
              sheets offline.
            </Text>
            <Pressable
              onPress={() => navigation.navigate(RootRoute.Exams)}
              style={styles.emptyCtaPill}>
              <Text style={styles.emptyCtaText}>+ Create first exam</Text>
            </Pressable>
          </View>
        ) : filteredExams.length === 0 ? (
          <View style={styles.allReviewedCard}>
            <OwlMascot pose="empty" size={96} />
            <Text style={styles.allReviewedTitle}>
              {hasActiveFilters
                ? 'No matching exams'
                : 'All papers verified'}
            </Text>
            <Text style={styles.allReviewedSub}>
              {hasActiveFilters
                ? 'Try another class, section, or subject filter.'
                : 'No flagged answers waiting for manual review.'}
            </Text>
            {hasActiveFilters ? (
              <Pressable onPress={resetFilters} style={styles.emptyCtaPill}>
                <Text style={styles.emptyCtaText}>Reset filters</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          examGroups.map(group => (
            <View key={group.groupKey} style={styles.groupBlock}>
              {showGroupHeaders ? (
                <View style={styles.groupHeaderRow}>
                  <Text style={styles.groupHeaderText}>
                    {group.label.toUpperCase()}
                  </Text>
                  <Text style={styles.groupHeaderCount}>
                    {group.exams.length}
                  </Text>
                </View>
              ) : null}
              <View style={styles.groupCards}>
                {group.exams.map(ex => {
                  const sectionStudent =
                    students.find(
                      s =>
                        s.section.trim().toLowerCase() ===
                        ex.section.trim().toLowerCase(),
                    ) ?? students[0];
                  return (
                    <NotchedCard
                      key={ex.id}
                      backgroundColor={ex.color}
                      onPress={() => {
                        examService.selectExam(ex.id);
                        scanningService.setActiveSession(
                          sectionStudent?.id ?? '',
                          ex.id,
                        );
                        navigation.navigate(RootRoute.QrScanner, {
                          examId: ex.id,
                        });
                      }}>
                      <View style={styles.examHeaderRow}>
                        <View style={styles.flex}>
                          <Text style={styles.examMeta}>
                            {ex.section} · {ex.term}
                          </Text>
                          <Text style={styles.examTitle}>{ex.subject}</Text>
                        </View>
                        <View style={styles.arrowBadge}>
                          <Text style={styles.arrowGlyph}>↗</Text>
                        </View>
                      </View>
                      <View style={styles.examFooterRow}>
                        <View style={styles.dateBadge}>
                          <CalendarIcon size={13} color={Colors.inkPrimary} />
                          <Text style={styles.dateText}>{ex.date}</Text>
                        </View>
                        <Text style={styles.progressText}>
                          {ex.scanned} / {ex.total}
                        </Text>
                      </View>
                    </NotchedCard>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </View>

      {/* Sorted Class & Subject Passing Rate Analytics */}
      <View style={styles.analyticsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Class passing rate</Text>
          <Pressable onPress={() => navigation.navigate(RootRoute.Results)}>
            <Text style={styles.viewAllLink}>View all →</Text>
          </Pressable>
        </View>

        <NotchedCard
          backgroundColor={Colors.inkPrimary}
          style={styles.overallCard}
          onPress={() => navigation.navigate(RootRoute.Results)}>
          <View style={styles.overallRow}>
            <View style={styles.flex}>
              <Text style={styles.overallLabel} numberOfLines={1}>
                {activeSectionFilter === 'ALL'
                  ? 'Overall passing (≥75%)'
                  : `${activeSectionFilter} passing (≥75%)`}
              </Text>
              <Text style={styles.overallValue}>{summary.passingRate}%</Text>
            </View>
            <Text style={styles.overallCount}>
              {summary.passedCount} / {summary.totalStudents} passed
            </Text>
          </View>
        </NotchedCard>

        {/* Breakdown Switcher: By Subject (A–Z) vs By Class / Section (Natural Order) */}
        {sortedSubjects.length > 0 || sectionSummaries.length > 0 ? (
          <View style={styles.breakdownBar}>
            <Pressable
              onPress={() => setBreakdownMode('subject')}
              style={[
                styles.breakdownTab,
                breakdownMode === 'subject' && styles.breakdownTabActive,
              ]}>
              <Text
                style={[
                  styles.breakdownTabText,
                  breakdownMode === 'subject' && styles.breakdownTabTextActive,
                ]}>
                By subject
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setBreakdownMode('section')}
              style={[
                styles.breakdownTab,
                breakdownMode === 'section' && styles.breakdownTabActive,
              ]}>
              <Text
                style={[
                  styles.breakdownTabText,
                  breakdownMode === 'section' && styles.breakdownTabTextActive,
                ]}>
                By class / section
              </Text>
            </Pressable>
          </View>
        ) : null}

        {breakdownMode === 'subject'
          ? sortedSubjects.map(sub => (
              <View key={sub.id} style={styles.subjectRow}>
                <View style={styles.subjectLeft}>
                  <View
                    style={[styles.subjectDot, {backgroundColor: sub.color}]}
                  />
                  <Text style={styles.subjectName}>{sub.name}</Text>
                </View>
                <Text style={styles.subjectRate}>{sub.passingRate}%</Text>
              </View>
            ))
          : sectionSummaries.map(row => (
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
                style={styles.subjectRow}>
                <View style={styles.subjectLeft}>
                  <View
                    style={[
                      styles.subjectDot,
                      {
                        backgroundColor:
                          row.passingRate >= 75 ? Colors.limeDeep : Colors.coral,
                      },
                    ]}
                  />
                  <Text style={styles.subjectName}>{row.section}</Text>
                </View>
                <Text style={styles.subjectRate}>
                  {row.passingRate}% ({row.passedCount}/{row.totalStudents})
                </Text>
              </Pressable>
            ))}
      </View>

      {/* Clean Sort & Filter Bottom Sheet */}
      <FormModal
        visible={sortSheetOpen}
        title="Sort & filter"
        subtitle="Organize exams by class, section, or subject"
        onClose={() => setSortSheetOpen(false)}
        footer={
          <View style={styles.modalActions}>
            {hasActiveFilters ? (
              <PillButton
                label="Reset"
                variant="muted"
                style={styles.flex}
                onPress={() => {
                  resetFilters();
                  setSortMode('section');
                }}
              />
            ) : null}
            <PillButton
              label="Done"
              variant="dark"
              style={styles.flex}
              onPress={() => setSortSheetOpen(false)}
            />
          </View>
        }>
        <View style={styles.sheetSection}>
          <Text style={styles.sheetLabel}>SORT ORDER</Text>
          <View style={styles.sortRow}>
            {SORT_OPTIONS.map(opt => {
              const active = sortMode === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setSortMode(opt.value)}
                  style={[
                    styles.sortBtn,
                    active && styles.sortBtnActive,
                  ]}>
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

        {sortedSections.length > 0 ? (
          <View style={styles.sheetSection}>
            <Text style={styles.sheetLabel}>CLASS / SECTION</Text>
            <FilterPills<string>
              size="sm"
              value={activeSectionFilter}
              onChange={setSectionFilter}
              options={[
                {label: 'All classes', value: 'ALL'},
                ...sortedSections.map(s => ({label: s, value: s})),
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
  flex: {flex: 1},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceWhite,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.coral,
    position: 'absolute',
    top: 10,
    right: 10,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
  },
  segment: {
    marginBottom: 12,
  },
  toolbarWrap: {
    gap: 8,
    marginBottom: 14,
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
  filterTrigger: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceWhite,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
  },
  filterTriggerActive: {
    backgroundColor: Colors.inkPrimary,
    borderColor: Colors.inkPrimary,
  },
  filterTriggerText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.inkPrimary,
  },
  filterTriggerTextActive: {
    color: Colors.lime,
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
  sheetSection: {
    gap: 8,
  },
  sheetLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: Colors.inkMuted,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
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
  pressed: {
    opacity: 0.8,
  },
  cardStack: {
    gap: 18,
    marginBottom: 24,
  },
  groupBlock: {
    gap: 10,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  groupHeaderText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.inkMuted,
  },
  groupHeaderCount: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.inkSubtle,
  },
  groupCards: {
    gap: 12,
  },
  allReviewedCard: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  allReviewedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  allReviewedSub: {
    fontSize: 12,
    color: Colors.inkMuted,
    textAlign: 'center',
  },
  emptyCtaPill: {
    marginTop: 8,
    backgroundColor: Colors.inkPrimary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  emptyCtaText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.lime,
  },
  examHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  examMeta: {
    fontSize: 11,
    color: Colors.inkPrimary,
    opacity: 0.78,
  },
  examTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: Colors.inkPrimary,
    marginTop: 2,
  },
  arrowBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowGlyph: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  examFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.82,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkPrimary,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkPrimary,
  },
  analyticsSection: {
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  viewAllLink: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
  overallCard: {
    marginBottom: 12,
  },
  overallRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  overallLabel: {
    fontSize: 11,
    color: Colors.inkOnDarkMuted,
  },
  overallValue: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.surfaceWhite,
    marginTop: 4,
  },
  overallCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.lime,
  },
  breakdownBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  breakdownTab: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radii.pill,
  },
  breakdownTabActive: {
    backgroundColor: Colors.surfaceMuted,
  },
  breakdownTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  breakdownTabTextActive: {
    color: Colors.inkPrimary,
    fontWeight: '700',
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  subjectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subjectName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkPrimary,
  },
  subjectRate: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
});
