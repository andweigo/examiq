import {useMemo, useSyncExternalStore} from 'react';
import {StudentRecordView} from '@data/database/SeedData';
import {useServices} from './useServices';

const EMPTY_STUDENT: StudentRecordView = {
  id: 'UNASSIGNED',
  name: 'No student yet',
  section: 'Unassigned',
  score: 0,
  total: 10,
  status: 'Pending',
};

export function useRoster(sectionFilter?: string) {
  const {rosterService} = useServices();
  const state = useSyncExternalStore(
    rosterService.subscribe,
    rosterService.getState,
  );

  const sectionStudents = useMemo(() => {
    if (!sectionFilter) {
      return state.students;
    }
    const normalized = sectionFilter.trim().toLowerCase();
    return state.students.filter(
      s => s.section.trim().toLowerCase() === normalized,
    );
  }, [state.students, sectionFilter]);

  const selectedGeneratorStudent = useMemo(() => {
    return (
      sectionStudents.find(s => s.id === state.selectedGenStudentId) ??
      sectionStudents[0] ??
      EMPTY_STUDENT
    );
  }, [sectionStudents, state.selectedGenStudentId]);

  return {
    ...state,
    sectionStudents,
    selectedGeneratorStudent,
    totalStudentRecordsCount: state.students.length,
    service: rosterService,
  };
}
