/**
 * Abstract base class for on-device engines (OMR, QR, PDF, Backup).
 * Encapsulates engine lifecycle and execution timing diagnostics.
 */
export abstract class BaseEngine {
  protected readonly engineName: string;
  protected initialized = false;

  protected constructor(engineName: string) {
    this.engineName = engineName;
  }

  public isReady(): boolean {
    return this.initialized;
  }

  public abstract initialize(): Promise<void>;

  protected async measure<T>(
    work: () => Promise<T>,
  ): Promise<{result: T; durationMs: number}> {
    const start = Date.now();
    const result = await work();
    return {
      result,
      durationMs: Date.now() - start,
    };
  }
}
