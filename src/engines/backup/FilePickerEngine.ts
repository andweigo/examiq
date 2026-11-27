import {NativeModules} from 'react-native';
import {BaseEngine} from '@core/base/BaseEngine';

export interface ParsedSpreadsheetRow {
  readonly studentId: string;
  readonly name: string;
  readonly section: string;
}

export interface PickedSpreadsheetResult {
  readonly fileName: string;
  readonly fileType: 'xlsx' | 'csv';
  readonly rows: ParsedSpreadsheetRow[];
}

export interface PickedBackupResult {
  readonly fileName: string;
  readonly format: 'json' | 'sqlite';
  readonly payloadJson?: string;
  readonly filePath?: string;
}

interface NativeFilePickerBridge {
  pickSpreadsheetFile(): Promise<PickedSpreadsheetResult | null>;
  pickBackupFile(): Promise<PickedBackupResult | null>;
}

/**
 * OOP engine wrapping Android's native ACTION_OPEN_DOCUMENT picker
 * with zero-dependency offline Excel (.xlsx) & CSV parsing + .db backup selection.
 */
export class FilePickerEngine extends BaseEngine {
  private readonly bridge: NativeFilePickerBridge | undefined;

  constructor() {
    super('FilePickerEngine');
    this.bridge = NativeModules.ExamIQFilePicker as
      | NativeFilePickerBridge
      | undefined;
  }

  public isNativeAvailable(): boolean {
    return Boolean(
      this.bridge && typeof this.bridge.pickSpreadsheetFile === 'function',
    );
  }

  public async initialize(): Promise<void> {
    this.initialized = true;
  }

  public async pickSpreadsheet(): Promise<PickedSpreadsheetResult | null> {
    if (!this.isNativeAvailable()) {
      return null;
    }
    return this.bridge!.pickSpreadsheetFile();
  }

  public async pickBackup(): Promise<PickedBackupResult | null> {
    if (!this.isNativeAvailable()) {
      return null;
    }
    return this.bridge!.pickBackupFile();
  }
}
