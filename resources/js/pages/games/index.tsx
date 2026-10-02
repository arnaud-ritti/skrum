import { Head } from '@inertiajs/react';
import TeamGameRoomsController from '@/actions/App/Http/Controllers/TeamGameRoomsController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import { TeamGames } from '@/components/games/team-games';
import type { TeamGamesProps } from '@/components/games/team-games';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function GamesIndex(props: TeamGamesProps) {
    const { t } = useTrans();
    const team = { workspace: props.workspace.slug, team: props.team.id };

    return (
        <AppLayout
            active="games"
            breadcrumbs={[
                { title: props.team.name, href: TeamsController.show(team) },
                {
                    title: t('Games'),
                    href: TeamGameRoomsController.index(team),
                },
            ]}
        >
            <Head title={t('Games')} />
            <TeamGames {...props} />
        </AppLayout>
    );
}
