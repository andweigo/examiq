import {NativeModules} from 'react-native';
import QRCode from 'qrcode';
import {BaseEngine} from '@core/base/BaseEngine';
import {PaperSize} from '@core/types/common';
import {BuilderQuestionView} from '@data/database/SeedData';

interface NativePdfBridge {
  generateAnswerSheetPdf(sheetJson: string): Promise<{
    filePath: string;
    fileName: string;
    sizeBytes: number;
    savedToDownloads: boolean;
  }>;
  generateBatchAnswerSheetsPdf(batchJson: string): Promise<{
    filePath: string;
    fileName: string;
    pageCount: number;
    sizeBytes: number;
    savedToDownloads: boolean;
  }>;
  generatePassingRatePdf(reportJson: string): Promise<{
    filePath: string;
    fileName: string;
    sizeBytes: number;
    savedToDownloads: boolean;
  }>;
  exportGradeSheetCsv(
    fileName: string,
    csvContent: string,
  ): Promise<{
    filePath: string;
    fileName: string;
    sizeBytes: number;
    savedToDownloads: boolean;
  }>;
  shareFile(
    filePath: string,
    mimeType: string,
    title: string,
  ): Promise<boolean>;
}

export type PdfExportMode = 'sheet-only' | 'questions-only' | 'full-exam';

export interface SheetPdfPayload {
  subject: string;
  term: string;
  date: string;
  studentName: string;
  studentId: string;
  section: string;
  itemCount: number;
  paperSize: PaperSize;
  qrPayload: string;
  exportMode?: PdfExportMode;
  includeQuestionnaire?: boolean;
  questions?: BuilderQuestionView[];
}

/**
 * OOP engine generating real printable A4 OMR PDFs with embedded ISO QR codes,
 * Passing Rate PDF reports, and CSV grade sheets via Android native PdfDocument.
 */
export class PdfExportEngine extends BaseEngine {
  private readonly bridge: NativePdfBridge | undefined;

  constructor() {
    super('PdfExportEngine');
    this.bridge = NativeModules.ExamIQPdf as NativePdfBridge | undefined;
  }

  public isNativeAvailable(): boolean {
    return Boolean(
      this.bridge && typeof this.bridge.generateAnswerSheetPdf === 'function',
    );
  }

  public async initialize(): Promise<void> {
    this.initialized = true;
  }

  private buildQrMatrix(raw: string): {qrMatrix: number[]; qrSize: number} {
    const qr = QRCode.create(raw || 'EXAMIQ', {errorCorrectionLevel: 'M'});
    const qrSize = qr.modules.size;
    const qrMatrix: number[] = [];
    for (let i = 0; i < qr.modules.data.length; i += 1) {
      qrMatrix.push(qr.modules.data[i] ? 1 : 0);
    }
    return {qrMatrix, qrSize};
  }

  public async generateSingleSheetPdf(sheet: SheetPdfPayload) {
    if (!this.isNativeAvailable()) {
      return null;
    }
    const {qrMatrix, qrSize} = this.buildQrMatrix(sheet.qrPayload);
    return this.bridge!.generateAnswerSheetPdf(
      JSON.stringify({...sheet, qrMatrix, qrSize}),
    );
  }

  public async generateBatchSheetsPdf(
    subject: string,
    term: string,
    paperSize: PaperSize,
    sheets: SheetPdfPayload[],
  ) {
    if (!this.isNativeAvailable()) {
      return null;
    }
    const enriched = sheets.map(s => {
      const {qrMatrix, qrSize} = this.buildQrMatrix(s.qrPayload);
      return {...s, qrMatrix, qrSize};
    });
    return this.bridge!.generateBatchAnswerSheetsPdf(
      JSON.stringify({subject, term, paperSize, sheets: enriched}),
    );
  }

  public async generatePassingSummaryPdf(payload: {
    fileName: string;
    examTitle: string;
    schoolName: string;
    teacherName: string;
    passingRate: number;
    passedCount: number;
    totalStudents: number;
    meanScore: number;
    students: Array<{
      id: string;
      name: string;
      section: string;
      score: number;
      total: number;
    }>;
  }) {
    if (!this.isNativeAvailable()) {
      return null;
    }
    return this.bridge!.generatePassingRatePdf(JSON.stringify(payload));
  }

  public async exportGradeSheetCsv(fileName: string, csvContent: string) {
    if (!this.isNativeAvailable()) {
      return null;
    }
    return this.bridge!.exportGradeSheetCsv(fileName, csvContent);
  }

  public async shareFile(filePath: string, mimeType: string, title: string) {
    if (!this.isNativeAvailable()) {
      return false;
    }
    return this.bridge!.shareFile(filePath, mimeType, title);
  }
}
