import { Head } from '@inertiajs/react';
import { SurveyResults } from '@/components/surveys/survey-results';
import type { ResultsLayoutProps } from '@/components/surveys/survey-results';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';
import type { SurveySnapshot } from '@/lib/surveys/types';
import type { BreadcrumbItem } from '@/types';

type Props = { snapshot: SurveySnapshot };

/** team › Surveys › title, as the builder; the team's sessions hold the surveys. */
function MemberLayout({
    snapshot,
    status,
    actions,
    children,
}: ResultsLayoutProps) {
    const { t } = useTrans();
    const { survey, links } = snapshot;
    const breadcrumbs: BreadcrumbItem[] =
        links.team === null
            ? [{ title: survey.title, href: links.results }]
            : [
                  { title: survey.teamName ?? t('Team'), href: links.team },
                  { title: t('Surveys'), href: links.team },
                  { title: survey.title, href: links.results },
              ];

    return (
        <AppLayout
            active="sessions"
            breadcrumbs={breadcrumbs}
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
