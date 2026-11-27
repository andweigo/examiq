import {BaseEngine} from '@core/base/BaseEngine';
import {QrDecodeError} from '@core/errors/AppError';
import {IQrCodec, QrAssignmentData} from '@core/interfaces/IEngines';
import {QrPayload} from '@domain/value-objects/QrPayload';

/**
 * Concrete offline QR payload codec implementing IQrCodec (v1 & v2).
 */
export class QrPayloadCodec extends BaseEngine implements IQrCodec {
  constructor() {
    super('QrPayloadCodec');
  }

  public async initialize(): Promise<void> {
    this.initialized = true;
  }

  public encode(data: Omit<QrAssignmentData, 'checksum'>): string {
    const payload = new QrPayload({
      version: data.version,
      assignmentId: data.assignmentId,
      examId: data.examId,
      studentId: data.studentId,
      paperSize: data.paperSize,
      itemCount: data.itemCount,
    });
    return payload.serialize();
  }

  public decode(rawQrString: string): QrAssignmentData {
    try {
      const payload = QrPayload.deserialize(rawQrString);
      return {
        version: payload.version,
        assignmentId: payload.assignmentId,
        examId: payload.examId,
        studentId: payload.studentId,
        paperSize: payload.paperSize,
        itemCount: payload.itemCount,
        checksum: payload.checksum,
      };
    } catch (error) {
      throw new QrDecodeError(
        error instanceof Error ? error.message : 'Unable to decode QR payload.',
        {rawQrString},
      );
    }
  }

  public isValid(rawQrString: string): boolean {
    try {
      this.decode(rawQrString);
      return true;
    } catch {
      return false;
    }
  }
}
