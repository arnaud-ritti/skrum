import { Head } from '@inertiajs/react';
import { TeamGames } from '@/components/games/team-games';
import type { TeamGamesProps } from '@/components/games/team-games';
import { InsightsTabs } from '@/components/teams/insights-tabs';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function GamesIndex(props: TeamGamesProps) {
    const { t } = useTrans();
    return (
        <AppLayout active="insights" title={t('Insights')}>
            <Head title={t('Games')} />
            <InsightsTabs
                workspace={props.workspace}
                team={props.team}
                active="games"
            />
            <TeamGames {...props} />
        </AppLayout>
    );
}
