import React, {useState} from 'react';
import {Share, StyleSheet, Text, View} from 'react-native';
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
import {useProfileSettings, useServices, useToast} from '@hooks/index';
import {RootRoute, RootStackParamList} from '@navigation/routes';
import {Colors} from '@theme/colors';

export const BackupRestoreScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const container = useServices();
  const {backup, lastBackupSnapshotJson} = useProfileSettings();
  const {showToast} = useToast();

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreInput, setRestoreInput] = useState('');
  const [pickingBackup, setPickingBackup] = useState(false);

  const handleExportBackup = async () => {
    const snapshot = await container.createAndFlushBackupSnapshot();
    try {
      // Export portable SQLite .db so teachers can restore on any Android device
      const nativeExport = await container.persistenceEngine.exportDbBackup(
        false,
      );
      if (nativeExport) {
        showToast(
          nativeExport.savedToDownloads ? 'Backup saved' : 'Backup exported',
        );
        await container.pdfEngine.shareFile(
          nativeExport.filePath,
          'application/octet-stream',
          nativeExport.fileName,
        );
        return;
      }
      showToast('Backup exported');
      await Share.share({
        title: `examiq_backup_${new Date().getFullYear()}.db`,
        message: snapshot,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  const handlePickBackupFile = async () => {
    setPickingBackup(true);
    try {
      const picked = await container.filePickerEngine.pickBackup();
      if (!picked) {
        if (!container.filePickerEngine.isNativeAvailable()) {
          showToast('Android picker only');
        }
        return;
      }

      if (picked.format === 'json' && picked.payloadJson) {
        container.restoreBackupSnapshot(picked.payloadJson);
        container.profileSettingsService.pushAlert({
          title: `Restored backup (${picked.fileName})`,
          detail: 'Offline exams, roster, and scan history rehydrated.',
          category: 'backup',
          targetRoute: 'BackupRestore',
        });
        setRestoreOpen(false);
        showToast('Backup restored');
        return;
      }

      if (picked.format === 'sqlite' && picked.filePath) {
        const restored = await container.persistenceEngine.restoreDbFromPath(
          picked.filePath,
        );
        if (restored?.payloadJson) {
          container.restoreBackupSnapshot(restored.payloadJson);
          container.profileSettingsService.pushAlert({
            title: `Restored SQLite backup (${picked.fileName})`,
            detail: 'Offline database restored cleanly.',
            category: 'backup',
            targetRoute: 'BackupRestore',
          });
          setRestoreOpen(false);
          showToast('Backup restored');
          return;
        }
      }

      showToast('Invalid backup file');
    } catch {
      showToast('Restore failed');
    } finally {
      setPickingBackup(false);
    }
  };

  const handleRestoreLatestDb = async () => {
    try {
      const restored = await container.persistenceEngine.restoreLatestDbBackup();
      if (restored?.payloadJson) {
        container.restoreBackupSnapshot(restored.payloadJson);
        setRestoreOpen(false);
        showToast('Backup restored');
        return;
      }
    } catch {
      // Fallback to in-memory snapshot if available
    }
    if (lastBackupSnapshotJson) {
      handleRestore(lastBackupSnapshotJson);
    } else {
      showToast('No local backup file found yet');
    }
  };

  const handleRestore = (rawPayload?: string) => {
    const target = rawPayload ?? restoreInput.trim();
    if (!target) {
      showToast('Pick a backup file or paste a JSON snapshot');
      return;
    }
    try {
      container.restoreBackupSnapshot(target);
      setRestoreOpen(false);
      setRestoreInput('');
      showToast('Restored ExamIQ local database successfully');
    } catch {
      showToast('Invalid ExamIQ backup file format');
    }
  };

  return (
    <ScreenLayout activeTab="profile">
      <BackHeader onBack={() => navigation.navigate(RootRoute.Profile)} />

      <View style={styles.heroRow}>
        <DisplayHeading lightText="Backup &" boldText="restore" />
        <OwlMascot pose="checked" size={64} />
      </View>

      <NotchedCard backgroundColor={Colors.inkPrimary} style={styles.dbCard}>
        <Text style={styles.dbLabel}>Local SQLite Database</Text>
        <Text style={styles.dbSize}>{backup.databaseSizeLabel}</Text>
        <Text style={styles.dbLast}>Last backup: {backup.lastBackupLabel}</Text>
      </NotchedCard>

      <PillButton
        label="Export local backup (.db)"
        variant="dark"
        style={styles.exportBtn}
        onPress={handleExportBackup}
      />

      <PillButton
        label="Restore from file"
        variant="muted"
        onPress={() => setRestoreOpen(true)}
      />

      <FormModal
        visible={restoreOpen}
        title="Restore backup"
        subtitle="Rehydrates offline students, classes, subjects, exams, and scans"
        onClose={() => setRestoreOpen(false)}
        footer={
          <View style={styles.modalActions}>
            <PillButton
              label="Cancel"
              variant="muted"
              style={styles.flex}
              onPress={() => setRestoreOpen(false)}
            />
            <PillButton
              label="Restore JSON"
              variant="dark"
              style={styles.flex}
              onPress={() => handleRestore()}
            />
          </View>
        }>
        <PillButton
          label={
            pickingBackup
              ? 'Opening file picker...'
              : 'Browse backup file (.db / .json)'
          }
          variant="lime"
          onPress={handlePickBackupFile}
        />

        <PillButton
          label="Restore latest local .db backup"
          variant="muted"
          onPress={handleRestoreLatestDb}
        />

        <MinimalField
          variant="soft"
          label="Or paste backup snapshot JSON"
          value={restoreInput}
          onChangeText={setRestoreInput}
          placeholder='{"version":1,"exams":...}'
          multiline
          style={styles.textArea}
        />
      </FormModal>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dbCard: {
    marginBottom: 20,
  },
  dbLabel: {
    fontSize: 12,
    color: Colors.inkOnDarkMuted,
  },
  dbSize: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.surfaceWhite,
    marginTop: 4,
  },
  dbLast: {
    fontSize: 12,
    color: Colors.lime,
    marginTop: 12,
  },
  exportBtn: {
    marginBottom: 10,
  },
  textArea: {
    minHeight: 96,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
