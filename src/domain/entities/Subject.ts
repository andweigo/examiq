import {DEFAULT_PASSING_PERCENTAGE} from '@constants/grading';
import {BaseEntity, BaseEntityProps} from '@core/base/BaseEntity';
import {ValidationError} from '@core/errors/AppError';
import {SubjectAccentKey} from '@core/types/common';

export interface SubjectProps extends BaseEntityProps {
  code: string;
  name: string;
  accent: SubjectAccentKey;
  passingPercentage?: number;
}

export class Subject extends BaseEntity<SubjectProps> {
  private _code: string;
  private _name: string;
  private _accent: SubjectAccentKey;
  private _passingPercentage: number;

  constructor(props: SubjectProps) {
    super(props);
    this._code = props.code.trim().toUpperCase();
    this._name = props.name.trim();
    this._accent = props.accent;
    this._passingPercentage =
      props.passingPercentage ?? DEFAULT_PASSING_PERCENTAGE;
  }

  public get code(): string {
    return this._code;
  }

  public get name(): string {
    return this._name;
  }

  public get accent(): SubjectAccentKey {
    return this._accent;
  }

  public get passingPercentage(): number {
    return this._passingPercentage;
  }

  public validate(): void {
    if (!this._code || !this._name) {
      throw new ValidationError('Subject code and name are required.');
    }
    if (this._passingPercentage < 1 || this._passingPercentage > 100) {
      throw new ValidationError('Passing percentage must be between 1 and 100.');
    }
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      code: this._code,
      name: this._name,
      accent: this._accent,
      passingPercentage: this._passingPercentage,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
