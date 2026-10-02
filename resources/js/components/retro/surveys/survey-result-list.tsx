import { SurveyQuestion } from '@/components/skrum/survey-question';
import { useTrans } from '@/hooks/use-trans';
import { toSurveyQuestionProps } from '@/lib/retro/survey-question-adapter';
import type { SurveyPayload } from '@/lib/retro/types';
import { useBoard } from '../board-context';
import { ResultsCard } from '../results/results-card';
import { SurveyDiscussion } from './survey-discussion';

/**
 * The surveys of a completed retro: the cards of the board, read only. No
 * answer control and no actions menu; the discussion can still be opened.
 */
export function SurveyResultList({ surveys }: { surveys: SurveyPayload[] }) {
    const { board } = useBoard();
    const { t } = useTrans();

    if (surveys.length === 0) {
        return null;
    }

    return (
        <ResultsCard title={t('Surveys')}>
            <div
                data-slot="retro-survey-results"
                className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-3"
            >
                {surveys.map((survey) => (
                    <SurveyQuestion
                        key={survey.id}
                        {...toSurveyQuestionProps(survey, {
                            participants: board.participants,
                            mode: 'results',
                        })}
                        aria-label={survey.question}
                        footer={<SurveyDiscussion survey={survey} />}
                    />
                ))}
            </div>
        </ResultsCard>
    );
}
