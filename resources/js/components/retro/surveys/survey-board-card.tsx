import { useState } from 'react';
import SurveyResponsesController from '@/actions/App/Http/Controllers/Retros/SurveyResponsesController';
import { SurveyQuestion } from '@/components/skrum/survey-question';
import type { SurveyQuestionValue } from '@/components/skrum/survey-question';
import { retroRequest } from '@/lib/retro/api';
import { SurveyPhases } from '@/lib/retro/survey-api';
import {
    canSubmitSurveyAnswer,
    orderedOptionIds,
    savedSurveyAnswer,
    savedSurveyAnswerKey,
    toSurveyQuestionProps,
} from '@/lib/retro/survey-question-adapter';
import type { SurveyAnswerDraft } from '@/lib/retro/survey-question-adapter';
import type { SurveyPayload } from '@/lib/retro/types';
import { useBoard } from '../board-context';
import { SurveyActionsMenu } from './survey-actions-menu';
import { SurveyDiscussion } from './survey-discussion';

type SurveyResponse = { survey: SurveyPayload };

/** One survey of the board: its question, the viewer's answer and its discussion. */
export function SurveyBoardCard({ survey }: { survey: SurveyPayload }) {
    const ctx = useBoard();
    const [busy, setBusy] = useState(false);
    const savedKey = savedSurveyAnswerKey(survey);
    const [draftOf, setDraftOf] = useState(savedKey);
    const [draft, setDraft] = useState<SurveyAnswerDraft>(() =>
        savedSurveyAnswer(survey),
    );
    const { retro, viewer, participants } = ctx.board;

    // A draft made before the saved answer changed, here or from another
    // tab, would show stale boxes: it starts again from the server's.
    if (draftOf !== savedKey) {
        setDraftOf(savedKey);
        setDraft(savedSurveyAnswer(survey));
    }

    const canAnswer =
        ctx.isEditable &&
        !survey.isClosed &&
        SurveyPhases.includes(retro.phase);
    const route = { retro: retro.id, survey: survey.id };
    const props = toSurveyQuestionProps(survey, {
        participants,
        mode: 'answer',
    });

    const send = async (request: () => Promise<SurveyResponse>) => {
        if (busy) {
            return;
        }

        setBusy(true);

        const response = await ctx.run(request()).finally(() => setBusy(false));

        if (response) {
            ctx.invalidateSurvey(response.survey.id);
            ctx.apply({ type: 'survey.upsert', survey: response.survey });
        }
    };

    const answer = (body: Record<string, unknown>) =>
        send(() =>
            retroRequest<SurveyResponse>(
                SurveyResponsesController.update(route),
                body,
            ),
        );

    const withdraw = () =>
        send(() =>
            retroRequest<SurveyResponse>(
                SurveyResponsesController.destroy(route),
            ),
        );

    const change = (value: SurveyQuestionValue) => {
        if (survey.kind === 'single') {
            if (typeof value === 'string') {
                void answer({ optionId: value });
            }

            return;
        }

        if (typeof value === 'string' || Array.isArray(value)) {
            setDraft(value);
        }
    };

    const submit = () => {
        if (!canSubmitSurveyAnswer(survey, draft)) {
            return;
        }

        void answer(
            typeof draft === 'string'
                ? { text: draft.trim() }
                : { optionIds: orderedOptionIds(survey, draft) },
        );
    };

    return (
        <SurveyQuestion
            {...props}
            aria-label={survey.question}
            data-test={`retro-survey-${survey.id}`}
            value={survey.kind === 'single' ? props.value : draft}
            savedValue={props.value}
            disabled={!canAnswer}
            busy={busy}
            submitDisabled={!canSubmitSurveyAnswer(survey, draft)}
            onChange={change}
            onSubmit={submit}
            onWithdraw={canAnswer ? () => void withdraw() : undefined}
            actions={
                viewer.isFacilitator && retro.phase !== 'completed' ? (
                    <SurveyActionsMenu survey={survey} />
                ) : undefined
            }
            footer={<SurveyDiscussion survey={survey} />}
        />
    );
}
