import {ObservableStore} from '@core/base/ObservableStore';
import {OmrSensitivity} from '@core/types/common';
import {
  AlertCategory,
  BackupStatusView,
  DeviceAlertView,
  DeviceSettingsView,
  ExportHistoryView,
  INITIAL_ALERTS,
  INITIAL_BACKUP_STATUS,
  INITIAL_EXPORTS,
  INITIAL_SETTINGS,
  INITIAL_TEACHER,
  TeacherProfileView,
} from '@data/database/SeedData';
import {ChecksumUtil} from '@utils/ChecksumUtil';
import {DateFormatter} from '@utils/DateFormatter';
import {IdGenerator} from '@utils/IdGenerator';

export interface PushAlertOptions {
  readonly title: string;
  readonly detail?: string;
  readonly category?: AlertCategory;
  readonly targetRoute?: string;
  readonly targetExamId?: string;
  readonly targetStudentId?: string;
}

export interface ProfileSettingsState {
  readonly activeAccountId: string | null;
  readonly isRegistered: boolean;
  readonly hasSavedProfile: boolean;
  readonly teacher: TeacherProfileView;
  readonly settings: DeviceSettingsView;
  readonly alerts: DeviceAlertView[];
  readonly exports: ExportHistoryView[];
  readonly backup: BackupStatusView;
  readonly pinHash: string | null;
  readonly lastBackupSnapshotJson: string | null;
  readonly lastBackupAtIso: string | null;
}

function buildInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (name.trim().slice(0, 2) || 'TC').toUpperCase();
}

/**
 * OOP Application Service for Teacher Registration, Multi-Account Session State,
 * Profile, Device PIN, Settings, Local Backups, Exports, and Deep-Linked Alerts.
 */
export class ProfileSettingsService extends ObservableStore<ProfileSettingsState> {
  constructor() {
    super({
      activeAccountId: null,
      isRegistered: false,
      hasSavedProfile: false,
      teacher: {...INITIAL_TEACHER},
      settings: {...INITIAL_SETTINGS},
      alerts: INITIAL_ALERTS.map(a => ({...a})),
      exports: INITIAL_EXPORTS.map(e => ({...e})),
      backup: {...INITIAL_BACKUP_STATUS},
      pinHash: null,
      lastBackupSnapshotJson: null,
      lastBackupAtIso: null,
    });
  }

  public startFreshAccountProfile(
    accountId: string,
    input: {
      name: string;
      school: string;
      role: string;
      pin?: string;
    },
  ): void {
    const cleanName = input.name.trim() || 'Teacher';
    const cleanSchool = input.school.trim() || 'Local School';
    const cleanRole = input.role.trim() || 'Teacher';
    const currentDeviceId = this.getState().teacher.deviceId;
    const currentDbSize = this.getState().backup.databaseSizeLabel;
    const cleanPin = input.pin?.trim();
    const pinHash =
      cleanPin && /^\d{4,6}$/.test(cleanPin)
        ? ChecksumUtil.compute(`EXAMIQ_PIN|${cleanPin}`)
        : null;

    const welcomeAlerts: DeviceAlertView[] = [
      {
        id: IdGenerator.nextPrefixedId('alert'),
        title: `Welcome, ${cleanName} — offline workspace ready`,
        detail:
          'Add your classes, students, and exams. Everything is saved privately in local SQLite.',
        time: 'Just now',
        unread: true,
        category: 'security',
        targetRoute: 'Profile',
      },
    ];

    if (pinHash) {
      welcomeAlerts.unshift({
        id: IdGenerator.nextPrefixedId('alert'),
        title: 'Device PIN lock enabled',
        detail: 'Your account & local data deletion are protected by your PIN.',
        time: 'Just now',
        unread: true,
        category: 'security',
        targetRoute: 'Profile',
      });
    }

    this.setState({
      activeAccountId: accountId,
      isRegistered: true,
      hasSavedProfile: true,
      teacher: {
        name: cleanName,
        initials: buildInitials(cleanName),
        role: cleanRole,
        school: cleanSchool,
        email: `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@school.local`,
        deviceId: currentDeviceId,
      },
      settings: {...INITIAL_SETTINGS},
      alerts: welcomeAlerts,
      exports: [],
      backup: {
        databaseSizeLabel: currentDbSize,
        lastBackupLabel: 'Not backed up yet',
      },
      pinHash,
      lastBackupSnapshotJson: null,
      lastBackupAtIso: null,
    });
  }

  public completeRegistration(input: {
    name: string;
    school: string;
    role: string;
    pin?: string;
  }): void {
    this.updateTeacherProfile(input.name, input.school, input.role);
    if (input.pin && /^\d{4,6}$/.test(input.pin.trim())) {
      this.setDevicePin(input.pin.trim());
    }
    this.setState(prev => ({
      ...prev,
      activeAccountId: prev.activeAccountId ?? IdGenerator.nextPrefixedId('acc'),
      isRegistered: true,
      hasSavedProfile: true,
    }));
  }

  public skipRegistration(accountId = 'acc-demo'): void {
    this.setState(prev => ({
      ...prev,
      activeAccountId: accountId,
      isRegistered: true,
      hasSavedProfile: true,
    }));
  }

  /**
   * Locks/logs out the active teacher session without erasing their saved account vault.
   */
  public logoutSession(stillHasSavedAccounts = true): void {
    const currentDeviceId = this.getState().teacher.deviceId;
    const currentDbSize = this.getState().backup.databaseSizeLabel;
    this.setState({
      activeAccountId: null,
      isRegistered: false,
      hasSavedProfile: stillHasSavedAccounts,
      teacher: {
        ...INITIAL_TEACHER,
        name: 'Signed out',
        initials: '--',
        role: '',
        school: '',
        deviceId: currentDeviceId,
      },
      settings: {...INITIAL_SETTINGS},
      alerts: [],
      exports: [],
      backup: {
        databaseSizeLabel: currentDbSize,
        lastBackupLabel: 'Not backed up yet',
      },
      pinHash: null,
      lastBackupSnapshotJson: null,
      lastBackupAtIso: null,
    });
  }

  public unlockSavedSession(rawPin?: string): boolean {
    const state = this.getState();
    if (!state.hasSavedProfile) {
      return false;
    }
    if (state.pinHash) {
      if (!rawPin || !this.verifyDevicePin(rawPin)) {
        return false;
      }
    }
    this.setState(prev => ({...prev, isRegistered: true}));
    return true;
  }

  public verifyDevicePin(rawPin: string): boolean {
    const currentHash = this.getState().pinHash;
    if (!currentHash) {
      return false;
    }
    return ChecksumUtil.compute(`EXAMIQ_PIN|${rawPin.trim()}`) === currentHash;
  }

  public static verifyPinAgainstHash(rawPin: string, pinHash: string | null): boolean {
    if (!pinHash) {
      return true;
    }
    return ChecksumUtil.compute(`EXAMIQ_PIN|${rawPin.trim()}`) === pinHash;
  }

  public resetAllData(stillHasOtherAccounts = false): void {
    const currentDeviceId = this.getState().teacher.deviceId;
    this.setState({
      activeAccountId: null,
      isRegistered: false,
      hasSavedProfile: stillHasOtherAccounts,
      teacher: {...INITIAL_TEACHER, deviceId: currentDeviceId},
      settings: {...INITIAL_SETTINGS},
      alerts: INITIAL_ALERTS.map(a => ({...a})),
      exports: INITIAL_EXPORTS.map(e => ({...e})),
      backup: {...INITIAL_BACKUP_STATUS},
      pinHash: null,
      lastBackupSnapshotJson: null,
      lastBackupAtIso: null,
    });
  }

  public updateTeacherProfile(
    name: string,
    school: string,
    role?: string,
  ): void {
    const trimmedName = name.trim() || this.getState().teacher.name;
    const trimmedSchool = school.trim() || this.getState().teacher.school;
    const trimmedRole = role?.trim() || this.getState().teacher.role;

    this.setState(prev => ({
      ...prev,
      teacher: {
        ...prev.teacher,
        name: trimmedName,
        school: trimmedSchool,
        role: trimmedRole,
        initials: buildInitials(trimmedName),
      },
    }));
  }

  public setDevicePin(rawPin: string): void {
    const hadPin = Boolean(this.getState().pinHash);
    const hash = ChecksumUtil.compute(`EXAMIQ_PIN|${rawPin.trim()}`);
    this.setState(prev => ({...prev, pinHash: hash}));
    this.pushAlert({
      title: hadPin ? 'Device PIN updated' : 'Device PIN lock enabled',
      detail: 'Required before erasing local data or unlocking after logout.',
      category: 'security',
      targetRoute: 'Profile',
    });
  }

  /**
   * Changes the device PIN, strictly requiring the existing PIN first whenever one is already set.
   */
  public changeDevicePin(newPin: string, currentPin?: string): boolean {
    const hasExistingPin = Boolean(this.getState().pinHash);
    if (hasExistingPin) {
      if (!currentPin || !this.verifyDevicePin(currentPin)) {
        this.pushAlert({
          title: 'Failed PIN change attempt',
          detail: 'Incorrect current PIN entered while trying to change device PIN.',
          category: 'security',
          targetRoute: 'Profile',
        });
        return false;
      }
    }
    this.setDevicePin(newPin);
    return true;
  }

  public toggleSetting(
    key: keyof Omit<DeviceSettingsView, 'omrSensitivity'>,
  ): void {
    this.setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [key]: !prev.settings[key],
      },
    }));
  }

  public setAutoCapture(enabled: boolean): void {
    this.setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        autoCapture: enabled,
      },
    }));
  }

  public setOmrSensitivity(sensitivity: OmrSensitivity): void {
    this.setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        omrSensitivity: sensitivity,
      },
    }));
  }

  public markAlertRead(alertId: string): void {
    this.setState(prev => ({
      ...prev,
      alerts: prev.alerts.map(a =>
        a.id === alertId ? {...a, unread: false} : a,
      ),
    }));
  }

  public markAllAlertsRead(): void {
    this.setState(prev => ({
      ...prev,
      alerts: prev.alerts.map(a => ({...a, unread: false})),
    }));
  }

  public dismissAlert(alertId: string): void {
    this.setState(prev => ({
      ...prev,
      alerts: prev.alerts.filter(a => a.id !== alertId),
    }));
  }

  public clearReadAlerts(): void {
    this.setState(prev => ({
      ...prev,
      alerts: prev.alerts.filter(a => a.unread),
    }));
  }

  public pushAlert(input: string | PushAlertOptions): void {
    const opts: PushAlertOptions =
      typeof input === 'string' ? {title: input} : input;
    const alert: DeviceAlertView = {
      id: IdGenerator.nextPrefixedId('alert'),
      title: opts.title,
      detail: opts.detail,
      time: DateFormatter.toShortTime(new Date().toISOString()),
      unread: true,
      category: opts.category ?? 'exam',
      targetRoute: opts.targetRoute,
      targetExamId: opts.targetExamId,
      targetStudentId: opts.targetStudentId,
    };
    this.setState(prev => ({
      ...prev,
      alerts: [alert, ...prev.alerts].slice(0, 40),
    }));
  }

  /**
   * Checks whether weekly local SQLite backup is overdue (>7 days) when enabled in settings.
   */
  public evaluateWeeklyBackupReminder(): void {
    const state = this.getState();
    if (!state.isRegistered || !state.settings.autoLocalBackup) {
      return;
    }
    const alreadyReminded = state.alerts.some(
      a => a.unread && a.category === 'backup' && a.title.includes('backup reminder'),
    );
    if (alreadyReminded) {
      return;
    }
    if (!state.lastBackupAtIso) {
      return;
    }
    const elapsedDays =
      (Date.now() - new Date(state.lastBackupAtIso).getTime()) /
      (1000 * 60 * 60 * 24);
    if (elapsedDays >= 7) {
      this.pushAlert({
        title: 'Weekly SQLite backup reminder',
        detail: `Last local backup was ${Math.floor(elapsedDays)} days ago. Export a fresh .db copy to Downloads.`,
        category: 'backup',
        targetRoute: 'BackupRestore',
      });
    }
  }

  public recordExport(fileName: string): void {
    const entry: ExportHistoryView = {
      id: IdGenerator.nextPrefixedId('exp'),
      fileName,
      date: DateFormatter.toShortTime(new Date().toISOString()),
    };
    this.setState(prev => ({
      ...prev,
      exports: [entry, ...prev.exports],
    }));
  }

  public recordLocalBackup(snapshotJson?: string): void {
    const nowIso = new Date().toISOString();
    const nowLabel = `Today, ${DateFormatter.toShortTime(nowIso)}`;
    this.setState(prev => ({
      ...prev,
      backup: {
        ...prev.backup,
        lastBackupLabel: nowLabel,
      },
      lastBackupSnapshotJson: snapshotJson ?? prev.lastBackupSnapshotJson,
      lastBackupAtIso: nowIso,
    }));
    this.pushAlert({
      title: 'SQLite backup saved to Downloads',
      detail: `Encrypted snapshot recorded at ${DateFormatter.toShortTime(nowIso)}.`,
      category: 'backup',
      targetRoute: 'BackupRestore',
    });
  }

  public getUnreadAlertCount(): number {
    return this.getState().alerts.filter(a => a.unread).length;
  }

  public updateDeviceStorageInfo(deviceLabel: string, sizeBytes: number): void {
    this.setState(prev => ({
      ...prev,
      teacher: {
        ...prev.teacher,
        deviceId: deviceLabel,
      },
      backup: {
        ...prev.backup,
        databaseSizeLabel:
          sizeBytes > 0
            ? DateFormatter.formatBytes(sizeBytes)
            : prev.backup.databaseSizeLabel,
      },
    }));
  }

  public updateDatabaseSize(sizeBytes: number): void {
    if (sizeBytes <= 0) {
      return;
    }
    this.setState(prev => ({
      ...prev,
      backup: {
        ...prev.backup,
        databaseSizeLabel: DateFormatter.formatBytes(sizeBytes),
      },
    }));
  }

  public restoreState(snapshot: ProfileSettingsState): void {
    const registered = snapshot.isRegistered ?? true;
    this.setState({
      ...snapshot,
      activeAccountId: snapshot.activeAccountId ?? 'acc-primary',
      isRegistered: registered,
      hasSavedProfile: snapshot.hasSavedProfile ?? registered,
      lastBackupAtIso: snapshot.lastBackupAtIso ?? null,
    });
  }
}
