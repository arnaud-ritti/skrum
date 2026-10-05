import { Head } from '@inertiajs/react';
import { SurveyResults } from '@/components/surveys/survey-results';
import type { ResultsLayoutProps } from '@/components/surveys/survey-results';
import AppLayout from '@/layouts/skrum/app-layout';
import type { SurveySnapshot } from '@/lib/surveys/types';

type Props = { snapshot: SurveySnapshot };

function MemberLayout({
    snapshot,
    status,
    actions,
    children,
}: ResultsLayoutProps) {
    return (
        <AppLayout
            active="sessions"
            title={snapshot.survey.title}
            status={status}
            actions={actions}
        >
            {children}
        </AppLayout>
    );
}

export default function SurveyResultsPage({ snapshot }: Props) {
    return (
        <>
            <Head title={snapshot.survey.title} />
            <SurveyResults initial={snapshot} layout={MemberLayout} />
        </>
    );
}
