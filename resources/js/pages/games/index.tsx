import { Head } from '@inertiajs/react';
import { TeamGames } from '@/components/games/team-games';
import type { TeamGamesProps } from '@/components/games/team-games';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function GamesIndex(props: TeamGamesProps) {
    const { t } = useTrans();
    return (
        <AppLayout active="insights" title={t('Insights')}>
            <Head title={t('Games')} />
            <TeamGames {...props} />
        </AppLayout>
    );
}
