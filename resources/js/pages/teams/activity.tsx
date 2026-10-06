import { Head } from '@inertiajs/react';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';
import { activitySentence } from '@/lib/teams/activity';
import type { TeamActivityLine, TeamSummary } from '@/types';

type Props = {
    team: TeamSummary;
    lines: TeamActivityLine[];
};

export default function TeamActivity({ team, lines }: Props) {
    const { t } = useTrans();

    return (
        <AppLayout active="settings" title={t('Activity')}>
            <Head title={`${t('Activity')} · ${team.name}`} />
            <ul className="flex min-w-0 flex-col gap-3 text-sm">
                {lines.map((line) => (
                    <li key={line.id} className="wrap-anywhere">
                        {activitySentence(line.kind, t)
                            .replace(':actor', line.actor.name)
                            .replace(':title', line.subject?.title ?? '')}
                    </li>
                ))}
            </ul>
        </AppLayout>
    );
}
