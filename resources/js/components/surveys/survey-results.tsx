import { router, usePage } from '@inertiajs/react';
import { useCallback, useId, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import TeamSurveyExportsController from '@/actions/App/Http/Controllers/TeamSurveys/TeamSurveyExportsController';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSurveyComparison } from '@/hooks/use-survey-comparison';
import { useTeamSurvey } from '@/hooks/use-team-survey';
import { useTrans } from '@/hooks/use-trans';
import { surveyApi } from '@/lib/surveys/api';
import { deltasByQuestion } from '@/lib/surveys/compare';
import type { SurveySnapshot, SurveyStatus } from '@/lib/surveys/types';
import { ResultsCompare } from './results-compare';
import { ResultsFreeText, takesFreeText } from './results-free-text';
import { ResultsHeader, ResultsStatus } from './results-header';
import { ResultsState, resultsStateOf } from './results-states';
import { ResultsSummary } from './results-summary';
import { SurveyShare } from './survey-share';

export type ResultsTab = 'summary' | 'free-text' | 'compare';

export type ResultsLayoutProps = {
    snapshot: SurveySnapshot;
    /** The status badge, beside the breadcrumb. */
    status: ReactNode;
    /** The actions, at the end of the topbar. */
    actions: ReactNode;
    children: ReactNode;
};

type SurveyResultsProps = {
    initial: SurveySnapshot;
    /** The frame of a member's page (the app layout); a guest gets a bare `main`. */
    layout?: ComponentType<ResultsLayoutProps>;
};

const TabParameter = 'tab';

function BareLayout({ status, actions, children }: ResultsLayoutProps) {
    return (
        <>
            {status}
            {actions}
            {children}
        </>
    );
}

function tabFromAddress(available: ResultsTab[]): ResultsTab {
    if (typeof window === 'undefined') {
        return 'summary';
    }

    const requested = new URLSearchParams(window.location.search).get(
        TabParameter,
    );

    return available.find((tab) => tab === requested) ?? 'summary';
}

function addressWithTab(tab: ResultsTab): string {
    const url = new URL(window.location.href);

    if (tab === 'summary') {
        url.searchParams.delete(TabParameter);
    } else {
        url.searchParams.set(TabParameter, tab);
    }

    return `${url.pathname}${url.search}${url.hash}`;
}

/** The tab lives in `?tab=`, so that a link or a reload opens it again. */
function useResultsTab(available: ResultsTab[]) {
    const [tab, setTab] = useState<ResultsTab>(() => tabFromAddress(available));

    const select = useCallback((next: ResultsTab) => {
        setTab(next);
        router.replace({
            url: addressWithTab(next),
            preserveScroll: true,
            preserveState: true,
        });
    }, []);

    return [available.includes(tab) ? tab : 'summary', select] as const;
}

type Translate = ReturnType<typeof useTrans>['t'];

function answersLine(
    t: Translate,
    responses: number,
    audience: number,
): string {
    if (audience === 1) {
        return responses === 1
            ? t('1 answer out of 1 participant · anonymous')
            : t(':responses answers out of 1 participant · anonymous', {
                  responses,
              });
    }

    return responses === 1
        ? t('1 answer out of :audience participants · anonymous', { audience })
        : t(':responses answers out of :audience participants · anonymous', {
              responses,
              audience,
          });
}

function useClosedOn(closedAt: string | null): string | null {
    const { locale } = usePage().props as { locale?: string };

    if (closedAt === null) {
        return null;
    }

    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(closedAt));
}

export function SurveyResults({
    initial,
    layout: Layout = BareLayout,
}: SurveyResultsProps) {
    const { t } = useTrans();
    const headingId = useId();
    const { snapshot, dispatch, online, refetch } = useTeamSurvey(initial);
    const { survey, me, progress } = snapshot;
    const closedOn = useClosedOn(
        survey.status === 'closed' ? survey.closedAt : null,
    );

    const available: ResultsTab[] = [
        'summary',
        ...(snapshot.questions.some(takesFreeText)
            ? (['free-text'] as const)
            : []),
        ...(me.isGuest ? [] : (['compare'] as const)),
    ];
    const [tab, selectTab] = useResultsTab(available);
    const [freeTextTarget, setFreeTextTarget] = useState<string | null>(null);
    const clearFreeTextTarget = useCallback(() => setFreeTextTarget(null), []);
    const showsCards = resultsStateOf(snapshot) === 'summary';
    const defaultComparison = useSurveyComparison(
        survey.id,
        me.isGuest || !showsCards
            ? null
            : (snapshot.comparable?.defaultId ?? null),
    );
    const deltas =
        defaultComparison.load.status === 'ready'
            ? deltasByQuestion(defaultComparison.load.comparison)
            : undefined;
    const canExport =
        me.isEditor &&
        !me.isGuest &&
        survey.status === 'closed' &&
        progress.responses >= survey.resultsThreshold;

    const setStatus = async (status: SurveyStatus): Promise<void> => {
        await surveyApi.setStatus(survey.id, status);
        await refetch();
    };

    const header = (
        <ResultsHeader
            status={survey.status}
            isEditor={me.isEditor && !me.isGuest}
            canExport={canExport}
            exportUrl={TeamSurveyExportsController.show(survey.id).url}
            onSetStatus={setStatus}
            share={
                <SurveyShare
                    snapshot={snapshot}
                    online={online}
                    dispatch={dispatch}
                    label={t('Share with the team')}
                />
            }
        />
    );
    const status = <ResultsStatus status={survey.status} />;

    const line = [
        answersLine(t, progress.responses, progress.audience),
        closedOn === null ? null : t('closed on :date', { date: closedOn }),
    ]
        .filter((part) => part !== null)
        .join(' · ');

    const content = (
        <Tabs
            value={tab}
            onValueChange={(value) => selectTab(value as ResultsTab)}
            className="gap-4"
        >
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <h1
                        id={headingId}
                        className="font-display text-2xl font-semibold"
                    >
                        {t('Results')}
                    </h1>
                    <p
                        data-slot="survey-results-line"
                        className="text-sm text-muted-foreground tabular-nums"
                    >
                        {line}
                    </p>
                </div>
                <TabsList aria-label={t('Results')}>
                    <TabsTrigger value="summary">{t('Summary')}</TabsTrigger>
                    {available.includes('free-text') && (
                        <TabsTrigger value="free-text">
                            {t('Free-text answers')}
                        </TabsTrigger>
                    )}
                    {available.includes('compare') && (
                        <TabsTrigger value="compare">
                            {t('Compare')}
                        </TabsTrigger>
                    )}
                </TabsList>
            </div>
            <TabsContent value="summary">
                {showsCards ? (
                    <ResultsSummary
                        snapshot={snapshot}
                        deltas={deltas}
                        onShowFreeText={(questionId) => {
                            setFreeTextTarget(questionId);
                            selectTab('free-text');
                        }}
                    />
                ) : (
                    <ResultsState snapshot={snapshot} />
                )}
            </TabsContent>
            {available.includes('free-text') && (
                <TabsContent value="free-text">
                    {showsCards ? (
                        <ResultsFreeText
                            snapshot={snapshot}
                            targetQuestionId={freeTextTarget}
                            onTargetReached={clearFreeTextTarget}
                        />
                    ) : (
                        <ResultsState snapshot={snapshot} />
                    )}
                </TabsContent>
            )}
            {available.includes('compare') && (
                <TabsContent value="compare">
                    {showsCards ? (
                        <ResultsCompare
                            surveyId={survey.id}
                            comparable={snapshot.comparable}
                            defaultLoad={defaultComparison.load}
                            onRetryDefault={defaultComparison.retry}
                        />
                    ) : (
                        <ResultsState snapshot={snapshot} />
                    )}
                </TabsContent>
            )}
        </Tabs>
    );

    if (me.isGuest) {
        return (
            <main
                aria-labelledby={headingId}
                className="mx-auto flex w-full max-w-page min-w-0 flex-col gap-4 px-4 py-6 md:px-10"
            >
                <div className="flex flex-wrap items-center justify-between gap-2">
                    {status}
                    {header}
                </div>
                {content}
            </main>
        );
    }

    return (
        <Layout snapshot={snapshot} status={status} actions={header}>
            <section
                aria-labelledby={headingId}
                className="flex min-w-0 flex-col gap-4"
            >
                {content}
            </section>
        </Layout>
    );
}
