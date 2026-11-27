import {NativeModules} from 'react-native';
import {BaseEngine} from '@core/base/BaseEngine';

interface NativeSqliteBridge {
  initDatabase(): Promise<{
    path: string;
    sizeBytes: number;
    sqliteVersion: string;
    deviceLabel: string;
  }>;
  loadSnapshot(): Promise<string | null>;
  saveSnapshot(payloadJson: string): Promise<number>;
  getDatabaseStats(): Promise<{
    path: string;
    sizeBytes: number;
    sqliteVersion: string;
    deviceLabel: string;
  }>;
  exportDatabaseBackup(encrypt: boolean): Promise<{
    filePath: string;
    fileName: string;
    sizeBytes: number;
    encrypted: boolean;
    savedToDownloads: boolean;
  }>;
  restoreLatestLocalDbBackup(): Promise<{
    fileName: string;
    payloadJson: string | null;
  }>;
  restoreBackupFromPath(filePath: string): Promise<{
    fileName: string;
    payloadJson: string | null;
  }>;
  wipeAllData(): Promise<{
    wiped: boolean;
    sizeBytes: number;
    deviceLabel: string;
  }>;
  hashPinSecurely(pin: string): Promise<string>;
}

export interface DatabaseInitInfo {
  readonly available: boolean;
  readonly sizeBytes: number;
  readonly deviceLabel: string;
  readonly path: string;
}

/**
 * OOP persistence engine bridging React Native to Android's native SQLite
 * database (examiq_offline.db) and Android Keystore AES-256-GCM backups.
 */
export class SqlitePersistenceEngine extends BaseEngine {
  private readonly bridge: NativeSqliteBridge | undefined;

  constructor() {
    super('SqlitePersistenceEngine');
    this.bridge = NativeModules.ExamIQSqlite as NativeSqliteBridge | undefined;
  }

  public isNativeAvailable(): boolean {
    return Boolean(this.bridge && typeof this.bridge.initDatabase === 'function');
  }

  public async initialize(): Promise<void> {
    if (this.isNativeAvailable()) {
      await this.bridge!.initDatabase();
    }
    this.initialized = true;
  }

  public async initAndInspect(): Promise<DatabaseInitInfo> {
    if (!this.isNativeAvailable()) {
      this.initialized = true;
      return {
        available: false,
        sizeBytes: 0,
        deviceLabel: 'Local SQLite',
        path: 'examiq_offline.db',
      };
    }
    const info = await this.bridge!.initDatabase();
    this.initialized = true;
    return {
      available: true,
      sizeBytes: info.sizeBytes,
      deviceLabel: info.deviceLabel,
      path: info.path,
    };
  }

  public async loadSnapshot(): Promise<string | null> {
    if (!this.isNativeAvailable()) {
      return null;
    }
    return this.bridge!.loadSnapshot();
  }

  public async saveSnapshot(payloadJson: string): Promise<number | null> {
    if (!this.isNativeAvailable()) {
      return null;
    }
    return this.bridge!.saveSnapshot(payloadJson);
  }

  public async exportDbBackup(encrypt: boolean) {
    if (!this.isNativeAvailable()) {
      return null;
    }
    return this.bridge!.exportDatabaseBackup(encrypt);
  }

  public async restoreLatestDbBackup() {
    if (!this.isNativeAvailable()) {
      return null;
    }
    return this.bridge!.restoreLatestLocalDbBackup();
  }

  public async restoreDbFromPath(filePath: string) {
    if (!this.isNativeAvailable()) {
      return null;
    }
    return this.bridge!.restoreBackupFromPath(filePath);
  }

  public async wipeAllData() {
    if (!this.isNativeAvailable()) {
      return null;
    }
    return this.bridge!.wipeAllData();
  }

  public async hashPin(pin: string): Promise<string | null> {
    if (!this.isNativeAvailable()) {
      return null;
    }
    return this.bridge!.hashPinSecurely(pin);
  }
}
