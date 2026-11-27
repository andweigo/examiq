export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'DATABASE_ERROR'
  | 'OMR_PROCESSING_ERROR'
  | 'QR_DECODE_ERROR'
  | 'PDF_GENERATION_ERROR'
  | 'BACKUP_ERROR'
  | 'UNKNOWN_ERROR';

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: AppErrorCode = 'UNKNOWN_ERROR',
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(entityName: string, id: string) {
    super(`${entityName} with id "${id}" was not found.`, 'NOT_FOUND', {
      entityName,
      id,
    });
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', details);
  }
}

export class OmrProcessingError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'OMR_PROCESSING_ERROR', details);
  }
}

export class QrDecodeError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'QR_DECODE_ERROR', details);
  }
}

export class BackupError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'BACKUP_ERROR', details);
  }
}
