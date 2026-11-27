import {useSyncExternalStore} from 'react';
import {useServices} from './useServices';

export function useExams() {
  const {examService} = useServices();
  const state = useSyncExternalStore(
    examService.subscribe,
    examService.getState,
  );
  const selectedExam = examService.getSelectedExam();

  return {
    ...state,
    selectedExam,
    questions: examService.getQuestions(selectedExam.id),
    mcqQuestions: examService.getMcqQuestions(selectedExam.id),
    essayQuestions: examService.getEssayQuestions(selectedExam.id),
    essayMaxPoints: examService.getEssayMaxPoints(selectedExam.id),
    answerKey: examService.getAnswerKey(selectedExam.id),
    pointsPerItem: examService.getPointsPerItem(selectedExam.id),
    alignmentOverlay: examService.getAlignmentOverlay(selectedExam.id),
    totalConfiguredPoints: examService.getTotalConfiguredPoints(selectedExam.id),
    service: examService,
  };
}
