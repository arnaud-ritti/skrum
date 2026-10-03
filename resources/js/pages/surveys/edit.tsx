import { Head } from '@inertiajs/react';
import { SurveyBuilder } from '@/components/surveys/survey-builder';
import type { SurveySnapshot } from '@/lib/surveys/types';

type Props = { snapshot: SurveySnapshot };

export default function SurveyEdit({ snapshot }: Props) {
    return (
        <>
            <Head title={snapshot.survey.title} />
            <SurveyBuilder key={snapshot.survey.id} snapshot={snapshot} />
        </>
    );
}
