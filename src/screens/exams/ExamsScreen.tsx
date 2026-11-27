import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  DisplayHeading,
  FilterPills,
  FormModal,
  MinimalField,
  NotchedCard,
  OwlMascot,
  PillButton,
  ScreenLayout,
} from '@components/index';
import {PAPER_SIZE_LIST} from '@constants/omr';
import {PaperSize} from '@core/types/common';
import {ExamCardItem} from '@data/database/SeedData';
import {useExams, useRoster, useToast} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

const ITEM_PRESETS = ['10', '16', '30', '40', '50'] as const;

export const ExamsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {exams, activeFilter, service: examService} = useExams();
  const {subjects, classes} = useRoster();
  const {showToast} = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamCardItem | null>(null);
  const [term, setTerm] = useState('');
  const [selectedSubjectName, setSelectedSubjectName] = useState(
    subjects[0]?.name ?? 'Mathematics',
  );
  const [selectedClassId, setSelectedClassId] = useState(
    classes[0]?.id ?? 'cls-1',
  );
  const [itemCount, setItemCount] = useState<string>('16');
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [dateLabel, setDateLabel] = useState('Nov 27');

  // Clean text-only subject pills (no count badges)
  const subjectFilterOptions = useMemo(() => {
    const names = Array.from(
      new Set([...subjects.map(s => s.name), ...exams.map(e => e.subject)]),
    );
    return [
      {label: 'All', value: 'All'},
      ...names.map(name => ({label: name, value: name})),
    ];
  }, [subjects, exams]);

  const effectiveFilter = subjectFilterOptions.some(
    o => o.value === activeFilter,
  )
    ? activeFilter
    : 'All';

  const filtered =
    effectiveFilter === 'All'
      ? exams
      : exams.filter(e => e.subject === effectiveFilter);

  const openCreateModal = () => {
    setEditingExam(null);
    setTerm('');
    setSelectedSubjectName(
      effectiveFilter !== 'All'
        ? effectiveFilter
        : subjects[0]?.name ?? 'Mathematics',
    );
    setSelectedClassId(classes[0]?.id ?? 'cls-1');
    setItemCount('16');
    setPaperSize('A4');
    setDateLabel('Nov 27');
    setModalOpen(true);
  };

  const openEditModal = (exam: ExamCardItem) => {
    setEditingExam(exam);
    setTerm(exam.term);
    setSelectedSubjectName(exam.subject);
    const matchedClass = classes.find(
      c => `${c.grade} ${c.section}`.toLowerCase() === exam.section.toLowerCase(),
    );
    setSelectedClassId(matchedClass?.id ?? classes[0]?.id ?? 'cls-1');
    setItemCount(String(exam.items));
    setPaperSize(exam.paperSize ?? 'A4');
    setDateLabel(exam.date);
    setModalOpen(true);
  };

  const handleSaveExam = () => {
    const matchedSubject = subjects.find(s => s.name === selectedSubjectName);
    const matchedClass = classes.find(c => c.id === selectedClassId);
    const sectionLabel = matchedClass
      ? `${matchedClass.grade} ${matchedClass.section}`
      : 'Grade 10 Rizal';

    const payload = {
      subject: selectedSubjectName,
      term: term.trim() || 'Quiz',
      section: sectionLabel,
      date: dateLabel.trim() || 'Nov 27',
      color: matchedSubject?.color ?? editingExam?.color ?? Colors.purple,
      items: Number(itemCount) || 16,
      paperSize,
      totalStudents: matchedClass?.students ?? editingExam?.total ?? 40,
    };

    if (editingExam) {
      examService.updateExam(editingExam.id, payload);
      setModalOpen(false);
      showToast(`Updated ${payload.subject} · ${payload.term}`);
      return;
    }

    const created = examService.createExam(payload);
    setModalOpen(false);
    showToast(`Created ${created.subject} · ${created.term}`);
    navigation.navigate(RootRoute.ExamBuilder, {examId: created.id});
  };

  const handleDeleteExam = () => {
    if (!editingExam) {
      return;
    }
    const label = `${editingExam.subject} · ${editingExam.term}`;
    examService.deleteExam(editingExam.id);
    setModalOpen(false);
    showToast(`Deleted ${label}`);
  };

  const handleOpenBuilderFromModal = () => {
    if (!editingExam) {
      return;
    }
    examService.selectExam(editingExam.id);
    setModalOpen(false);
    navigation.navigate(RootRoute.ExamBuilder, {examId: editingExam.id});
  };

  return (
    <ScreenLayout activeTab="exams">
      <View style={styles.headerRow}>
        <DisplayHeading lightText="All your" boldText="exams" />
        <PillButton
          label="+ New"
          variant="dark"
          compact
          onPress={openCreateModal}
        />
      </View>

      <FilterPills
        options={subjectFilterOptions}
        value={effectiveFilter}
        onChange={val => examService.setFilter(val)}
        style={styles.filterPills}
      />

      {filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <OwlMascot pose="empty" size={104} />
          <Text style={styles.emptyTitle}>No {effectiveFilter} exams yet</Text>
          <Text style={styles.emptySub}>
            Create your first offline exam and answer key for this subject.
          </Text>
          <PillButton
            label={`+ Create ${effectiveFilter} exam`}
            variant="dark"
            compact
            onPress={openCreateModal}
          />
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map(ex => (
            <NotchedCard
              key={ex.id}
              backgroundColor={ex.color}
              onPress={() => {
                examService.selectExam(ex.id);
                navigation.navigate(RootRoute.ExamGenerator, {examId: ex.id});
              }}>
              <View style={styles.cardTopRow}>
                <View style={styles.flex}>
                  <Text style={styles.cardMeta}>
                    {ex.term} · {ex.section}
                  </Text>
                  <Text style={styles.cardTitle}>{ex.subject}</Text>
                </View>

                <Pressable
                  onPress={e => {
                    e.stopPropagation();
                    openEditModal(ex);
                  }}
                  hitSlop={8}
                  style={({pressed}) => [
                    styles.editChip,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.editChipText}>Edit</Text>
                </Pressable>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.cardDate}>
                  {ex.date} · {ex.items} items · {ex.paperSize}
                </Text>
                <Text style={styles.cardCount}>
                  {ex.scanned} / {ex.total}
                </Text>
              </View>
            </NotchedCard>
          ))}
        </View>
      )}

      {/* Minimalist Create / Edit Exam Modal */}
      <FormModal
        visible={modalOpen}
        title={editingExam ? 'Edit exam' : 'New exam'}
        subtitle="Saved offline in local SQLite"
        onClose={() => setModalOpen(false)}
        footer={
          <View style={styles.footerStack}>
            {editingExam ? (
              <PillButton
                label="Edit questions & answer key →"
                variant="lime"
                onPress={handleOpenBuilderFromModal}
              />
            ) : null}
            <View style={styles.modalActions}>
              {editingExam ? (
                <PillButton
                  label="Delete"
                  variant="muted"
                  onPress={handleDeleteExam}
                />
              ) : (
                <PillButton
                  label="Cancel"
                  variant="muted"
                  style={styles.flex}
                  onPress={() => setModalOpen(false)}
                />
              )}
              <PillButton
                label={editingExam ? 'Save changes' : 'Create & build →'}
                variant="dark"
                style={styles.flex}
                onPress={handleSaveExam}
              />
            </View>
          </View>
        }>
        <View style={styles.group}>
          <Text style={styles.microLabel}>SUBJECT</Text>
          <FilterPills
            size="sm"
            value={selectedSubjectName}
            onChange={setSelectedSubjectName}
            options={subjects.map(s => ({label: s.name, value: s.name}))}
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.microLabel}>CLASS &amp; SECTION</Text>
          <FilterPills
            size="sm"
            value={selectedClassId}
            onChange={setSelectedClassId}
            options={classes.map(c => ({
              label: `${c.grade} ${c.section}`,
              value: c.id,
            }))}
          />
        </View>

        <View style={styles.twoCol}>
          <MinimalField
            label="Exam title"
            value={term}
            onChangeText={setTerm}
            placeholder="Quarterly, Quiz 4"
            containerStyle={styles.flex}
          />
          <MinimalField
            label="Date"
            value={dateLabel}
            onChangeText={setDateLabel}
            placeholder="Nov 27"
            containerStyle={styles.dateCol}
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.microLabel}>PAPER SIZE</Text>
          <FilterPills<PaperSize>
            size="sm"
            value={paperSize}
            onChange={setPaperSize}
            options={PAPER_SIZE_LIST.map(p => ({
              label: p.shortLabel,
              value: p.code,
            }))}
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.microLabel}>OMR ITEM COUNT</Text>
          <FilterPills
            size="sm"
            value={itemCount}
            onChange={setItemCount}
            options={ITEM_PRESETS.map(n => ({label: `${n} items`, value: n}))}
          />
        </View>
      </FormModal>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  dateCol: {width: 108},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  filterPills: {
    marginBottom: 16,
  },
  list: {
    gap: 14,
    paddingBottom: 12,
  },
  emptyBox: {
    paddingVertical: 34,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.inkPrimary,
    marginTop: 4,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.inkMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  editChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  editChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  pressed: {
    opacity: 0.72,
  },
  cardMeta: {
    fontSize: 11,
    color: Colors.inkPrimary,
    opacity: 0.78,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: Colors.inkPrimary,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cardDate: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkPrimary,
    opacity: 0.78,
  },
  cardCount: {
    fontSize: 12,
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
    gap: 16,
  },
  footerStack: {
    gap: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
