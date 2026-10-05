import { Head } from '@inertiajs/react';
import { SurveyAnswerFlow } from '@/components/surveys/survey-answer-flow';
import { SurveyAnswerList } from '@/components/surveys/survey-answer-list';
import { SurveyBuilder } from '@/components/surveys/survey-builder';
import type { SurveySnapshot } from '@/lib/surveys/types';

type Props = { snapshot: SurveySnapshot };

export default function SurveyEdit({ snapshot }: Props) {
    return (
        <>
            <Head title={snapshot.survey.title} />
            <SurveyBuilder
                key={snapshot.survey.id}
                snapshot={snapshot}
                preview={(current, close) => {
                    const Answer = current.survey.oneQuestionAtATime
                        ? SurveyAnswerFlow
                        : SurveyAnswerList;

                    return (
                        <Answer
                            preview
                            questions={current.questions}
                            onSave={async () => {}}
                            onFinish={close}
                        />
                    );
                }}
            />
        </>
    );
}
