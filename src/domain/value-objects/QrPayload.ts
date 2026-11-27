import {ValidationError} from '@core/errors/AppError';
import {EntityId, PaperSize} from '@core/types/common';
import {ChecksumUtil} from '@utils/ChecksumUtil';

export interface QrPayloadProps {
  readonly version: number;
  readonly assignmentId: EntityId;
  readonly examId: EntityId;
  readonly studentId: EntityId;
  readonly paperSize?: PaperSize;
  readonly itemCount?: number;
  readonly checksum?: string;
}

/**
 * Immutable Value Object representing the offline QR payload printed on
 * each student's ExamIQ answer sheet (supports v1 & v2 with paperSize + itemCount).
 */
export class QrPayload {
  public readonly version: number;
  public readonly assignmentId: EntityId;
  public readonly examId: EntityId;
  public readonly studentId: EntityId;
  public readonly paperSize: PaperSize;
  public readonly itemCount?: number;
  public readonly checksum: string;

  constructor(props: QrPayloadProps) {
    if (!props.assignmentId || !props.examId || !props.studentId) {
      throw new ValidationError(
        'QrPayload requires assignmentId, examId, and studentId.',
      );
    }
    this.version = props.version;
    this.assignmentId = props.assignmentId;
    this.examId = props.examId;
    this.studentId = props.studentId;
    this.paperSize = props.paperSize ?? 'A4';
    this.itemCount = props.itemCount;
    const rawBody = this.buildUnsignedBody();
    this.checksum = props.checksum ?? ChecksumUtil.compute(rawBody);
  }

  private buildUnsignedBody(): string {
    if (this.version >= 2) {
      return `EXAMIQ|v${this.version}|${this.assignmentId}|${this.examId}|${this.studentId}|${this.paperSize}|${this.itemCount ?? 50}`;
    }
    return `EXAMIQ|v${this.version}|${this.assignmentId}|${this.examId}|${this.studentId}`;
  }

  public isIntegrityValid(): boolean {
    return ChecksumUtil.verify(this.buildUnsignedBody(), this.checksum);
  }

  public serialize(): string {
    return `${this.buildUnsignedBody()}|${this.checksum}`;
  }

  public static deserialize(raw: string): QrPayload {
    const parts = raw.trim().split('|');
    if (parts[0] !== 'EXAMIQ' || !parts[1]?.startsWith('v')) {
      throw new ValidationError('Invalid ExamIQ QR payload format.');
    }
    const version = Number(parts[1].slice(1));
    if (!Number.isInteger(version) || version < 1) {
      throw new ValidationError('Unsupported ExamIQ QR payload version.');
    }

    let payload: QrPayload;
    if (version >= 2 && parts.length === 8) {
      const sizeRaw = parts[5].toUpperCase();
      const paperSize: PaperSize =
        sizeRaw === 'SHORT' || sizeRaw === 'LONG' ? sizeRaw : 'A4';
      payload = new QrPayload({
        version,
        assignmentId: parts[2],
        examId: parts[3],
        studentId: parts[4],
        paperSize,
        itemCount: Number(parts[6]) || 50,
        checksum: parts[7],
      });
    } else if (parts.length === 6) {
      payload = new QrPayload({
        version,
        assignmentId: parts[2],
        examId: parts[3],
        studentId: parts[4],
        checksum: parts[5],
      });
    } else {
      throw new ValidationError('Invalid ExamIQ QR field count.');
    }

    if (!payload.isIntegrityValid()) {
      throw new ValidationError('ExamIQ QR payload checksum mismatch.');
    }
    return payload;
  }
}
