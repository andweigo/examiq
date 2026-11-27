import {BaseEntity, BaseEntityProps} from '@core/base/BaseEntity';
import {EntityId} from '@core/types/common';

export interface IRepository<TEntity extends BaseEntity<BaseEntityProps>> {
  findById(id: EntityId): Promise<TEntity | null>;
  findAll(): Promise<TEntity[]>;
  save(entity: TEntity): Promise<void>;
  delete(id: EntityId): Promise<boolean>;
  count(): Promise<number>;
}
