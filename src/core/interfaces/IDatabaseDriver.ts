export type SqlParam = string | number | boolean | null;

export interface SqlQueryResult<TRow = Record<string, unknown>> {
  readonly rows: TRow[];
  readonly rowsAffected: number;
  readonly insertId?: number;
}

/**
 * Dependency-inversion contract for the local SQLite engine.
 * Allows swapping concrete SQLite bindings or in-memory test doubles cleanly.
 */
export interface IDatabaseDriver {
  open(): Promise<void>;
  close(): Promise<void>;
  execute<TRow = Record<string, unknown>>(
    sql: string,
    params?: SqlParam[],
  ): Promise<SqlQueryResult<TRow>>;
  transaction<T>(work: () => Promise<T>): Promise<T>;
  getDatabasePath(): string;
}
