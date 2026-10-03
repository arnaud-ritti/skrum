import { Link } from '@inertiajs/react';
import { EyeOff, Hourglass } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/skrum/empty-state';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import type { SurveySnapshot } from '@/lib/surveys/types';

export type ResultsStateKind =
    | 'summary'
    | 'belowThreshold'
    | 'empty'
    | 'afterClose'
    | 'answerFirst'
    | 'loading';

const SkeletonCards = 3;

/** What the viewer sees in place of the cards, as the server's snapshot allows. */
export function resultsStateOf(snapshot: SurveySnapshot): ResultsStateKind {
    const { me, survey, results } = snapshot;

    if (!me.canSeeResults) {
        return survey.showResultsAfterAnswer && !me.hasSubmitted
            ? 'answerFirst'
            : 'afterClose';
    }

    if (results === null) {
        return 'loading';
    }

    if (results.belowThreshold) {
        return 'belowThreshold';
    }

    if (results.responses === 0) {
        return 'empty';
    }

    return 'summary';
}

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <div
            role="status"
            data-slot="survey-results-state"
            className="flex min-w-0 flex-col items-center gap-3 rounded-lg border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-card"
        >
            <span aria-hidden="true" className="text-skrum-primary-text">
                {icon}
            </span>
            {children}
        </div>
    );
}

function ResultsSkeleton() {
    const { t } = useTrans();

    return (
        <div
            role="status"
            aria-label={t('Loading')}
            data-slot="survey-results-state"
            className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(88)),1fr))] gap-4"
        >
            {Array.from({ length: SkeletonCards }, (_, index) => (
                <div
                    key={index}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-card"
                >
                    <Skeleton className="h-2.5 w-1/4 rounded-full" />
                    <Skeleton className="h-3 w-3/5 rounded-full" />
                    <Skeleton className="h-8 w-1/3 rounded-md" />
                    <Skeleton className="h-2 w-full rounded-full" />
                    <Skeleton className="h-2 w-4/5 rounded-full" />
                </div>
            ))}
        </div>
    );
}

/** The state that takes the place of the cards; nothing when the cards show. */
export function ResultsState({ snapshot }: { snapshot: SurveySnapshot }) {
    const { t } = useTrans();
    const state = resultsStateOf(snapshot);

    switch (state) {
        case 'summary':
            return null;
        case 'loading':
            return <ResultsSkeleton />;
        case 'belowThreshold': {
            const threshold = snapshot.survey.resultsThreshold;
            const responses = snapshot.results?.responses ?? 0;

            return (
                <Notice icon={<Hourglass className="size-6" />}>
                    <p className="text-foreground">
                        {t(
                            'Results appear from :threshold answers. :responses so far.',
                            { threshold, responses },
                        )}
                    </p>
                    <Progress
                        className="w-full max-w-xs"
                        value={responses}
                        max={threshold}
                        valueLabel={`${responses} / ${threshold}`}
                        aria-label={t('Answers')}
                    />
                </Notice>
            );
        }
        case 'afterClose':
            return (
                <Notice icon={<EyeOff className="size-6" />}>
                    <p className="text-foreground">
                        {t('Results will show when the survey is closed.')}
                    </p>
                </Notice>
            );
        case 'answerFirst':
            return (
                <Notice icon={<EyeOff className="size-6" />}>
                    <Link
                        href={snapshot.links.show}
                        className="font-medium text-skrum-primary-text underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                        {t('Answer the survey to see the results.')}
                    </Link>
                </Notice>
            );
        case 'empty':
            return (
                <div role="status" data-slot="survey-results-state">
                    <EmptyState
                        module="survey"
                        title={t('No answers yet.')}
                        description={t(
                            'Answers appear here as people send them.',
                        )}
                    />
                </div>
            );
    }
}
