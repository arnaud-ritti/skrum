import { usePage } from '@inertiajs/react';
import { Database, Plug, Settings, Users } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import TeamDataController from '@/actions/App/Http/Controllers/TeamDataController';
import TeamRitualsController from '@/actions/App/Http/Controllers/TeamRitualsController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import TeamSettingsController from '@/actions/App/Http/Controllers/TeamSettingsController';
import { SubNav } from '@/components/skrum/sub-nav';
import type { SubNavItem } from '@/components/skrum/sub-nav';
import { getInitials } from '@/lib/initials';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';
import type {
    TeamSettingsSections,
    TeamSummary,
    WorkspaceSummary,
} from '@/types';

type TeamSettingsSection = 'general' | 'rituals' | 'integrations' | 'data';

type TeamSettingsNavEntry = Omit<SubNavItem, 'current'> & {
    section: TeamSettingsSection;
    href: string;
};

export function TeamSettingsShell({
    workspace,
    team,
    active,
    sections,
    createdAt,
    membersCount: givenMembersCount,
    children,
}: {
    workspace: Pick<WorkspaceSummary, 'slug'>;
    team: TeamSummary & { description?: string | null };
    active: TeamSettingsSection;
    /** The tabs the viewer may open: `TeamSettingsSections`. */
    sections: TeamSettingsSections;
    /** When the team was created; the header says the month when it is given. */
    createdAt?: string | null;
    /** The page's own count; the sidebar's count of the current team otherwise. */
    membersCount?: number;
    children: ReactNode;
}): ReactElement {
    const { t } = useTrans();
    const { currentTeam, locale } = usePage().props;
    const scope = { workspace: workspace.slug, team: team.id };
    const teamUrl = TeamsController.show.url(scope);
    /** The navigation takes its entries from this list, in the order of the mockup. */
    const entries: TeamSettingsNavEntry[] = [
        {
            section: 'general' as const,
            label: t('General'),
            icon: Settings,
            href: TeamSettingsController.show.url(scope),
        },
        {
            section: 'rituals' as const,
            label: t('Members & rituals'),
            icon: Users,
            href: TeamRitualsController.show.url(scope),
        },
        {
            section: 'integrations' as const,
            label: t('Integrations'),
            icon: Plug,
            href: TeamIntegrationsController.index.url(scope),
        },
        {
            section: 'data' as const,
            label: t('Data & export'),
            icon: Database,
            href: TeamDataController.show.url(scope),
        },
    ].filter((entry) => sections[entry.section] || entry.section === active);
    const current =
        entries.find((entry) => entry.section === active) ?? entries[0];
    const membersCount =
        givenMembersCount ??
        (currentTeam?.id === team.id ? currentTeam.membersCount : null);
    const facts = [
        team.description || null,
        membersCount === null
            ? null
            : membersCount === 1
              ? t('1 member')
              : t(':count members', { count: membersCount }),
        createdAt
            ? t('created in :date', {
                  date: new Intl.DateTimeFormat(locale, {
                      month: 'long',
                      year: 'numeric',
                  }).format(new Date(createdAt)),
              })
            : null,
    ].filter((fact): fact is string => fact !== null);

    return (
        <AppLayout
            active="settings"
            breadcrumbs={[
                { title: team.name, href: teamUrl },
                {
                    title: t('Team settings'),
                    href: sections.firstUrl ?? current.href,
                },
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
                        {getInitials(team.name)}
                    </span>
                    <div className="flex min-w-0 flex-col">
                        <h1 className="truncate text-2xl font-title tracking-heading">
                            {team.name}
                        </h1>
                        {facts.length > 0 && (
                            <p
                                data-slot="team-settings-facts"
                                className="text-sm/snug text-muted-foreground"
                            >
                                {facts.join(' · ')}
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
