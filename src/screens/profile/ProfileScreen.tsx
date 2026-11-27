import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  DisplayHeading,
  FormModal,
  MinimalField,
  PillButton,
  ScreenLayout,
} from '@components/index';
import {useProfileSettings, useRoster, useServices, useToast} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

export const ProfileScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const container = useServices();
  const {teacher, backup, pinHash, service: profileService} =
    useProfileSettings();
  const {classes, subjects, totalStudentRecordsCount} = useRoster();
  const {showToast} = useToast();

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(teacher.name);
  const [draftRole, setDraftRole] = useState(teacher.role);
  const [draftSchool, setDraftSchool] = useState(teacher.school);

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePinInput, setDeletePinInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const openPinModal = () => {
    setCurrentPin('');
    setPinCode('');
    setConfirmPin('');
    setPinModalOpen(true);
  };

  const closePinModal = () => {
    setCurrentPin('');
    setPinCode('');
    setConfirmPin('');
    setPinModalOpen(false);
  };

  const toggleEdit = () => {
    if (editing) {
      profileService.updateTeacherProfile(draftName, draftSchool, draftRole);
      void container.flushNow();
      showToast('Profile saved');
    } else {
      setDraftName(teacher.name);
      setDraftRole(teacher.role);
      setDraftSchool(teacher.school);
    }
    setEditing(prev => !prev);
  };

  const handleSavePin = () => {
    if (pinHash && !currentPin.trim()) {
      showToast('Enter current PIN');
      return;
    }
    if (!/^\d{4,6}$/.test(pinCode)) {
      showToast('PIN must be 4–6 digits');
      return;
    }
    if (pinCode !== confirmPin) {
      showToast('PINs do not match');
      return;
    }
    if (pinHash && currentPin.trim() === pinCode) {
      showToast('Use a different PIN');
      return;
    }
    const ok = profileService.changeDevicePin(
      pinCode,
      pinHash ? currentPin.trim() : undefined,
    );
    if (!ok) {
      void container.flushNow();
      showToast('Wrong current PIN');
      return;
    }
    void container.flushNow();
    closePinModal();
    showToast(pinHash ? 'PIN updated' : 'PIN enabled');
  };

  const handleOpenDeleteData = () => {
    setDeletePinInput('');
    setDeleteModalOpen(true);
  };

  const handleConfirmLogout = async () => {
    await container.logoutTeacherSession();
    setLogoutModalOpen(false);
    showToast('Logged out');
    navigation.reset({
      index: 0,
      routes: [{name: RootRoute.Registration}],
    });
  };

  const handleConfirmDeleteData = async () => {
    if (!pinHash) {
      setDeleteModalOpen(false);
      openPinModal();
      showToast('Set a PIN first');
      return;
    }
    if (!deletePinInput.trim()) {
      showToast('Enter device PIN');
      return;
    }
    setDeleting(true);
    try {
      const ok = await container.wipeAllDataWithPin(deletePinInput.trim());
      if (!ok) {
        showToast('Incorrect PIN');
        return;
      }
      setDeleteModalOpen(false);
      setDeletePinInput('');
      showToast('Local data erased');
      navigation.reset({
        index: 0,
        routes: [{name: RootRoute.Registration}],
      });
    } finally {
      setDeleting(false);
    }
  };

  const links: ReadonlyArray<{
    label: string;
    meta: string;
    route: RootRoute;
  }> = [
    {
      label: 'Students',
      meta: `${totalStudentRecordsCount} records`,
      route: RootRoute.Students,
    },
    {
      label: 'Classes & sections',
      meta: `${classes.length} sections`,
      route: RootRoute.Classes,
    },
    {
      label: 'Subjects',
      meta: `${subjects.length} assigned`,
      route: RootRoute.Subjects,
    },
    {
      label: 'Backup & restore',
      meta: `SQLite · ${backup.databaseSizeLabel}`,
      route: RootRoute.BackupRestore,
    },
    {
      label: 'System settings',
      meta: 'OMR, grading & privacy',
      route: RootRoute.Settings,
    },
  ];

  return (
    <ScreenLayout activeTab="profile">
      <View style={styles.headerRow}>
        <DisplayHeading lightText="Teacher" boldText="profile" />
        <Pressable onPress={toggleEdit} style={styles.editPill}>
          <Text style={styles.editPillText}>{editing ? 'Done' : 'Edit'}</Text>
        </Pressable>
      </View>

      {/* Avatar & Teacher Identity */}
      <View style={styles.identityRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{teacher.initials}</Text>
        </View>

        <View style={styles.identityContent}>
          {editing ? (
            <View style={styles.editInputs}>
              <MinimalField
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Teacher name"
                style={styles.inlineNameInput}
              />
              <MinimalField
                value={draftRole}
                onChangeText={setDraftRole}
                placeholder="Role / specialization"
                style={styles.inlineSubInput}
              />
              <MinimalField
                value={draftSchool}
                onChangeText={setDraftSchool}
                placeholder="School name"
                style={styles.inlineSubInput}
              />
            </View>
          ) : (
            <>
              <Text style={styles.teacherName} numberOfLines={1}>
                {teacher.name}
              </Text>
              <Text style={styles.teacherRole} numberOfLines={1}>
                {teacher.role}
              </Text>
              <Text style={styles.teacherSchool} numberOfLines={1}>
                {teacher.school}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Local Storage Info Row */}
      <View style={styles.storageRow}>
        <Text style={styles.storageLabel}>Local storage</Text>
        <Text style={styles.storageValue}>{teacher.deviceId}</Text>
      </View>

      {/* Management Links */}
      <View>
        {links.map(link => (
          <Pressable
            key={link.label}
            onPress={() => navigation.navigate(link.route as never)}
            style={({pressed}) => [styles.linkRow, pressed && styles.pressed]}>
            <Text style={styles.linkLabel}>{link.label}</Text>
            <Text style={styles.linkMeta}>{link.meta} ›</Text>
          </Pressable>
        ))}

        <Pressable
          onPress={openPinModal}
          style={({pressed}) => [styles.linkRow, pressed && styles.pressed]}>
          <Text style={styles.linkLabel}>
            {pinHash ? 'Change device PIN' : 'Set device PIN'}
          </Text>
          <Text style={styles.linkMeta}>{pinHash ? 'Enabled ›' : 'Off ›'}</Text>
        </Pressable>

        <Pressable
          onPress={() => setLogoutModalOpen(true)}
          style={({pressed}) => [styles.linkRow, pressed && styles.pressed]}>
          <Text style={styles.linkLabel}>Log out</Text>
          <Text style={styles.linkMeta}>
            {pinHash ? 'Lock with PIN ›' : 'Switch profile ›'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleOpenDeleteData}
          style={({pressed}) => [styles.linkRow, pressed && styles.pressed]}>
          <Text style={styles.dangerLabel}>Delete all local data</Text>
          <Text style={styles.linkMeta}>PIN required ›</Text>
        </Pressable>
      </View>

      {/* Minimalist Device PIN Modal */}
      <FormModal
        visible={pinModalOpen}
        title={pinHash ? 'Change device PIN' : 'Set device PIN'}
        subtitle={
          pinHash
            ? 'Enter your current PIN before setting a new one'
            : 'Required to protect sensitive actions like deleting local data'
        }
        onClose={closePinModal}
        footer={
          <View style={styles.modalActions}>
            <PillButton
              label="Cancel"
              variant="muted"
              style={styles.flex}
              onPress={closePinModal}
            />
            <PillButton
              label="Save PIN"
              variant="dark"
              style={styles.flex}
              onPress={handleSavePin}
            />
          </View>
        }>
        {pinHash ? (
          <MinimalField
            variant="pin"
            label="Current PIN"
            value={currentPin}
            onChangeText={setCurrentPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            placeholder="••••"
          />
        ) : null}

        <MinimalField
          variant="pin"
          label="New PIN (4–6 digits)"
          value={pinCode}
          onChangeText={setPinCode}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          placeholder="••••"
        />

        <MinimalField
          variant="pin"
          label="Confirm new PIN"
          value={confirmPin}
          onChangeText={setConfirmPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          placeholder="••••"
        />
      </FormModal>

      {/* Logout Confirmation Modal */}
      <FormModal
        visible={logoutModalOpen}
        title="Log out of session?"
        subtitle={
          pinHash
            ? 'Your exams, students, and scan history stay saved locally. Your device PIN will be required to unlock.'
            : 'Your exams, students, and scan history stay saved locally on this device.'
        }
        onClose={() => setLogoutModalOpen(false)}
        footer={
          <View style={styles.modalActions}>
            <PillButton
              label="Cancel"
              variant="muted"
              style={styles.flex}
              onPress={() => setLogoutModalOpen(false)}
            />
            <PillButton
              label="Log out"
              variant="dark"
              style={styles.flex}
              onPress={handleConfirmLogout}
            />
          </View>
        }
      />

      {/* PIN-Gated Delete All Local Data Modal */}
      <FormModal
        visible={deleteModalOpen}
        title="Delete all local data"
        subtitle={
          pinHash
            ? 'Enter your device PIN to permanently wipe SQLite records, exams, students, and scan images.'
            : 'For safety, set a 4-digit device PIN before erasing your local records.'
        }
        onClose={() => setDeleteModalOpen(false)}
        footer={
          <View style={styles.modalActions}>
            <PillButton
              label="Cancel"
              variant="muted"
              style={styles.flex}
              onPress={() => setDeleteModalOpen(false)}
            />
            <PillButton
              label={
                !pinHash
                  ? 'Set PIN first'
                  : deleting
                  ? 'Deleting...'
                  : 'Verify & delete'
              }
              variant="dark"
              style={styles.flex}
              onPress={handleConfirmDeleteData}
            />
          </View>
        }>
        {pinHash ? (
          <MinimalField
            variant="pin"
            label="Enter device PIN"
            value={deletePinInput}
            onChangeText={setDeletePinInput}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            placeholder="••••"
          />
        ) : (
          <Text style={styles.warningNote}>
            Tip: Export a local SQLite backup first if you plan to restore your
            classes later.
          </Text>
        )}
      </FormModal>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  editPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceWhite,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
  },
  editPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkPrimary,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  identityContent: {
    flex: 1,
  },
  editInputs: {
    gap: 4,
  },
  inlineNameInput: {
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 4,
  },
  inlineSubInput: {
    fontSize: 12,
    fontWeight: '400',
    paddingVertical: 4,
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  teacherRole: {
    fontSize: 12,
    color: Colors.inkMuted,
    marginTop: 1,
  },
  teacherSchool: {
    fontSize: 11,
    color: Colors.inkMuted,
    marginTop: 2,
  },
  storageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  storageLabel: {
    fontSize: 12,
    color: Colors.inkMuted,
  },
  storageValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkPrimary,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.inkPrimary,
  },
  dangerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.coralDeep,
  },
  linkMeta: {
    fontSize: 12,
    color: Colors.inkMuted,
  },
  warningNote: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.inkMuted,
  },
  pressed: {
    opacity: 0.72,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
