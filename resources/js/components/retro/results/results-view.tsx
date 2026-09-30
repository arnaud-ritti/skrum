import { usePage } from '@inertiajs/react';
import { DeliveryLines } from '@/components/integrations/share/delivery-lines';
import { useIsMounted } from '@/hooks/use-is-mounted';
import { useTrans } from '@/hooks/use-trans';
import { useBoard } from '../board-context';
import { ActionItemsResults } from './action-items-results';
import { GamesPlayedSection } from './games-played-section';
import { HealthSection } from './health-section';
import { SummarySection } from '../insights/summary-section';
import { ParticipantsSection } from './participants-section';
import { ResultsSection } from './results-section';
import { ResultsShareMenu } from './results-share-menu';
import { RotiSection } from './roti-section';
import { SurveyResult } from './survey-result';
import { TopTopics } from './top-topics';

export function ResultsView() {
    const { board } = useBoard();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const isMounted = useIsMounted();
    const { results } = board;

    if (results === null) {
        return null;
    }

    const completedAt =
        isMounted && board.retro.completedAt
            ? new Date(board.retro.completedAt).toLocaleString(locale, {
                  dateStyle: 'long',
                  timeStyle: 'short',
              })
            : null;

    return (
        <div className="mx-auto w-full max-w-4xl space-y-8 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    {completedAt && (
                        <p className="text-sm text-muted-foreground">
                            {t('Retrospective completed on :date', {
                                date: completedAt,
                            })}
                        </p>
                    )}
                    <DeliveryLines deliveries={results.deliveries} />
                </div>
                <ResultsShareMenu />
            </div>
            <ParticipantsSection participants={results.participants} />
            <SummarySection />
            {results.health && (
                <HealthSection
                    health={results.health}
                    trend={results.healthTrend}
                />
            )}
            {results.surveys.length > 0 && (
                <ResultsSection title={t('Surveys')}>
                    <div className="grid gap-3 md:grid-cols-2">
                        {results.surveys.map((survey) => (
                            <SurveyResult key={survey.id} survey={survey} />
                        ))}
                    </div>
                </ResultsSection>
            )}
            <TopTopics />
            <ActionItemsResults />
            {results.games && <GamesPlayedSection games={results.games} />}
            <RotiSection roti={results.roti} />
        </div>
    );
}
