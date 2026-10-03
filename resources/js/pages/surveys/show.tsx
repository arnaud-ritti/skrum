import { Head } from '@inertiajs/react';
import { SurveyRoom } from '@/components/surveys/survey-room';
import type { SurveySnapshot } from '@/lib/surveys/types';

type Props = { snapshot: SurveySnapshot };

export default function Survey({ snapshot }: Props) {
    return (
        <>
            <Head title={snapshot.survey.title} />
            <SurveyRoom initial={snapshot} />
        </>
    );
}
