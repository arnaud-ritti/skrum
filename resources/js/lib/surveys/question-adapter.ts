import type {
    SurveyQuestionProps,
    SurveyQuestionValue,
} from '@/components/skrum/survey-question';
import type { SurveyQuestionPayload, SurveyQuestionSummary } from './types';

type AdapterOptions = {
    mode: 'answer' | 'results';
    index?: number;
    count?: number;
    /** The server's summary; absent when the viewer may not see results. */
    summary?: SurveyQuestionSummary;
    /** The number of answers, shown even when the results are hidden. */
    responses?: number;
};

const componentKind = {
    scale: 'scale5',
    nps: 'nps',
    single: 'single',
    multiple: 'multiple',
    text: 'text',
} as const;

function valueOf(question: SurveyQuestionPayload): SurveyQuestionValue {
    const answer = question.myAnswer;

    switch (question.kind) {
        case 'scale':
        case 'nps':
            return answer?.value ?? null;
        case 'single':
            return answer?.optionIds[0] ?? null;
        case 'multiple':
            return answer?.optionIds ?? [];
        case 'text':
            return answer?.text ?? '';
    }
}

function resultsOf(
    summary: SurveyQuestionSummary | undefined,
    responses: number,
): SurveyQuestionProps['results'] {
    if (summary === undefined) {
        return { responses, hidden: true };
    }

    return {
        responses: summary.responses,
        mean: summary.mean ?? undefined,
        mode: summary.mode,
        nps: summary.nps ?? undefined,
        segments:
            summary.promoters === undefined
                ? undefined
                : {
                      detractors: summary.detractors ?? 0,
                      passives: summary.passives ?? 0,
                      promoters: summary.promoters,
                  },
        buckets: summary.buckets,
        textAnswers: summary.answers,
    };
}

export function toQuestionProps(
    question: SurveyQuestionPayload,
    options: AdapterOptions,
): SurveyQuestionProps {
    const counts = new Map(
        (options.summary?.options ?? []).map((option) => [
            option.id,
            option.count,
        ]),
    );

    return {
        id: question.id,
        kind: componentKind[question.kind],
        label: question.label,
        description: question.description,
        mode: options.mode,
        index: options.index,
        count: options.count,
        required: question.isRequired,
        anonymous: true,
        scaleMax:
            question.kind === 'scale' ? (question.scaleMax ?? 5) : undefined,
        scaleLabels:
            question.scaleLabels?.[0] || question.scaleLabels?.[1]
                ? [question.scaleLabels[0] ?? '', question.scaleLabels[1] ?? '']
                : undefined,
        maxLength: 500,
        options: question.options.map((option) => ({
            id: option.id,
            label: option.label,
            count: counts.get(option.id),
        })),
        value: valueOf(question),
        comment: question.myAnswer?.comment ?? '',
        hasAnswered: question.myAnswer !== null,
        results:
            options.mode === 'results'
                ? resultsOf(options.summary, options.responses ?? 0)
                : undefined,
    };
}

export type AnswerBody =
    | { value: number; comment?: string }
    | { optionId: string }
    | { optionIds: string[] }
    | { text: string };

/** The body of `surveys.answers.update`, or null when there is nothing to save. */
export function answerOf(
    question: SurveyQuestionPayload,
    value: SurveyQuestionValue,
    comment: string,
): AnswerBody | null {
    switch (question.kind) {
        case 'scale':
        case 'nps': {
            if (typeof value !== 'number') {
                return null;
            }

            const trimmed = comment.trim();

            return question.allowsComment && trimmed !== ''
                ? { value, comment: trimmed }
                : { value };
        }
        case 'single':
            return typeof value === 'string' && value !== ''
                ? { optionId: value }
                : null;
        case 'multiple':
            return Array.isArray(value) && value.length > 0
                ? { optionIds: value }
                : null;
        case 'text': {
            const text = typeof value === 'string' ? value.trim() : '';

            return text === '' ? null : { text };
        }
    }
}
