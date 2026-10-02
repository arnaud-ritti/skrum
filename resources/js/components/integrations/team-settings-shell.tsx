import { usePage } from '@inertiajs/react';
import { Plug, Users } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import { SubNav } from '@/components/skrum/sub-nav';
import type { SubNavItem } from '@/components/skrum/sub-nav';
import { useInitials } from '@/hooks/use-initials';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';
import type { TeamSummary, WorkspaceSummary } from '@/types';

export type TeamSettingsSection = 'team' | 'integrations';

type TeamSettingsNavEntry = Omit<SubNavItem, 'current'> & {
    section: TeamSettingsSection;
};

export function TeamSettingsShell({
    workspace,
    team,
    active,
    children,
}: {
    workspace: Pick<WorkspaceSummary, 'slug'>;
    team: TeamSummary;
    active: TeamSettingsSection;
    children: ReactNode;
}): ReactElement {
    const { t } = useTrans();
    const { currentTeam } = usePage().props;
    const initials = useInitials();
    const scope = { workspace: workspace.slug, team: team.id };
    const teamUrl = TeamsController.show.url(scope);
    /** The navigation takes its entries from this list: a new section is one more row. */
    const entries: TeamSettingsNavEntry[] = [
        {
            section: 'team',
            label: t('Team'),
            icon: Users,
            href: `${teamUrl}#settings`,
        },
        {
            section: 'integrations',
            label: t('Integrations'),
            icon: Plug,
            href: TeamIntegrationsController.index(scope),
        },
    ];
    const current =
        entries.find((entry) => entry.section === active) ?? entries[1];
    const membersCount =
        currentTeam?.id === team.id ? currentTeam.membersCount : null;

    return (
        <AppLayout
            active="settings"
            breadcrumbs={[
                { title: team.name, href: teamUrl },
                { title: t('Team settings'), href: entries[1].href },
                { title: current.label, href: current.href },
            ]}
        >
            <div
                data-slot="team-settings-shell"
                className="flex min-w-0 flex-col gap-6"
            >
                <div className="flex min-w-0 items-center gap-4">
                    <span
                        aria-hidden="true"
                        data-slot="team-mark"
                        className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground"
                    >
                        {initials(team.name)}
                    </span>
                    <div className="flex min-w-0 flex-col">
                        <h1 className="truncate text-2xl font-title tracking-heading">
                            {team.name}
                        </h1>
                        {membersCount !== null && (
                            <p
                                data-slot="team-settings-facts"
                                className="text-sm/snug text-muted-foreground"
                            >
                                {membersCount === 1
                                    ? t('1 member')
                                    : t(':count members', {
                                          count: membersCount,
                                      })}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:gap-10">
                    <SubNav
                        label={t('Team settings')}
                        items={entries.map(({ section, ...entry }) => ({
                            ...entry,
                            current: section === active,
                        }))}
                    />
                    <div className="flex max-w-200 min-w-0 flex-1 flex-col gap-6">
                        {children}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
