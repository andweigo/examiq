import {AppError} from '@core/errors/AppError';
import {OperationResult} from '@core/types/common';

/**
 * Abstract base class for application/use-case services.
 * Standardizes safe execution envelopes and error normalization.
 */
export abstract class BaseService {
  protected readonly serviceName: string;

  protected constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  protected async runSafely<T>(
    operation: () => Promise<T>,
  ): Promise<OperationResult<T, AppError>> {
    try {
      const data = await operation();
      return {ok: true, data};
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
              error instanceof Error ? error.message : 'Unexpected service error',
              'UNKNOWN_ERROR',
              {service: this.serviceName},
            );
      return {ok: false, error: appError};
    }
  }
}
