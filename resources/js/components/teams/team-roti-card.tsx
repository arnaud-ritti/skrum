import { usePage } from '@inertiajs/react';
import { RotiTrendCard } from '@/components/skrum/roti-trend-card';
import { TrendError, TrendSkeleton } from '@/components/teams/trend-states';
import type { TrendState } from '@/components/teams/trend-states';
import { useTrans } from '@/hooks/use-trans';
import { toRotiPoints } from '@/lib/teams/mood-adapter';

/** The average ROTI of the last retros of the team, in the main column. */
export function TeamRotiCard({ trend, failed = false, onRetry }: TrendState) {
    const { t } = useTrans();
    const { locale } = usePage().props;

    if (failed) {
        return <TrendError title={t('Mood trend')} onRetry={onRetry} />;
    }

    if (trend === undefined) {
        return <TrendSkeleton />;
    }

    return (
        <div data-slot="team-roti" className="min-w-0">
            <RotiTrendCard
                points={toRotiPoints(trend, locale as string | undefined)}
            />
        </div>
    );
}
