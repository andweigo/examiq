import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  BackHeader,
  DisplayHeading,
  FormModal,
  MinimalField,
  OwlMascot,
  PillButton,
  ScreenLayout,
} from '@components/index';
import {ClassSectionView} from '@data/database/SeedData';
import {useProfileSettings, useRoster, useToast} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';

export const ClassesScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {classes, service: rosterService} = useRoster();
  const {teacher} = useProfileSettings();
  const {showToast} = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClassSectionView | null>(null);
  const [grade, setGrade] = useState('Grade 10');
  const [section, setSection] = useState('');
  const [advisor, setAdvisor] = useState(teacher.name);

  const openAdd = () => {
    setEditing(null);
    setGrade('Grade 10');
    setSection('');
    setAdvisor(teacher.name);
    setModalOpen(true);
  };

  const openEdit = (cls: ClassSectionView) => {
    setEditing(cls);
    setGrade(cls.grade);
    setSection(cls.section);
    setAdvisor(cls.advisor);
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!section.trim()) {
      showToast('Enter a section name');
      return;
    }
    if (editing) {
      rosterService.updateClassSection(editing.id, grade, section, advisor);
      showToast(`Updated ${grade} · ${section}`);
    } else {
      rosterService.addClassSection(grade, section, advisor);
      showToast(`Added ${grade} · ${section}`);
    }
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (!editing) {
      return;
    }
    rosterService.deleteClassSection(editing.id);
    setModalOpen(false);
    showToast(`Removed ${editing.grade} · ${editing.section}`);
  };

  return (
    <ScreenLayout activeTab="profile">
      <BackHeader
        onBack={() => navigation.navigate(RootRoute.Profile)}
        right={
          <Pressable onPress={openAdd}>
            <Text style={styles.actionPurple}>+ Section</Text>
          </Pressable>
        }
      />

      <DisplayHeading
        lightText="Classes &"
        boldText="sections"
        style={styles.heading}
      />

      <View>
        {classes.length === 0 ? (
          <View style={styles.emptyBox}>
            <OwlMascot pose="empty" size={96} />
            <Text style={styles.emptyTitle}>No classes or sections yet</Text>
            <Text style={styles.emptySub}>
              Tap + Section above to create your first class section.
            </Text>
          </View>
        ) : (
          classes.map(cls => (
            <Pressable
              key={cls.id}
              onPress={() => openEdit(cls)}
              style={({pressed}) => [styles.row, pressed && styles.pressed]}>
              <View>
                <Text style={styles.title}>
                  {cls.grade} · {cls.section}
                </Text>
                <Text style={styles.meta}>Advisor: {cls.advisor}</Text>
              </View>
              <Text style={styles.count}>{cls.students} students</Text>
            </Pressable>
          ))
        )}
      </View>

      <FormModal
        visible={modalOpen}
        title={editing ? 'Edit section' : 'New section'}
        subtitle="Available immediately for exams and students"
        onClose={() => setModalOpen(false)}
        footer={
          <View style={styles.modalActions}>
            {editing ? (
              <PillButton
                label="Delete"
                variant="muted"
                onPress={handleDelete}
              />
            ) : null}
            <PillButton
              label={editing ? 'Save changes' : 'Add section'}
              variant="dark"
              style={styles.flex}
              onPress={handleSave}
            />
          </View>
        }>
        <View style={styles.twoCol}>
          <MinimalField
            label="Grade level"
            value={grade}
            onChangeText={setGrade}
            placeholder="Grade 10"
            containerStyle={styles.flex}
          />
          <MinimalField
            label="Section"
            value={section}
            onChangeText={setSection}
            placeholder="Aguinaldo"
            containerStyle={styles.flex}
          />
        </View>

        <MinimalField
          label="Class advisor"
          value={advisor}
          onChangeText={setAdvisor}
          placeholder="Advisor full name"
        />
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
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  pressed: {
    opacity: 0.72,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  meta: {
    fontSize: 12,
    color: Colors.inkMuted,
    marginTop: 2,
  },
  count: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 16,
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
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
