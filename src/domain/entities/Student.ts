import {BaseEntity, BaseEntityProps} from '@core/base/BaseEntity';
import {ValidationError} from '@core/errors/AppError';
import {EntityId} from '@core/types/common';

export interface StudentProps extends BaseEntityProps {
  studentCode: string;
  fullName: string;
  classId: EntityId;
  archived?: boolean;
}

export class Student extends BaseEntity<StudentProps> {
  private _studentCode: string;
  private _fullName: string;
  private _classId: EntityId;
  private _archived: boolean;

  constructor(props: StudentProps) {
    super(props);
    this._studentCode = props.studentCode.trim();
    this._fullName = props.fullName.trim();
    this._classId = props.classId;
    this._archived = props.archived ?? false;
  }

  public get studentCode(): string {
    return this._studentCode;
  }

  public get fullName(): string {
    return this._fullName;
  }

  public get classId(): EntityId {
    return this._classId;
  }

  public get archived(): boolean {
    return this._archived;
  }

  public rename(fullName: string): void {
    this._fullName = fullName.trim();
    this.validate();
    this.touch();
  }

  public transferToClass(classId: EntityId): void {
    this._classId = classId;
    this.validate();
    this.touch();
  }

  public archive(): void {
    this._archived = true;
    this.touch();
  }

  public restore(): void {
    this._archived = false;
    this.touch();
  }

  public validate(): void {
    if (!this._studentCode) {
      throw new ValidationError('Student ID code is required.');
    }
    if (!this._fullName) {
      throw new ValidationError('Student full name is required.');
    }
    if (!this._classId) {
      throw new ValidationError('Student must be assigned to a class section.');
    }
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      studentCode: this._studentCode,
      fullName: this._fullName,
      classId: this._classId,
      archived: this._archived,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
