import { useTrans } from '@/hooks/use-trans';
import type { SurveyPayload } from '@/lib/retro/types';
import { useBoard } from '../board-context';
import { OptionResult } from '../survey-card';
import { SurveyDiscussion } from '../survey-discussion';

export function SurveyResult({ survey }: { survey: SurveyPayload }) {
    const { board } = useBoard();
    const { t } = useTrans();
    const names = new Map(
        board.participants.map((participant) => [
            participant.id,
            participant.name,
        ]),
    );

    return (
        <article
            aria-label={survey.question}
            className="space-y-3 rounded-md border p-3 text-sm"
        >
            <header className="space-y-1">
                <h3 className="font-medium break-words">{survey.question}</h3>
                {survey.description && (
                    <p className="break-words whitespace-pre-wrap text-muted-foreground">
                        {survey.description}
                    </p>
                )}
                {survey.kind === 'multiple' && (
                    <p className="text-xs text-muted-foreground">
                        {t('Several answers allowed')}
                    </p>
                )}
            </header>
            {survey.kind === 'text' ? (
                <ul className="space-y-1" aria-label={t('Answers')}>
                    {(survey.textAnswers ?? []).map((answer) => (
                        <li
                            key={answer.id}
                            className="rounded-md bg-muted/50 p-2 break-words whitespace-pre-wrap"
                        >
                            {answer.text}
                            {answer.authorId && (
                                <span className="block text-xs text-muted-foreground">
                                    {names.get(answer.authorId)}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                <ul className="space-y-2">
                    {survey.options.map((option) => (
                        <li key={option.id} className="space-y-1">
                            <span className="break-words">{option.label}</span>
                            {survey.resultsVisible && (
                                <OptionResult
                                    option={option}
                                    responseCount={survey.responseCount}
                                />
                            )}
                        </li>
                    ))}
                </ul>
            )}
            <p className="text-xs text-muted-foreground">
                {t(
                    survey.responseCount === 1
                        ? ':count response'
                        : ':count responses',
                    { count: survey.responseCount },
                )}
            </p>
            <SurveyDiscussion survey={survey} />
        </article>
    );
}
