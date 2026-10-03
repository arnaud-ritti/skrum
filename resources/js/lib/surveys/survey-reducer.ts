import type {
    SurveyAnswer,
    SurveyProgress,
    SurveyQuestionPayload,
    SurveySnapshot,
} from './types';

export type SurveyAction =
    | { type: 'snapshot.replace'; snapshot: SurveySnapshot }
    | {
          type: 'answer.set';
          questionId: string;
          answer: SurveyAnswer | null;
          progress?: SurveyProgress;
      }
    | { type: 'progress.set'; responses: number; completed: number }
    | { type: 'question.upsert'; question: SurveyQuestionPayload }
    | { type: 'question.remove'; questionId: string }
    | { type: 'question.reorder'; ids: string[] };

function renumbered(
    questions: SurveyQuestionPayload[],
): SurveyQuestionPayload[] {
    return questions.map((question, position) => ({ ...question, position }));
}

function upserted(
    questions: SurveyQuestionPayload[],
    question: SurveyQuestionPayload,
): SurveyQuestionPayload[] {
    if (questions.some((known) => known.id === question.id)) {
        return questions.map((known) =>
            known.id === question.id
                ? { ...question, myAnswer: known.myAnswer }
                : known,
        );
    }

    const index = Math.min(Math.max(question.position, 0), questions.length);

    return renumbered([
        ...questions.slice(0, index),
        question,
        ...questions.slice(index),
    ]);
}

export function surveyReducer(
    state: SurveySnapshot,
    action: SurveyAction,
): SurveySnapshot {
    switch (action.type) {
        case 'snapshot.replace':
            if (action.snapshot.survey.version < state.survey.version) {
                return state;
            }

            return action.snapshot;
        case 'answer.set':
            return {
                ...state,
                questions: state.questions.map((question) =>
                    question.id === action.questionId
                        ? { ...question, myAnswer: action.answer }
                        : question,
                ),
                progress: action.progress ?? state.progress,
            };
        case 'progress.set':
            return {
                ...state,
                progress: {
                    ...state.progress,
                    responses: action.responses,
                    completed: action.completed,
                },
            };
        case 'question.upsert':
            return {
                ...state,
                questions: upserted(state.questions, action.question),
            };
        case 'question.remove':
            return {
                ...state,
                questions: renumbered(
                    state.questions.filter(
                        (question) => question.id !== action.questionId,
                    ),
                ),
            };
        case 'question.reorder':
            return {
                ...state,
                questions: renumbered(
                    action.ids
                        .map((id) =>
                            state.questions.find(
                                (question) => question.id === id,
                            ),
                        )
                        .filter(
                            (question): question is SurveyQuestionPayload =>
                                question !== undefined,
                        ),
                ),
            };
    }
}
