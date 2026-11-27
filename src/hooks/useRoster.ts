import {useMemo, useSyncExternalStore} from 'react';
import {useServices} from './useServices';

export function useRoster(sectionFilter?: string) {
  const {rosterService} = useServices();
  const state = useSyncExternalStore(
    rosterService.subscribe,
    rosterService.getState,
  );
  const sectionStudents = useMemo(
    () => rosterService.getStudentsForSection(sectionFilter),
    [rosterService, state.students, sectionFilter],
  );
  const selectedGeneratorStudent = useMemo(
    () => rosterService.getSelectedGeneratorStudent(sectionFilter),
    [rosterService, state.students, state.selectedGenStudentId, sectionFilter],
  );

  return {
    ...state,
    sectionStudents,
    selectedGeneratorStudent,
    totalStudentRecordsCount: rosterService.getTotalStudentRecordsCount(),
    service: rosterService,
  };
}
