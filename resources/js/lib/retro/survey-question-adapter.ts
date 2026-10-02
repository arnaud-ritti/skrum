import type {
    SurveyQuestionProps,
    SurveyQuestionTextAnswer,
    SurveyQuestionVoter,
} from '@/components/skrum/survey-question';
import type { BoardParticipant, SurveyPayload } from './types';

const SurveyTextMaxLength = 500;

type SurveyQuestionContext = {
    participants: BoardParticipant[];
    mode: 'answer' | 'results';
};

/** What a viewer is writing before sending: ticked options, or a text. */
export type SurveyAnswerDraft = string[] | string;

type AdaptedProps = Pick<
    SurveyQuestionProps,
    | 'id'
    | 'kind'
    | 'label'
    | 'description'
    | 'mode'
    | 'options'
    | 'value'
    | 'hasAnswered'
    | 'closed'
    | 'maxLength'
    | 'results'
>;

export function hasAnsweredSurvey(survey: SurveyPayload): boolean {
    return survey.myOptionIds.length > 0 || survey.myText !== null;
}

/** The answer the server holds, as the draft a viewer starts from. */
export function savedSurveyAnswer(survey: SurveyPayload): SurveyAnswerDraft {
    if (survey.kind === 'text') {
        return survey.myText ?? '';
    }

    return orderedOptionIds(survey, survey.myOptionIds);
}

/** Changes when the server answer does: a draft made before it is stale. */
export function savedSurveyAnswerKey(survey: SurveyPayload): string {
    const saved = savedSurveyAnswer(survey);

    return `${survey.kind}:${typeof saved === 'string' ? saved : saved.join()}`;
}

/** The ticked options in the order of the survey, whatever the order of the clicks. */
export function orderedOptionIds(
    survey: SurveyPayload,
    selected: string[],
): string[] {
    return survey.options
        .map((option) => option.id)
        .filter((id) => selected.includes(id));
}

/** A draft is sent only when it holds something, and something new. */
export function canSubmitSurveyAnswer(
    survey: SurveyPayload,
    draft: SurveyAnswerDraft,
): boolean {
    if (typeof draft === 'string') {
        const text = draft.trim();

        return text !== '' && text !== survey.myText;
    }

    const selection = orderedOptionIds(survey, draft);

    if (selection.length === 0) {
        return false;
    }

    return (
        selection.join() !== orderedOptionIds(survey, survey.myOptionIds).join()
    );
}

function votersOf(
    ids: string[] | null,
    participants: BoardParticipant[],
): SurveyQuestionVoter[] | null {
    if (ids === null) {
        return null;
    }

    return ids
        .map((id) => participants.find((person) => person.id === id))
        .filter((person): person is BoardParticipant => person !== undefined)
        .map(({ id, name, avatarUrl }) => ({ id, name, avatarUrl }));
}

function textAnswersOf(
    survey: SurveyPayload,
    { participants, mode }: SurveyQuestionContext,
): SurveyQuestionTextAnswer[] | undefined {
    if (survey.kind !== 'text') {
        return undefined;
    }

    if (!survey.resultsVisible || survey.textAnswers === null) {
        return mode === 'results' ? [] : undefined;
    }

    return survey.textAnswers.map((answer) => ({
        id: answer.id,
        text: answer.text,
        isMine: answer.isMine,
        authorName:
            answer.authorId === null
                ? null
                : (participants.find((person) => person.id === answer.authorId)
                      ?.name ?? null),
    }));
}

/**
 * A survey of the retro as a `SurveyQuestion`. While the results are hidden
 * from the viewer, no count, voter or answer leaves here, whatever the
 * payload holds. The server shows the results of a completed retro to
 * everyone; a payload that hides them still lists the options, without figures.
 */
export function toSurveyQuestionProps(
    survey: SurveyPayload,
    context: SurveyQuestionContext,
): AdaptedProps {
    const visible = survey.resultsVisible;
    const saved = savedSurveyAnswer(survey);

    return {
        id: survey.id,
        kind: survey.kind,
        label: survey.question,
        description: survey.description,
        mode: context.mode,
        options: survey.options.map((option) => ({
            id: option.id,
            label: option.label,
            count: visible ? option.count : null,
            voters: visible
                ? votersOf(option.voters, context.participants)
                : null,
        })),
        value:
            survey.kind === 'single' ? (survey.myOptionIds[0] ?? null) : saved,
        hasAnswered: hasAnsweredSurvey(survey),
        closed: survey.isClosed,
        maxLength: SurveyTextMaxLength,
        results: {
            responses: survey.responseCount,
            hidden: !visible && context.mode === 'answer',
            textAnswers: textAnswersOf(survey, context),
        },
    };
}
