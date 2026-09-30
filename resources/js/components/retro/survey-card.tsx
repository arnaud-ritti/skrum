import { Check } from 'lucide-react';
import { useState } from 'react';
import SurveyResponsesController from '@/actions/App/Http/Controllers/Retros/SurveyResponsesController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { SurveyPhases } from '@/lib/retro/survey-api';
import type {
    BoardParticipant,
    SurveyOption,
    SurveyPayload,
} from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';
import { SurveyDiscussion } from './survey-discussion';
import { SurveyMenu } from './survey-menu';

type AnswerProps = {
    survey: SurveyPayload;
    canAnswer: boolean;
    busy: boolean;
    onAnswer: (body: Record<string, unknown>) => Promise<void>;
};

export function SurveyCard({ survey }: { survey: SurveyPayload }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const canAnswer =
        ctx.isEditable &&
        !survey.isClosed &&
        SurveyPhases.includes(ctx.board.retro.phase);
    const hasAnswered = survey.myOptionIds.length > 0 || survey.myText !== null;
    const route = { retro: ctx.board.retro.id, survey: survey.id };

    const send = async (request: () => Promise<{ survey: SurveyPayload }>) => {
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
            retroRequest<{ survey: SurveyPayload }>(
                SurveyResponsesController.update(route),
                body,
            ),
        );

    const withdraw = () =>
        send(() =>
            retroRequest<{ survey: SurveyPayload }>(
                SurveyResponsesController.destroy(route),
            ),
        );

    return (
        <article
            aria-label={survey.question}
            className="space-y-2 rounded-md border bg-background p-3 shadow-xs"
        >
            <div className="flex items-start gap-2">
                <h3 className="min-w-0 flex-1 text-sm font-medium break-words">
                    {survey.question}
                </h3>
                {survey.isClosed && (
                    <Badge variant="secondary">{t('Closed')}</Badge>
                )}
                <SurveyMenu survey={survey} />
            </div>
            {survey.description && (
                <p className="text-xs break-words whitespace-pre-wrap text-muted-foreground">
                    {survey.description}
                </p>
            )}
            {survey.kind === 'multiple' && (
                <p className="text-xs text-muted-foreground">
                    {t('Several answers allowed')}
                </p>
            )}
            {survey.kind === 'text' ? (
                <TextSurvey
                    key={survey.myText ?? ''}
                    survey={survey}
                    canAnswer={canAnswer}
                    busy={busy}
                    onAnswer={answer}
                />
            ) : (
                <ChoiceSurvey
                    key={survey.myOptionIds.join()}
                    survey={survey}
                    canAnswer={canAnswer}
                    busy={busy}
                    onAnswer={answer}
                />
            )}
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                    {survey.responseCount === 1
                        ? t('1 response')
                        : t(':count responses', {
                              count: survey.responseCount,
                          })}
                </span>
                {canAnswer && hasAnswered && (
                    <Button
                        size="sm"
                        variant="link"
                        className="h-auto p-0 text-xs"
                        disabled={busy}
                        onClick={() => void withdraw()}
                    >
                        {t('Withdraw my answer')}
                    </Button>
                )}
            </div>
            <SurveyDiscussion survey={survey} />
        </article>
    );
}

function ChoiceSurvey({ survey, canAnswer, busy, onAnswer }: AnswerProps) {
    const { t } = useTrans();
    const [selected, setSelected] = useState<string[]>(survey.myOptionIds);
    const isMultiple = survey.kind === 'multiple';
    const orderedSelection = survey.options
        .map((option) => option.id)
        .filter((id) => selected.includes(id));
    const hasChanged =
        orderedSelection.join() !==
        survey.options
            .map((option) => option.id)
            .filter((id) => survey.myOptionIds.includes(id))
            .join();

    return (
        <div className="space-y-2">
            <ul className="space-y-2">
                {survey.options.map((option) => {
                    const isMine = survey.myOptionIds.includes(option.id);

                    return (
                        <li key={option.id}>
                            {isMultiple ? (
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={selected.includes(option.id)}
                                        disabled={!canAnswer || busy}
                                        onCheckedChange={(checked) =>
                                            setSelected((current) =>
                                                checked === true
                                                    ? [...current, option.id]
                                                    : current.filter(
                                                          (id) =>
                                                              id !== option.id,
                                                      ),
                                            )
                                        }
                                    />
                                    <span className="min-w-0 flex-1 break-words">
                                        {option.label}
                                    </span>
                                </label>
                            ) : (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={isMine ? 'default' : 'outline'}
                                    className="h-auto w-full justify-start py-1.5 text-left whitespace-normal"
                                    aria-pressed={isMine}
                                    disabled={!canAnswer || busy}
                                    onClick={() =>
                                        void onAnswer({ optionId: option.id })
                                    }
                                >
                                    {isMine && (
                                        <Check className="size-3.5 shrink-0" />
                                    )}
                                    {option.label}
                                </Button>
                            )}
                            {survey.resultsVisible && (
                                <OptionResult
                                    option={option}
                                    responseCount={survey.responseCount}
                                />
                            )}
                        </li>
                    );
                })}
            </ul>
            {isMultiple && canAnswer && (
                <Button
                    size="sm"
                    disabled={
                        busy || orderedSelection.length === 0 || !hasChanged
                    }
                    onClick={() =>
                        void onAnswer({ optionIds: orderedSelection })
                    }
                >
                    {survey.myOptionIds.length > 0
                        ? t('Update answer')
                        : t('Submit')}
                </Button>
            )}
        </div>
    );
}

function OptionResult({
    option,
    responseCount,
}: {
    option: SurveyOption;
    responseCount: number;
}) {
    const { board } = useBoard();
    const count = option.count ?? 0;
    const percent =
        responseCount === 0 ? 0 : Math.round((count / responseCount) * 100);
    const voters = (option.voters ?? [])
        .map((id) => board.participants.find((person) => person.id === id))
        .filter((person): person is BoardParticipant => person !== undefined);

    return (
        <div className="mt-1 space-y-1">
            <div className="flex items-center gap-2 text-xs">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <span className="w-16 shrink-0 text-right text-muted-foreground tabular-nums">
                    {percent}% · {count}
                </span>
            </div>
            {voters.length > 0 && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex -space-x-1" tabIndex={0}>
                            {voters.map((voter) => (
                                <img
                                    key={voter.id}
                                    src={voter.avatarUrl}
                                    alt={voter.name}
                                    className="size-5 rounded-full border border-background"
                                />
                            ))}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        {voters.map((voter) => voter.name).join(', ')}
                    </TooltipContent>
                </Tooltip>
            )}
        </div>
    );
}

function TextSurvey({ survey, canAnswer, busy, onAnswer }: AnswerProps) {
    const { t } = useTrans();
    const { board } = useBoard();
    const [text, setText] = useState(survey.myText ?? '');
    const trimmed = text.trim();

    return (
        <div className="space-y-2">
            {canAnswer && (
                <form
                    className="space-y-1"
                    onSubmit={(event) => {
                        event.preventDefault();

                        if (trimmed !== '') {
                            void onAnswer({ text: trimmed });
                        }
                    }}
                >
                    <Textarea
                        value={text}
                        maxLength={500}
                        rows={2}
                        placeholder={t('Write your answer…')}
                        aria-label={t('Your answer')}
                        onChange={(event) => setText(event.target.value)}
                    />
                    <div className="flex justify-end">
                        <Button
                            size="sm"
                            disabled={
                                busy ||
                                trimmed === '' ||
                                trimmed === survey.myText
                            }
                        >
                            {survey.myText === null
                                ? t('Submit')
                                : t('Update answer')}
                        </Button>
                    </div>
                </form>
            )}
            {survey.textAnswers !== null &&
                (survey.textAnswers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                        {t('No answers yet.')}
                    </p>
                ) : (
                    <ul className="space-y-1" aria-label={t('Answers')}>
                        {survey.textAnswers.map((answer) => (
                            <li
                                key={answer.id}
                                className={cn(
                                    'rounded-sm border px-2 py-1 text-xs break-words whitespace-pre-wrap',
                                    answer.isMine && 'border-primary',
                                )}
                            >
                                {answer.text}
                                {answer.authorId && (
                                    <span className="block text-muted-foreground">
                                        {
                                            board.participants.find(
                                                (person) =>
                                                    person.id ===
                                                    answer.authorId,
                                            )?.name
                                        }
                                    </span>
                                )}
                                {answer.isMine && (
                                    <span className="block text-muted-foreground">
                                        {t('Your answer')}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                ))}
        </div>
    );
}
