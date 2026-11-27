import {EntityId, ISODateString} from '@core/types/common';

export interface BaseEntityProps {
  id: EntityId;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

/**
 * Abstract base class for all ExamIQ domain entities.
 * Enforces identity, audit timestamps, validation contracts, and serialization.
 */
export abstract class BaseEntity<TProps extends BaseEntityProps = BaseEntityProps> {
  public readonly id: EntityId;
  public readonly createdAt: ISODateString;
  protected _updatedAt: ISODateString;

  protected constructor(props: TProps) {
    const now = new Date().toISOString();
    this.id = props.id;
    this.createdAt = props.createdAt ?? now;
    this._updatedAt = props.updatedAt ?? this.createdAt;
  }

  public get updatedAt(): ISODateString {
    return this._updatedAt;
  }

  protected touch(): void {
    this._updatedAt = new Date().toISOString();
  }

  public equals(other?: BaseEntity<BaseEntityProps> | null): boolean {
    if (!other) {
      return false;
    }
    if (this === other) {
      return true;
    }
    return this.id === other.id && this.constructor === other.constructor;
  }

  public abstract validate(): void;

  public abstract toJSON(): Record<string, unknown>;
}
