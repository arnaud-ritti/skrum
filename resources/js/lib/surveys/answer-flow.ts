import type { SurveyQuestionPayload } from './types';

type AnsweredPredicate = (question: SurveyQuestionPayload) => boolean;

const hasServerAnswer: AnsweredPredicate = (question) =>
    question.myAnswer !== null;

/** The index of the first question without an answer; the last one when all have one. */
export function firstUnanswered(questions: SurveyQuestionPayload[]): number {
    const index = questions.findIndex((question) => !hasServerAnswer(question));

    if (index !== -1) {
        return index;
    }

    return Math.max(questions.length - 1, 0);
}

/** The ids of the required questions left without an answer, in the survey's order. */
export function missingRequired(
    questions: SurveyQuestionPayload[],
    isAnswered: AnsweredPredicate = hasServerAnswer,
): string[] {
    return questions
        .filter((question) => question.isRequired && !isAnswered(question))
        .map((question) => question.id);
}

/** The index of the first question named by a `questions.{id}` error of the submission. */
export function stepOf(
    serverErrors: Record<string, string[]>,
    questions: SurveyQuestionPayload[],
): number | null {
    const named = new Set(
        Object.keys(serverErrors)
            .filter((key) => key.startsWith('questions.'))
            .map((key) => key.slice('questions.'.length)),
    );
    const index = questions.findIndex((question) => named.has(question.id));

    return index === -1 ? null : index;
}

/** The score a digit key gives the question: 1 to 5 on a scale, 0 to 9 on an NPS. */
export function digitValue(
    key: string,
    question: SurveyQuestionPayload,
): number | null {
    if (!/^\d$/.test(key)) {
        return null;
    }

    const digit = Number(key);

    if (question.kind === 'nps') {
        return digit;
    }

    if (question.kind !== 'scale') {
        return null;
    }

    return digit >= 1 && digit <= (question.scaleMax ?? 5) ? digit : null;
}

/** The first and last keys `digitValue` reads for the question, for the keyboard hint. */
export function digitRange(
    question: SurveyQuestionPayload,
): [first: number, last: number] | null {
    if (question.kind === 'nps') {
        return [0, 9];
    }

    if (question.kind === 'scale') {
        return [1, Math.min(question.scaleMax ?? 5, 9)];
    }

    return null;
}
