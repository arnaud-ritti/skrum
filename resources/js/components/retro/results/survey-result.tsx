import { useTrans } from '@/hooks/use-trans';
import type { SurveyPayload } from '@/lib/retro/types';
import { OptionResult, TextAnswerList } from '../survey-card';
import { SurveyDiscussion } from '../survey-discussion';

export function SurveyResult({ survey }: { survey: SurveyPayload }) {
    const { t } = useTrans();

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
                <TextAnswerList answers={survey.textAnswers ?? []} />
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
