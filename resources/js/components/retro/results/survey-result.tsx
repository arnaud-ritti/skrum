import { SurveyQuestion } from '@/components/skrum/survey-question';
import { toSurveyQuestionProps } from '@/lib/retro/survey-question-adapter';
import type { SurveyPayload } from '@/lib/retro/types';
import { useBoard } from '../board-context';
import { SurveyDiscussion } from '../surveys/survey-discussion';

export function SurveyResult({ survey }: { survey: SurveyPayload }) {
    const { board } = useBoard();

    return (
        <SurveyQuestion
            {...toSurveyQuestionProps(survey, {
                participants: board.participants,
                mode: 'results',
            })}
            aria-label={survey.question}
            footer={<SurveyDiscussion survey={survey} />}
        />
    );
}
