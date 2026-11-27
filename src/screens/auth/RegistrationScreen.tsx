import React, {ComponentRef, useRef, useState} from 'react';
import {
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SavedAccountSummary} from '@app/ServiceContainer';
import {AssetRegistry} from '@assets/index';
import {
  DisplayHeading,
  EyeIcon,
  EyeOffIcon,
  FormModal,
  MinimalField,
  PillButton,
  ScreenLayout,
} from '@components/index';
import {useProfileSettings, useServices, useToast} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';
import {Radii} from '@theme/spacing';

export const RegistrationScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const container = useServices();
  const {hasSavedProfile} = useProfileSettings();
  const {showToast} = useToast();

  const [fullName, setFullName] = useState('');
  const [school, setSchool] = useState('');
  const [role, setRole] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);

  const [unlockTarget, setUnlockTarget] = useState<SavedAccountSummary | null>(
    null,
  );
  const [unlockPinInput, setUnlockPinInput] = useState('');
  const [loginPickerOpen, setLoginPickerOpen] = useState(false);

  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreJsonDraft, setRestoreJsonDraft] = useState('');

  const savedAccounts = hasSavedProfile ? container.getSavedAccounts() : [];

  const scrollViewRef = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const schoolInputRef = useRef<ComponentRef<typeof TextInput> | null>(null);
  const roleInputRef = useRef<ComponentRef<typeof TextInput> | null>(null);
  const pinInputRef = useRef<ComponentRef<typeof TextInput> | null>(null);

  const scrollFieldIntoView = (yOffset?: number) => {
    setTimeout(() => {
      if (typeof yOffset === 'number') {
        scrollViewRef.current?.scrollTo({y: yOffset, animated: true});
      } else {
        scrollViewRef.current?.scrollToEnd({animated: true});
      }
    }, 120);
  };

  const enterDashboard = () => {
    navigation.reset({
      index: 0,
      routes: [{name: RootRoute.Dashboard}],
    });
  };

  const handleCreateProfile = async () => {
    if (saving) {
      return;
    }
    if (!fullName.trim()) {
      showToast('Enter your full name');
      return;
    }
    if (pin.trim().length > 0 && !/^\d{4,6}$/.test(pin.trim())) {
      showToast('PIN must be 4–6 digits');
      return;
    }
    setSaving(true);
    try {
      await container.registerTeacherProfile({
        name: fullName.trim(),
        school: school.trim() || 'Local School',
        role: role.trim() || 'Teacher',
        pin: pin.trim() || undefined,
      });
      showToast('Profile saved');
      enterDashboard();
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      await container.skipTeacherRegistration();
      enterDashboard();
    } finally {
      setSaving(false);
    }
  };

  const handleContinueSavedAccount = async (account: SavedAccountSummary) => {
    if (account.hasPin) {
      setUnlockPinInput('');
      setUnlockTarget(account);
      return;
    }
    const ok = await container.unlockSavedTeacherSession(
      undefined,
      account.accountId,
    );
    if (ok) {
      showToast(`Signed in: ${account.name}`);
      enterDashboard();
    }
  };

  const handleVerifyUnlockPin = async () => {
    if (!unlockTarget) {
      return;
    }
    if (!unlockPinInput.trim()) {
      showToast('Enter device PIN');
      return;
    }
    const ok = await container.unlockSavedTeacherSession(
      unlockPinInput.trim(),
      unlockTarget.accountId,
    );
    if (!ok) {
      showToast('Incorrect PIN');
      return;
    }
    const signedInName = unlockTarget.name;
    setUnlockTarget(null);
    setUnlockPinInput('');
    showToast(`Welcome, ${signedInName}`);
    enterDashboard();
  };

  const handlePickBackupFile = async () => {
    try {
      const picked = await container.filePickerEngine.pickBackup();
      if (!picked) {
        setRestoreModalOpen(true);
        return;
      }

      if (picked.format === 'json' && picked.payloadJson) {
        container.restoreBackupSnapshot(picked.payloadJson);
        showToast('Backup restored');
        enterDashboard();
        return;
      }

      if (picked.format === 'sqlite' && picked.filePath) {
        const restored = await container.persistenceEngine.restoreDbFromPath(
          picked.filePath,
        );
        if (restored?.payloadJson) {
          container.restoreBackupSnapshot(restored.payloadJson);
          showToast('Backup restored');
          enterDashboard();
          return;
        }
      }
      showToast('Invalid backup file');
    } catch {
      setRestoreModalOpen(true);
    }
  };

  const handleRestoreLatestOrPasted = async () => {
    if (restoreJsonDraft.trim()) {
      try {
        container.restoreBackupSnapshot(restoreJsonDraft.trim());
        setRestoreModalOpen(false);
        showToast('Backup restored');
        enterDashboard();
        return;
      } catch {
        showToast('Invalid backup JSON');
        return;
      }
    }

    try {
      const restored = await container.persistenceEngine.restoreLatestDbBackup();
      if (restored?.payloadJson) {
        container.restoreBackupSnapshot(restored.payloadJson);
        setRestoreModalOpen(false);
        showToast('Backup restored');
        enterDashboard();
        return;
      }
    } catch {
      // No local backup file yet
    }
    showToast('Pick a backup or paste JSON');
  };

  return (
    <ScreenLayout contentPadding={22} scrollViewRef={scrollViewRef}>
      <View style={styles.container}>
        <View>
          {/* Top Bar: Option 1 3D Logo + Restore Backup */}
          <View style={styles.topBar}>
            <Image
              source={AssetRegistry.branding.appLogo}
              style={styles.logo}
              resizeMode="cover"
            />
            <Pressable onPress={handlePickBackupFile} hitSlop={8}>
              <Text style={styles.restoreLink}>Restore backup</Text>
            </Pressable>
          </View>

          <DisplayHeading
            lightText="Create your"
            boldText="teacher profile"
            style={styles.heading}
          />
          <Text style={styles.subtitle}>
            Stored locally on this device. No internet or account required.
          </Text>

          {/* Clean Borderless White Pill Inputs with generic example hints */}
          <View style={styles.formStack}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Full name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. First and last name"
                placeholderTextColor={Colors.inkPlaceholder}
                returnKeyType="next"
                blurOnSubmit={false}
                onFocus={() => scrollFieldIntoView(80)}
                onSubmitEditing={() => schoolInputRef.current?.focus()}
                style={styles.pillInput}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>School / Institution</Text>
              <TextInput
                ref={schoolInputRef}
                value={school}
                onChangeText={setSchool}
                placeholder="e.g. High School or University"
                placeholderTextColor={Colors.inkPlaceholder}
                returnKeyType="next"
                blurOnSubmit={false}
                onFocus={() => scrollFieldIntoView(150)}
                onSubmitEditing={() => roleInputRef.current?.focus()}
                style={styles.pillInput}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Role or primary subject</Text>
              <TextInput
                ref={roleInputRef}
                value={role}
                onChangeText={setRole}
                placeholder="e.g. Subject or grade level"
                placeholderTextColor={Colors.inkPlaceholder}
                returnKeyType="next"
                blurOnSubmit={false}
                onFocus={() => scrollFieldIntoView()}
                onSubmitEditing={() => pinInputRef.current?.focus()}
                style={styles.pillInput}
              />
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.pinLabelRow}>
                <Text style={styles.fieldLabel}>4-digit device PIN</Text>
                <Text style={styles.optionalTag}>Optional lock</Text>
              </View>
              <View style={styles.pinPillRow}>
                <TextInput
                  ref={pinInputRef}
                  value={pin}
                  onChangeText={setPin}
                  placeholder="e.g. 4-digit PIN"
                  placeholderTextColor={Colors.inkPlaceholder}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  secureTextEntry={!showPin}
                  maxLength={6}
                  onFocus={() => scrollFieldIntoView()}
                  onSubmitEditing={() => Keyboard.dismiss()}
                  style={[
                    styles.pinFieldInput,
                    pin.length > 0 && styles.pinInput,
                  ]}
                />
                <Pressable
                  onPress={() => setShowPin(prev => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={showPin ? 'Hide PIN' : 'Show PIN'}
                  hitSlop={10}
                  style={styles.eyeToggleBtn}>
                  {showPin ? (
                    <EyeOffIcon size={18} color={Colors.inkMuted} />
                  ) : (
                    <EyeIcon size={18} color={Colors.inkMuted} />
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom Primary CTA + Skip */}
        <View style={styles.bottomBlock}>
          <PillButton
            label={saving ? 'Saving profile...' : 'Create local profile'}
            variant="dark"
            onPress={handleCreateProfile}
            style={styles.primaryBtn}
          />
          {savedAccounts.length > 0 ? (
            <PillButton
              label="Log in with…"
              variant="outline"
              onPress={() => setLoginPickerOpen(true)}
              style={styles.primaryBtn}
            />
          ) : null}
          <Pressable onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip for now →</Text>
          </Pressable>
        </View>
      </View>

      {/* Log in with: choose a saved account on this device */}
      <FormModal
        visible={loginPickerOpen}
        title="Log in with"
        subtitle="Choose an account saved on this device"
        onClose={() => setLoginPickerOpen(false)}>
        {savedAccounts.map(account => (
          <Pressable
            key={account.accountId}
            onPress={() => {
              setLoginPickerOpen(false);
              void handleContinueSavedAccount(account);
            }}
            style={({pressed}) => [
              styles.savedProfileCard,
              pressed && styles.pressed,
            ]}>
            <View style={styles.savedAvatar}>
              <Text style={styles.savedAvatarText}>{account.initials}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.savedName} numberOfLines={1}>
                {account.name}
              </Text>
              <Text style={styles.savedMeta} numberOfLines={1}>
                {account.school}
                {account.hasPin ? ' · PIN protected' : ''}
              </Text>
            </View>
            <Text style={styles.pickerChevron}>›</Text>
          </Pressable>
        ))}
      </FormModal>

      {/* PIN Unlock Modal for Returning Logged-Out Teacher */}
      <FormModal
        visible={unlockTarget !== null}
        title={unlockTarget ? `Unlock ${unlockTarget.name}` : 'Unlock account'}
        subtitle="Enter your device PIN to resume your isolated offline workspace"
        onClose={() => setUnlockTarget(null)}
        footer={
          <View style={styles.modalActions}>
            <PillButton
              label="Cancel"
              variant="muted"
              style={styles.flex}
              onPress={() => setUnlockTarget(null)}
            />
            <PillButton
              label="Unlock"
              variant="dark"
              style={styles.flex}
              onPress={handleVerifyUnlockPin}
            />
          </View>
        }>
        <MinimalField
          variant="pin"
          label="Device PIN"
          value={unlockPinInput}
          onChangeText={setUnlockPinInput}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          placeholder="••••"
        />
      </FormModal>

      {/* Restore Backup Modal */}
      <FormModal
        visible={restoreModalOpen}
        title="Restore local backup"
        subtitle="Import an existing ExamIQ .db or JSON backup file"
        onClose={() => setRestoreModalOpen(false)}
        footer={
          <View style={styles.modalActions}>
            <PillButton
              label="Cancel"
              variant="muted"
              style={styles.flex}
              onPress={() => setRestoreModalOpen(false)}
            />
            <PillButton
              label="Restore"
              variant="dark"
              style={styles.flex}
              onPress={handleRestoreLatestOrPasted}
            />
          </View>
        }>
        <PillButton
          label="Browse device backup file (.db)"
          variant="lime"
          onPress={handlePickBackupFile}
        />

        <MinimalField
          variant="soft"
          label="Or paste backup snapshot JSON"
          value={restoreJsonDraft}
          onChangeText={setRestoreJsonDraft}
          placeholder='{"version":1,"exams":...}'
          multiline
        />
      </FormModal>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 26,
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 12,
  },
  restoreLink: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  heading: {
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.inkMuted,
    marginBottom: 20,
  },
  savedProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairlineLight,
  },
  savedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  savedName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.inkPrimary,
  },
  savedMeta: {
    fontSize: 11.5,
    color: Colors.inkMuted,
    marginTop: 1,
  },
  pickerChevron: {
    fontSize: 22,
    color: Colors.inkSubtle,
  },
  pressed: {
    opacity: 0.8,
  },
  formStack: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  pinLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.inkSecondary,
    paddingLeft: 2,
  },
  optionalTag: {
    fontSize: 11,
    color: Colors.inkSubtle,
  },
  pillInput: {
    backgroundColor: Colors.surfaceWhite,
    borderRadius: Radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.inkPrimary,
  },
  pinPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceWhite,
    borderRadius: Radii.pill,
    paddingLeft: 18,
    paddingRight: 14,
  },
  pinFieldInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.inkPrimary,
  },
  eyeToggleBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinInput: {
    letterSpacing: 6,
  },
  bottomBlock: {
    paddingTop: 28,
    gap: 14,
  },
  primaryBtn: {
    paddingVertical: 16,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
