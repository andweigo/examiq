import {IQrCodec} from '@core/interfaces/IEngines';
import {FilePickerEngine} from '@engines/backup/FilePickerEngine';
import {SqlitePersistenceEngine} from '@engines/backup/SqlitePersistenceEngine';
import {NativeOmrEngine} from '@engines/omr/NativeOmrEngine';
import {PdfExportEngine} from '@engines/pdf/PdfExportEngine';
import {QrPayloadCodec} from '@engines/qr/QrPayloadCodec';
import {ExamService, ExamState} from '@services/ExamService';
import {
  ProfileSettingsService,
  ProfileSettingsState,
} from '@services/ProfileSettingsService';
import {RosterService, RosterState} from '@services/RosterService';
import {ScanningService, ScanningState} from '@services/ScanningService';
import {ToastService} from '@services/ToastService';
import {IdGenerator} from '@utils/IdGenerator';

export interface StoredTeacherWorkspace {
  readonly accountId: string;
  readonly lastActiveAt: string;
  readonly exams: ExamState;
  readonly roster: RosterState;
  readonly scanning: ScanningState;
  readonly profile: ProfileSettingsState;
}

export interface SavedAccountSummary {
  readonly accountId: string;
  readonly name: string;
  readonly initials: string;
  readonly school: string;
  readonly role: string;
  readonly hasPin: boolean;
  readonly examCount: number;
  readonly studentCount: number;
  readonly lastActiveAt: string;
}

export interface ExamIQBackupSnapshot {
  readonly version: number;
  readonly exportedAt: string;
  readonly activeAccountId?: string | null;
  readonly accounts?: Record<string, StoredTeacherWorkspace>;
  readonly exams: ExamState;
  readonly roster: RosterState;
  readonly scanning: ScanningState;
  readonly profile: ProfileSettingsState;
}

/**
 * Central Dependency Injection container (Singleton).
 * Wires offline native engines (SQLite, Keystore, PDF, CameraX/OMR, QR)
 * and isolated per-teacher OOP workspaces with automatic SQLite persistence.
 */
export class ServiceContainer {
  private static instance: ServiceContainer | null = null;

  public readonly qrCodec: IQrCodec;
  public readonly persistenceEngine: SqlitePersistenceEngine;
  public readonly filePickerEngine: FilePickerEngine;
  public readonly pdfEngine: PdfExportEngine;
  public readonly omrEngine: NativeOmrEngine;

  public readonly examService: ExamService;
  public readonly rosterService: RosterService;
  public readonly scanningService: ScanningService;
  public readonly profileSettingsService: ProfileSettingsService;
  public readonly toastService: ToastService;

  private persistenceWired = false;
  private hydrating = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private flushInFlight: Promise<void> = Promise.resolve();
  private accountVault: Record<string, StoredTeacherWorkspace> = {};

  private constructor() {
    this.qrCodec = new QrPayloadCodec();
    this.persistenceEngine = new SqlitePersistenceEngine();
    this.filePickerEngine = new FilePickerEngine();
    this.pdfEngine = new PdfExportEngine();
    this.omrEngine = new NativeOmrEngine();

    this.examService = new ExamService();
    this.rosterService = new RosterService();
    this.profileSettingsService = new ProfileSettingsService();
    this.scanningService = new ScanningService(
      this.rosterService,
      this.examService,
      this.profileSettingsService,
    );
    this.toastService = new ToastService();
  }

  public static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  public static resetForTesting(): void {
    if (ServiceContainer.instance?.saveTimer) {
      clearTimeout(ServiceContainer.instance.saveTimer);
    }
    ServiceContainer.instance = null;
  }

  private snapshotActiveWorkspaceIntoVault(): void {
    const profileState = this.profileSettingsService.getState();
    const accountId = profileState.activeAccountId;
    if (!accountId || !profileState.isRegistered) {
      return;
    }
    this.accountVault[accountId] = {
      accountId,
      lastActiveAt: new Date().toISOString(),
      exams: this.examService.getState(),
      roster: this.rosterService.getState(),
      scanning: this.scanningService.getState(),
      profile: profileState,
    };
  }

  public getSavedAccounts(): SavedAccountSummary[] {
    return Object.values(this.accountVault)
      .map(ws => ({
        accountId: ws.accountId,
        name: ws.profile.teacher.name,
        initials: ws.profile.teacher.initials,
        school: ws.profile.teacher.school,
        role: ws.profile.teacher.role,
        hasPin: Boolean(ws.profile.pinHash),
        examCount: ws.exams.exams.length,
        studentCount: ws.roster.students.length,
        lastActiveAt: ws.lastActiveAt,
      }))
      .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  }

  /**
   * Initializes real offline SQLite database on device, restores saved state,
   * and attaches auto-save observers to every OOP store.
   */
  public async hydrateFromSqlite(): Promise<void> {
    if (this.persistenceWired) {
      return;
    }
    this.persistenceWired = true;

    if (!this.persistenceEngine.isNativeAvailable()) {
      return;
    }

    try {
      this.hydrating = true;
      const dbInfo = await this.persistenceEngine.initAndInspect();
      const savedJson = await this.persistenceEngine.loadSnapshot();

      if (savedJson) {
        this.restoreBackupSnapshot(savedJson, false);
      } else {
        const size = await this.persistenceEngine.saveSnapshot(
          this.serializeCurrentState(),
        );
        if (size) {
          this.profileSettingsService.updateDatabaseSize(size);
        }
      }

      if (dbInfo.available) {
        this.profileSettingsService.updateDeviceStorageInfo(
          dbInfo.deviceLabel,
          dbInfo.sizeBytes,
        );
      }
      this.profileSettingsService.evaluateWeeklyBackupReminder();
    } catch {
      // Safe fallback to in-memory seed state if native storage fails
    } finally {
      this.hydrating = false;
      this.attachAutoPersistence();
    }
  }

  private attachAutoPersistence(): void {
    const scheduleSave = () => {
      if (this.hydrating || !this.persistenceEngine.isNativeAvailable()) {
        return;
      }
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
      }
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        void this.flushNow();
      }, 150);
    };

    this.examService.subscribe(scheduleSave);
    this.rosterService.subscribe(scheduleSave);
    this.scanningService.subscribe(scheduleSave);
    this.profileSettingsService.subscribe(scheduleSave);
  }

  /**
   * Immediately writes the full application state (including all isolated teacher accounts)
   * to local SQLite without waiting for the debounce timer.
   */
  public async flushNow(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.snapshotActiveWorkspaceIntoVault();
    if (!this.persistenceEngine.isNativeAvailable()) {
      return;
    }
    const run = async () => {
      try {
        const sizeBytes = await this.persistenceEngine.saveSnapshot(
          this.serializeCurrentState(),
        );
        if (sizeBytes) {
          this.hydrating = true;
          this.profileSettingsService.updateDatabaseSize(sizeBytes);
          this.hydrating = false;
        }
      } catch {
        // Ignore transient disk write errors
      }
    };
    this.flushInFlight = this.flushInFlight.then(run, run);
    return this.flushInFlight;
  }

  /**
   * Creates a brand-new, isolated local teacher account with a completely clean
   * workspace (0 classes, 0 students, 0 subjects, 0 exams, 0 scans).
   * Any previously logged-out teacher's workspace stays safely preserved in the vault.
   */
  public async registerTeacherProfile(input: {
    name: string;
    school: string;
    role: string;
    pin?: string;
  }): Promise<string> {
    this.snapshotActiveWorkspaceIntoVault();
    const newAccountId = IdGenerator.nextPrefixedId('acc');

    this.hydrating = true;
    try {
      this.examService.resetToEmptyWorkspace();
      this.rosterService.resetToEmptyWorkspace();
      this.scanningService.resetToEmptyWorkspace();
      this.profileSettingsService.startFreshAccountProfile(newAccountId, input);
      this.snapshotActiveWorkspaceIntoVault();
    } finally {
      this.hydrating = false;
    }

    await this.flushNow();
    return newAccountId;
  }

  /**
   * Enters the built-in sample/demo teacher workspace ("Skip for now ->").
   */
  public async skipTeacherRegistration(): Promise<void> {
    this.snapshotActiveWorkspaceIntoVault();
    const demoId = 'acc-demo';
    const existingDemo = this.accountVault[demoId];

    this.hydrating = true;
    try {
      if (existingDemo) {
        this.examService.restoreState(existingDemo.exams);
        this.rosterService.restoreState(existingDemo.roster);
        this.scanningService.restoreState(existingDemo.scanning);
        this.profileSettingsService.restoreState({
          ...existingDemo.profile,
          activeAccountId: demoId,
          isRegistered: true,
          hasSavedProfile: true,
        });
      } else {
        this.examService.resetAllData();
        this.rosterService.resetAllData();
        this.scanningService.resetAllData();
        this.profileSettingsService.resetAllData(true);
        this.profileSettingsService.skipRegistration(demoId);
      }
      this.snapshotActiveWorkspaceIntoVault();
    } finally {
      this.hydrating = false;
    }

    await this.flushNow();
  }

  /**
   * Saves the active teacher's entire workspace into the private vault, then clears
   * active live stores so another teacher signing up cannot see or access any of it.
   */
  public async logoutTeacherSession(): Promise<void> {
    this.snapshotActiveWorkspaceIntoVault();
    const hasVaultAccounts = Object.keys(this.accountVault).length > 0;

    this.hydrating = true;
    try {
      this.examService.resetToEmptyWorkspace();
      this.rosterService.resetToEmptyWorkspace();
      this.scanningService.resetToEmptyWorkspace();
      this.profileSettingsService.logoutSession(hasVaultAccounts);
    } finally {
      this.hydrating = false;
    }

    await this.flushNow();
  }

  /**
   * Unlocks a saved teacher workspace by accountId (or the most recent saved account),
   * enforcing its device PIN if one was configured.
   */
  public async unlockSavedTeacherSession(
    rawPin?: string,
    accountId?: string,
  ): Promise<boolean> {
    const savedList = this.getSavedAccounts();
    const targetId = accountId ?? savedList[0]?.accountId;

    if (!targetId || !this.accountVault[targetId]) {
      // Fallback for legacy single-profile tests without vault entry
      const ok = this.profileSettingsService.unlockSavedSession(rawPin);
      if (ok) {
        await this.flushNow();
      }
      return ok;
    }

    const workspace = this.accountVault[targetId];
    if (workspace.profile.pinHash) {
      const valid = ProfileSettingsService.verifyPinAgainstHash(
        rawPin ?? '',
        workspace.profile.pinHash,
      );
      if (!valid) {
        // Log failed unlock attempt into that teacher's private alert log
        const alertEntry = {
          id: IdGenerator.nextPrefixedId('alert'),
          title: 'Failed PIN unlock attempt',
          detail: 'Someone entered an incorrect device PIN for this account.',
          time: 'Just now',
          unread: true,
          category: 'security' as const,
          targetRoute: 'Profile',
        };
        this.accountVault[targetId] = {
          ...workspace,
          profile: {
            ...workspace.profile,
            alerts: [alertEntry, ...workspace.profile.alerts].slice(0, 40),
          },
        };
        await this.flushNow();
        return false;
      }
    }

    this.hydrating = true;
    try {
      this.examService.restoreState(workspace.exams);
      this.rosterService.restoreState(workspace.roster);
      this.scanningService.restoreState(workspace.scanning);
      this.profileSettingsService.restoreState({
        ...workspace.profile,
        activeAccountId: targetId,
        isRegistered: true,
        hasSavedProfile: true,
      });
      this.profileSettingsService.evaluateWeeklyBackupReminder();
      this.snapshotActiveWorkspaceIntoVault();
    } finally {
      this.hydrating = false;
    }

    await this.flushNow();
    return true;
  }

  public serializeCurrentState(): string {
    this.snapshotActiveWorkspaceIntoVault();
    const activeProfile = this.profileSettingsService.getState();
    const payload: ExamIQBackupSnapshot = {
      version: 2,
      exportedAt: new Date().toISOString(),
      activeAccountId: activeProfile.activeAccountId,
      accounts: {...this.accountVault},
      exams: this.examService.getState(),
      roster: this.rosterService.getState(),
      scanning: this.scanningService.getState(),
      profile: activeProfile,
    };
    return JSON.stringify(payload);
  }

  public createBackupSnapshot(): string {
    const json = this.serializeCurrentState();
    this.profileSettingsService.recordLocalBackup(json);
    void this.flushNow();
    return json;
  }

  public async wipeAllDataWithPin(rawPin: string): Promise<boolean> {
    if (!this.profileSettingsService.verifyDevicePin(rawPin)) {
      this.profileSettingsService.pushAlert({
        title: 'Blocked data-wipe attempt (wrong PIN)',
        detail: 'Incorrect device PIN was entered on Delete all local data.',
        category: 'security',
        targetRoute: 'Profile',
      });
      void this.flushNow();
      return false;
    }

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    const activeId = this.profileSettingsService.getState().activeAccountId;
    if (activeId) {
      delete this.accountVault[activeId];
    }
    const remainingAccounts = Object.keys(this.accountVault).length > 0;

    this.hydrating = true;
    try {
      if (!remainingAccounts) {
        const wiped = await this.persistenceEngine.wipeAllData();
        this.examService.resetToEmptyWorkspace();
        this.rosterService.resetToEmptyWorkspace();
        this.scanningService.resetToEmptyWorkspace();
        this.profileSettingsService.resetAllData(false);
        if (wiped) {
          this.profileSettingsService.updateDeviceStorageInfo(
            wiped.deviceLabel,
            wiped.sizeBytes,
          );
        }
      } else {
        // Other teachers still have private vaults on this device: erase ONLY this teacher's workspace
        this.examService.resetToEmptyWorkspace();
        this.rosterService.resetToEmptyWorkspace();
        this.scanningService.resetToEmptyWorkspace();
        this.profileSettingsService.logoutSession(true);
      }
    } finally {
      this.hydrating = false;
    }

    if (remainingAccounts) {
      await this.flushNow();
    }
    return true;
  }

  public restoreBackupSnapshot(rawJson: string, forceRegistered = true): void {
    const parsed = JSON.parse(rawJson) as Partial<ExamIQBackupSnapshot>;
    if (!parsed.exams || !parsed.roster || !parsed.scanning || !parsed.profile) {
      throw new Error('Invalid ExamIQ backup file format.');
    }

    this.accountVault = parsed.accounts ? {...parsed.accounts} : {};

    const resolvedRegistered = forceRegistered
      ? true
      : parsed.profile.isRegistered ?? true;
    const resolvedAccountId =
      parsed.activeAccountId ??
      parsed.profile.activeAccountId ??
      (resolvedRegistered ? 'acc-primary' : null);

    // Backward compatibility: migrate legacy single-account snapshots into the account vault
    if (
      resolvedAccountId &&
      resolvedRegistered &&
      !this.accountVault[resolvedAccountId]
    ) {
      this.accountVault[resolvedAccountId] = {
        accountId: resolvedAccountId,
        lastActiveAt: parsed.exportedAt ?? new Date().toISOString(),
        exams: parsed.exams,
        roster: parsed.roster,
        scanning: parsed.scanning,
        profile: {
          ...parsed.profile,
          activeAccountId: resolvedAccountId,
          isRegistered: true,
          hasSavedProfile: true,
        },
      };
    }

    const hasAnyVaultAccount = Object.keys(this.accountVault).length > 0;

    if (resolvedRegistered) {
      this.examService.restoreState(parsed.exams);
      this.rosterService.restoreState(parsed.roster);
      this.scanningService.restoreState(parsed.scanning);
      this.profileSettingsService.restoreState({
        ...parsed.profile,
        activeAccountId: resolvedAccountId,
        isRegistered: true,
        hasSavedProfile: true,
      });
    } else {
      // Logged-out state: keep live stores completely cleared so previous teacher's data is isolated
      this.examService.resetToEmptyWorkspace();
      this.rosterService.resetToEmptyWorkspace();
      this.scanningService.resetToEmptyWorkspace();
      this.profileSettingsService.logoutSession(hasAnyVaultAccount);
    }

    if (forceRegistered) {
      void this.flushNow();
    }
  }
}
