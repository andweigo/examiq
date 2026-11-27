import {BaseEntity, BaseEntityProps} from '@core/base/BaseEntity';
import {DatabaseError} from '@core/errors/AppError';
import {IDatabaseDriver, SqlParam} from '@core/interfaces/IDatabaseDriver';
import {IRepository} from '@core/interfaces/IRepository';
import {EntityId} from '@core/types/common';

/**
 * Abstract SQLite-backed repository implementing common CRUD primitives.
 * Concrete repositories provide table schema & row<->entity mapping.
 */
export abstract class BaseRepository<
  TEntity extends BaseEntity<BaseEntityProps>,
  TRow extends Record<string, unknown> = Record<string, unknown>,
> implements IRepository<TEntity>
{
  protected readonly db: IDatabaseDriver;
  protected abstract readonly tableName: string;

  protected constructor(db: IDatabaseDriver) {
    this.db = db;
  }

  protected abstract toEntity(row: TRow): TEntity;

  protected abstract toRow(entity: TEntity): Record<string, SqlParam>;

  public async findById(id: EntityId): Promise<TEntity | null> {
    try {
      const result = await this.db.execute<TRow>(
        `SELECT * FROM ${this.tableName} WHERE id = ? LIMIT 1`,
        [id],
      );
      if (result.rows.length === 0) {
        return null;
      }
      return this.toEntity(result.rows[0]);
    } catch (error) {
      throw new DatabaseError(`Failed to find record in ${this.tableName}`, {
        id,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async findAll(): Promise<TEntity[]> {
    try {
      const result = await this.db.execute<TRow>(
        `SELECT * FROM ${this.tableName} ORDER BY created_at DESC`,
      );
      return result.rows.map(row => this.toEntity(row));
    } catch (error) {
      throw new DatabaseError(`Failed to list records from ${this.tableName}`, {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async save(entity: TEntity): Promise<void> {
    entity.validate();
    const row = this.toRow(entity);
    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(col => row[col]);

    try {
      await this.db.execute(
        `INSERT OR REPLACE INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
        values,
      );
    } catch (error) {
      throw new DatabaseError(`Failed to save record to ${this.tableName}`, {
        id: entity.id,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async delete(id: EntityId): Promise<boolean> {
    try {
      const result = await this.db.execute(
        `DELETE FROM ${this.tableName} WHERE id = ?`,
        [id],
      );
      return result.rowsAffected > 0;
    } catch (error) {
      throw new DatabaseError(`Failed to delete record from ${this.tableName}`, {
        id,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async count(): Promise<number> {
    try {
      const result = await this.db.execute<{total: number}>(
        `SELECT COUNT(*) AS total FROM ${this.tableName}`,
      );
      return Number(result.rows[0]?.total ?? 0);
    } catch (error) {
      throw new DatabaseError(`Failed to count records in ${this.tableName}`, {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
