import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  BackHeader,
  DisplayHeading,
  FormModal,
  MinimalField,
  NotchedCard,
  OwlMascot,
  PillButton,
  ScreenLayout,
} from '@components/index';
import {SubjectView} from '@data/database/SeedData';
import {useRoster, useToast} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';

const ACCENT_SWATCHES = [
  {label: 'Purple', color: Colors.purple},
  {label: 'Lime', color: Colors.lime},
  {label: 'Coral', color: Colors.coral},
  {label: 'Cyan', color: Colors.cyan},
] as const;

export const SubjectsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {subjects, service: rosterService} = useRoster();
  const {showToast} = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectView | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sectionsLabel, setSectionsLabel] = useState('');
  const [accentColor, setAccentColor] = useState<string>(Colors.cyan);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setCode('');
    setSectionsLabel('');
    setAccentColor(Colors.cyan);
    setModalOpen(true);
  };

  const openEdit = (sub: SubjectView) => {
    setEditing(sub);
    setName(sub.name);
    setCode(sub.code);
    setSectionsLabel(sub.sections);
    setAccentColor(sub.color);
    setModalOpen(true);
  };

  const handleSaveSubject = () => {
    if (!name.trim()) {
      showToast('Enter a subject name');
      return;
    }
    const finalCode =
      code.trim() || `${name.trim().slice(0, 3).toUpperCase()}-10`;
    if (editing) {
      rosterService.updateSubject(
        editing.id,
        name,
        finalCode,
        sectionsLabel,
        accentColor,
      );
      showToast(`Updated ${name.trim()} (${finalCode})`);
    } else {
      rosterService.addSubject(name, finalCode, sectionsLabel, accentColor);
      showToast(`Added ${name.trim()} (${finalCode})`);
    }
    setModalOpen(false);
  };

  const handleDeleteSubject = () => {
    if (!editing) {
      return;
    }
    rosterService.deleteSubject(editing.id);
    setModalOpen(false);
    showToast(`Removed ${editing.name}`);
  };

  return (
    <ScreenLayout activeTab="profile">
      <BackHeader
        onBack={() => navigation.navigate(RootRoute.Profile)}
        right={
          <Pressable onPress={openAdd}>
            <Text style={styles.actionPurple}>+ Subject</Text>
          </Pressable>
        }
      />

      <DisplayHeading
        lightText="Assigned"
        boldText="subjects"
        style={styles.heading}
      />

      <View style={styles.cards}>
        {subjects.length === 0 ? (
          <View style={styles.emptyBox}>
            <OwlMascot pose="empty" size={96} />
            <Text style={styles.emptyTitle}>No subjects assigned yet</Text>
            <Text style={styles.emptySub}>
              Tap + Subject above to add your teaching subjects.
            </Text>
          </View>
        ) : (
          subjects.map(sub => (
            <NotchedCard
              key={sub.id}
              backgroundColor={sub.color}
              onPress={() => openEdit(sub)}>
              <View style={styles.cardTop}>
                <Text style={styles.meta}>
                  {sub.code} · {sub.sections}
                </Text>
                <Text style={styles.editTag}>Edit</Text>
              </View>
              <Text style={styles.name}>{sub.name}</Text>
              <Text style={styles.rate}>Passing rate: {sub.passingRate}%</Text>
            </NotchedCard>
          ))
        )}
      </View>

      <FormModal
        visible={modalOpen}
        title={editing ? 'Edit subject' : 'New subject'}
        subtitle="Syncs subject filter pills in All Your Exams"
        onClose={() => setModalOpen(false)}
        footer={
          <View style={styles.modalActions}>
            {editing ? (
              <PillButton
                label="Delete"
                variant="muted"
                onPress={handleDeleteSubject}
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
              label={editing ? 'Save changes' : 'Add subject'}
              variant="dark"
              style={styles.flex}
              onPress={handleSaveSubject}
            />
          </View>
        }>
        <MinimalField
          label="Subject name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Filipino, Mathematics"
        />

        <View style={styles.twoCol}>
          <MinimalField
            label="Subject code"
            value={code}
            onChangeText={setCode}
            placeholder="e.g. FIL-10"
            autoCapitalize="characters"
            containerStyle={styles.flex}
          />
          <MinimalField
            label="Sections"
            value={sectionsLabel}
            onChangeText={setSectionsLabel}
            placeholder="e.g. 2 sections"
            containerStyle={styles.flex}
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.microLabel}>CARD ACCENT</Text>
          <View style={styles.swatchRow}>
            {ACCENT_SWATCHES.map(swatch => {
              const active = accentColor === swatch.color;
              return (
                <Pressable
                  key={swatch.label}
                  onPress={() => setAccentColor(swatch.color)}
                  style={[
                    styles.swatch,
                    {backgroundColor: swatch.color},
                    active && styles.swatchActive,
                  ]}
                />
              );
            })}
          </View>
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
    marginBottom: 20,
  },
  cards: {
    gap: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: {
    fontSize: 11,
    color: Colors.inkPrimary,
    opacity: 0.78,
  },
  editTag: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.inkPrimary,
    opacity: 0.72,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.inkPrimary,
    marginTop: 2,
  },
  rate: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkPrimary,
    marginTop: 16,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 16,
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
  swatchRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 2,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: {
    borderColor: Colors.inkPrimary,
    transform: [{scale: 1.08}],
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
