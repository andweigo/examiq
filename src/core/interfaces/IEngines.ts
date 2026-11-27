import {
  BubbleChoice,
  EntityId,
  OmrSensitivity,
  PaperSize,
} from '@core/types/common';

export interface AlignmentMetricsData {
  readonly markersDetected: number;
  readonly totalMarkers: number;
  readonly rotationAngleDeg: number;
  readonly lightingStatus: 'clear' | 'dim' | 'glare';
  readonly sharpnessScore: number;
  readonly alignedImageUri: string;
}

export interface DetectedBubbleItem {
  readonly itemNumber: number;
  readonly selectedChoices: BubbleChoice[];
  readonly fillRatios: Record<BubbleChoice, number>;
  readonly isBlank: boolean;
  readonly isConflict: boolean;
  readonly confidence: number;
}

export interface OmrProcessOutput {
  readonly alignment: AlignmentMetricsData;
  readonly items: DetectedBubbleItem[];
  readonly durationMs: number;
}

export interface IOmrEngine {
  alignSheet(rawImageUri: string): Promise<AlignmentMetricsData>;
  detectBubbles(
    alignedImageUri: string,
    itemCount: number,
    sensitivity: OmrSensitivity,
    flagDoubleShaded: boolean,
  ): Promise<OmrProcessOutput>;
}

export interface QrAssignmentData {
  readonly version: number;
  readonly assignmentId: EntityId;
  readonly examId: EntityId;
  readonly studentId: EntityId;
  readonly paperSize?: PaperSize;
  readonly itemCount?: number;
  readonly checksum: string;
}

export interface IQrCodec {
  encode(data: Omit<QrAssignmentData, 'checksum'>): string;
  decode(rawQrString: string): QrAssignmentData;
  isValid(rawQrString: string): boolean;
}

export interface GeneratedFileArtifact {
  readonly filePath: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
}

export interface IPdfGenerator {
  generateAnswerSheetPdf(assignmentId: EntityId): Promise<GeneratedFileArtifact>;
  generateBatchAnswerSheetsPdf(examId: EntityId): Promise<GeneratedFileArtifact>;
  generatePassingRateReportPdf(examId: EntityId): Promise<GeneratedFileArtifact>;
}

export interface BackupMetadata {
  readonly filePath: string;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
  readonly encrypted: boolean;
}

export interface IBackupManager {
  exportDatabaseBackup(encrypt: boolean): Promise<BackupMetadata>;
  restoreDatabaseBackup(filePath: string): Promise<void>;
  getDatabaseSizeBytes(): Promise<number>;
}
