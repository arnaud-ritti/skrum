import { Head } from '@inertiajs/react';
import { TeamPage } from '@/components/teams/team-page';
import type { TeamPageProps } from '@/components/teams/team-page';
import AppLayout from '@/layouts/skrum/app-layout';

export default function ShowTeam(props: TeamPageProps) {
    const { team } = props;

    return (
        <AppLayout active="dashboard" title={team.name}>
            <Head title={team.name} />
            <TeamPage {...props} />
        </AppLayout>
    );
}
