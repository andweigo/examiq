import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
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
import {StudentRecordView} from '@data/database/SeedData';
import {PickedSpreadsheetResult} from '@engines/backup/FilePickerEngine';
import {
  useProfileSettings,
  useRoster,
  useServices,
  useToast,
} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

const CSV_EXAMPLE_PLACEHOLDER =
  'e.g. Carlo Bautista, Grade 10 Rizal\nMikaela Cruz, Grade 10 Bonifacio';

export const StudentsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const container = useServices();
  const {teacher, service: profileService} = useProfileSettings();
  const {students, classes, service: rosterService} = useRoster();
  const {showToast} = useToast();

  const [sectionFilter, setSectionFilter] = useState('All');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'excel'>('single');
  const [newName, setNewName] = useState('');
  const [newStudentId, setNewStudentId] = useState('');
  const [newSection, setNewSection] = useState('');
  const [csvDraft, setCsvDraft] = useState('');
  const [pickedFile, setPickedFile] =
    useState<PickedSpreadsheetResult | null>(null);
  const [pickingFile, setPickingFile] = useState(false);

  const [editingStudent, setEditingStudent] =
    useState<StudentRecordView | null>(null);
  const [editStudentId, setEditStudentId] = useState('');
  const [editName, setEditName] = useState('');
  const [editSection, setEditSection] = useState('');

  const sectionLabels = useMemo(
    () => classes.map(c => `${c.grade} ${c.section}`),
    [classes],
  );

  const filterOptions = useMemo(
    () => [
      {label: 'All', value: 'All'},
      ...sectionLabels.map(label => ({
        label,
        value: label,
      })),
    ],
    [sectionLabels],
  );

  const filteredStudents =
    sectionFilter === 'All'
      ? students
      : students.filter(s => s.section === sectionFilter);

  const closeAddModal = () => {
    setAddModalOpen(false);
    setPickedFile(null);
  };

  const handlePickSpreadsheet = async () => {
    setPickingFile(true);
    try {
      const result = await container.filePickerEngine.pickSpreadsheet();
      if (!result) {
        if (!container.filePickerEngine.isNativeAvailable()) {
          showToast('Android picker only');
        }
        return;
      }
      if (result.rows.length === 0) {
        showToast('No students found');
        return;
      }
      setPickedFile(result);
      showToast(`Loaded ${result.rows.length} rows`);
    } catch {
      showToast('Could not read file');
    } finally {
      setPickingFile(false);
    }
  };

  const handleAddOrImport = () => {
    if (addMode === 'single') {
      if (!newName.trim()) {
        showToast('Enter student name');
        return;
      }
      if (newStudentId.trim() && rosterService.isStudentIdTaken(newStudentId)) {
        showToast('Student ID already used');
        return;
      }
      const created = rosterService.addStudent(
        newName,
        newSection,
        newStudentId.trim() || undefined,
      );
      setNewName('');
      setNewStudentId('');
      closeAddModal();
      showToast(`Added ${created.name}`);
      return;
    }

    if (pickedFile) {
      const summary = rosterService.importParsedStudents(
        pickedFile.rows,
        newSection,
        teacher.name,
      );
      closeAddModal();
      if (summary.addedCount === 0) {
        showToast(
          summary.skippedDuplicates > 0 ? 'All rows already exist' : 'None imported',
        );
        return;
      }
      const details: string[] = [];
      if (summary.skippedDuplicates > 0) {
        details.push(`${summary.skippedDuplicates} skipped`);
      }
      if (summary.createdSections > 0) {
        details.push(`${summary.createdSections} new section`);
      }
      showToast(`Imported ${summary.addedCount} students`);
      profileService.pushAlert({
        title: `Imported ${summary.addedCount} students from ${pickedFile.fileName}`,
        detail: details.length
          ? details.join(' · ')
          : `Added to offline roster under ${newSection}.`,
        category: 'roster',
        targetRoute: 'Students',
      });
      return;
    }

    const count = rosterService.importStudentsFromCsv(csvDraft, newSection);
    if (count === 0) {
      showToast('Pick a file or paste rows');
      return;
    }
    closeAddModal();
    showToast(`Imported ${count} students`);
  };

  const openEdit = (student: StudentRecordView) => {
    setEditingStudent(student);
    setEditStudentId(student.id);
    setEditName(student.name);
    setEditSection(student.section);
  };

  const handleSaveEdit = () => {
    if (!editingStudent) {
      return;
    }
    if (
      editStudentId.trim() &&
      rosterService.isStudentIdTaken(editStudentId, editingStudent.id)
    ) {
      showToast(`Student ID "${editStudentId.trim()}" is already used`);
      return;
    }
    rosterService.updateStudentRecord(
      editingStudent.id,
      editName,
      editSection,
      editStudentId.trim() || undefined,
    );
    setEditingStudent(null);
    showToast('Updated student record');
  };

  const handleDeleteStudent = () => {
    if (!editingStudent) {
      return;
    }
    const name = editingStudent.name;
    rosterService.deleteStudent(editingStudent.id);
    setEditingStudent(null);
    showToast(`Archived ${name}`);
  };

  const importButtonLabel =
    addMode === 'single'
      ? 'Save student'
      : pickedFile
      ? `Import ${pickedFile.rows.length} students`
      : 'Import pasted list';

  return (
    <ScreenLayout activeTab="profile">
      <BackHeader
        onBack={() => navigation.navigate(RootRoute.Profile)}
        right={
          <Pressable
            onPress={() => {
              setAddMode('single');
              setNewName('');
              setNewStudentId('');
              setNewSection(sectionLabels[0] ?? '');
              setCsvDraft('');
              setPickedFile(null);
              setAddModalOpen(true);
            }}>
            <Text style={styles.actionPurple}>+ Add / Excel</Text>
          </Pressable>
        }
      />

      <DisplayHeading
        lightText="Student"
        boldText="roster"
        style={styles.heading}
      />

      <FilterPills
        size="sm"
        options={filterOptions}
        value={sectionFilter}
        onChange={setSectionFilter}
        style={styles.filterPills}
      />

      <View>
        {filteredStudents.length === 0 ? (
          <View style={styles.emptyBox}>
            <OwlMascot pose="empty" size={96} />
            <Text style={styles.emptyTitle}>No students in this list yet</Text>
            <Text style={styles.emptySub}>
              Tap + Add / Excel above to add students manually or import a
              saved spreadsheet.
            </Text>
          </View>
        ) : (
          filteredStudents.map(student => (
            <View key={student.id} style={styles.row}>
              <View>
                <Text style={styles.name}>{student.name}</Text>
                <Text style={styles.meta}>
                  {student.id} · {student.section}
                </Text>
              </View>
              <Pressable onPress={() => openEdit(student)}>
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      {/* Minimalist Add Manual / Import Excel (.xlsx / .csv) Modal */}
      <FormModal
        visible={addModalOpen}
        title="Add students"
        subtitle="Add manually or import a saved Excel (.xlsx) / CSV class list offline"
        onClose={closeAddModal}
        footer={
          <View style={styles.modalActions}>
            <PillButton
              label="Cancel"
              variant="muted"
              style={styles.flex}
              onPress={closeAddModal}
            />
            <PillButton
              label={importButtonLabel}
              variant="dark"
              style={styles.flex}
              onPress={handleAddOrImport}
            />
          </View>
        }>
        <SegmentedControl
          compact
          value={addMode}
          onChange={mode => {
            setAddMode(mode);
            if (mode === 'single') {
              setPickedFile(null);
            }
          }}
          options={[
            {label: 'Single student', value: 'single'},
            {label: 'Excel / CSV', value: 'excel'},
          ]}
        />

        {addMode === 'single' ? (
          <>
            <MinimalField
              label="Full name"
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Marco Santos"
            />
            <MinimalField
              label="Student ID / LRN (optional)"
              value={newStudentId}
              onChangeText={setNewStudentId}
              placeholder="e.g. 2026-0007 (auto if blank)"
              autoCapitalize="characters"
            />
            <View style={styles.group}>
              <Text style={styles.microLabel}>CLASS &amp; SECTION</Text>
              <FilterPills
                size="sm"
                value={newSection}
                onChange={setNewSection}
                options={sectionLabels.map(s => ({label: s, value: s}))}
              />
            </View>
          </>
        ) : (
          <View style={styles.excelSection}>
            <PillButton
              label={
                pickingFile
                  ? 'Reading spreadsheet...'
                  : 'Pick Excel / CSV file (.xlsx, .csv)'
              }
              variant="lime"
              onPress={handlePickSpreadsheet}
            />

            {pickedFile ? (
              <View style={styles.previewCard}>
                <View style={styles.previewTop}>
                  <View style={styles.flex}>
                    <Text style={styles.previewTitle} numberOfLines={1}>
                      {pickedFile.fileName}
                    </Text>
                    <Text style={styles.previewMeta}>
                      .{pickedFile.fileType.toUpperCase()} ·{' '}
                      {pickedFile.rows.length} students detected
                    </Text>
                  </View>
                  <Pressable onPress={() => setPickedFile(null)} hitSlop={8}>
                    <Text style={styles.clearLink}>Clear</Text>
                  </Pressable>
                </View>

                <View style={styles.previewRows}>
                  {pickedFile.rows.slice(0, 4).map((row, idx) => (
                    <View
                      key={`${row.studentId || row.name}-${idx}`}
                      style={styles.previewRow}>
                      <Text style={styles.previewRowName} numberOfLines={1}>
                        {row.name}
                      </Text>
                      <Text style={styles.previewRowMeta} numberOfLines={1}>
                        {row.section || newSection}
                      </Text>
                    </View>
                  ))}
                  {pickedFile.rows.length > 4 ? (
                    <Text style={styles.previewMore}>
                      +{pickedFile.rows.length - 4} more students ready to
                      import
                    </Text>
                  ) : null}
                </View>

                <Text style={styles.previewNote}>
                  Duplicate IDs/names are skipped automatically. Missing
                  sections are created for you.
                </Text>
              </View>
            ) : (
              <MinimalField
                variant="soft"
                label="Or paste CSV lines (Full Name, Section)"
                value={csvDraft}
                onChangeText={setCsvDraft}
                placeholder={CSV_EXAMPLE_PLACEHOLDER}
                multiline
                style={styles.csvArea}
              />
            )}

            <View style={styles.group}>
              <Text style={styles.microLabel}>
                DEFAULT SECTION (IF COLUMN IS EMPTY)
              </Text>
              <FilterPills
                size="sm"
                value={newSection}
                onChange={setNewSection}
                options={sectionLabels.map(s => ({label: s, value: s}))}
              />
            </View>
          </View>
        )}
      </FormModal>

      {/* Minimalist Edit Student Modal */}
      <FormModal
        visible={editingStudent !== null}
        title="Edit student"
        subtitle={editingStudent?.id}
        onClose={() => setEditingStudent(null)}
        footer={
          <View style={styles.modalActions}>
            <PillButton
              label="Archive"
              variant="muted"
              onPress={handleDeleteStudent}
            />
            <PillButton
              label="Save changes"
              variant="dark"
              style={styles.flex}
              onPress={handleSaveEdit}
            />
          </View>
        }>
        <MinimalField
          label="Full name"
          value={editName}
          onChangeText={setEditName}
          placeholder="Student full name"
        />

        <MinimalField
          label="Student ID / LRN"
          value={editStudentId}
          onChangeText={setEditStudentId}
          placeholder="2026-0001 or LRN"
          autoCapitalize="characters"
        />

        <View style={styles.group}>
          <Text style={styles.microLabel}>CLASS &amp; SECTION</Text>
          <FilterPills
            size="sm"
            value={editSection}
            onChange={setEditSection}
            options={sectionLabels.map(s => ({label: s, value: s}))}
          />
        </View>
      </FormModal>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  actionPurple: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.purpleDeep,
  },
  heading: {
    marginBottom: 14,
  },
  filterPills: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  meta: {
    fontSize: 12,
    color: Colors.inkMuted,
    marginTop: 2,
  },
  editText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkMuted,
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
  excelSection: {
    gap: 12,
  },
  previewCard: {
    backgroundColor: Colors.canvasLight,
    borderRadius: Radii.md,
    padding: 12,
    gap: 10,
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  previewMeta: {
    fontSize: 11,
    color: Colors.limeDeep,
    fontWeight: '600',
    marginTop: 1,
  },
  clearLink: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  previewRows: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.hairlineLight,
    paddingTop: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewRowName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkPrimary,
    flex: 1,
  },
  previewRowMeta: {
    fontSize: 11,
    color: Colors.inkMuted,
  },
  previewMore: {
    fontSize: 11,
    color: Colors.purpleDeep,
    fontWeight: '600',
    marginTop: 2,
  },
  previewNote: {
    fontSize: 11,
    lineHeight: 15,
    color: Colors.inkMuted,
  },
  csvArea: {
    minHeight: 98,
  },
  emptyBox: {
    paddingVertical: 32,
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
    lineHeight: 17,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
