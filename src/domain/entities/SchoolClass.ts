import {BaseEntity, BaseEntityProps} from '@core/base/BaseEntity';
import {ValidationError} from '@core/errors/AppError';

export interface SchoolClassProps extends BaseEntityProps {
  gradeLevel: string;
  sectionName: string;
  schoolYear: string;
  advisorName: string;
}

export class SchoolClass extends BaseEntity<SchoolClassProps> {
  private _gradeLevel: string;
  private _sectionName: string;
  private _schoolYear: string;
  private _advisorName: string;

  constructor(props: SchoolClassProps) {
    super(props);
    this._gradeLevel = props.gradeLevel.trim();
    this._sectionName = props.sectionName.trim();
    this._schoolYear = props.schoolYear.trim();
    this._advisorName = props.advisorName.trim();
  }

  public get gradeLevel(): string {
    return this._gradeLevel;
  }

  public get sectionName(): string {
    return this._sectionName;
  }

  public get schoolYear(): string {
    return this._schoolYear;
  }

  public get advisorName(): string {
    return this._advisorName;
  }

  public get displayName(): string {
    return `${this._gradeLevel} · ${this._sectionName}`;
  }

  public validate(): void {
    if (!this._gradeLevel || !this._sectionName) {
      throw new ValidationError('Grade level and section name are required.');
    }
    if (!this._schoolYear) {
      throw new ValidationError('School year is required.');
    }
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      gradeLevel: this._gradeLevel,
      sectionName: this._sectionName,
      schoolYear: this._schoolYear,
      advisorName: this._advisorName,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
