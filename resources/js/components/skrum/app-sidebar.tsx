import type { InertiaLinkProps } from '@inertiajs/react';
import { Link } from '@inertiajs/react';
import {
    Building2,
    CalendarClock,
    Check,
    ChevronsUpDown,
    LayoutDashboard,
    LayoutTemplate,
    ListChecks,
    type LucideIcon,
    PartyPopper,
    Plus,
    Settings,
    ShieldCheck,
    TrendingUp,
    Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/skrum/brand-logo';
import { SkrumLogo } from '@/components/skrum/skrum-logo';
import { UserCard, type UserCardUser } from '@/components/skrum/user-card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useTrans } from '@/hooks/use-trans';
import type { BrandIdentity } from '@/types';

export type NavKey =
    | 'dashboard'
    | 'sessions'
    | 'actions'
    | 'mood'
    | 'games'
    | 'members'
    | 'templates'
    | 'teams'
    | 'settings'
    | 'admin';

export type NavHref = NonNullable<InertiaLinkProps['href']>;

export type AppSidebarProps = {
    active?: NavKey;
    brand?: BrandIdentity;
    team: {
        id: string;
        name: string;
        initials: string;
        membersCount: number;
    } | null;
    teams: { id: string; name: string; href: NavHref }[];
    workspace: { id: string; name: string } | null;
    workspaces: { id: string; name: string; href: NavHref }[];
    newWorkspaceHref: NavHref;
    newTeamHref?: NavHref;
    homeHref: NavHref;
    links: Partial<Record<NavKey, NavHref>>;
    overdueActions?: number;
    footer?: ReactNode;
    user?: UserCardUser & { menu?: ReactNode };
};

type Entry = { key: NavKey; label: string; icon: LucideIcon };

function NavEntries({
    entries,
    active,
    links,
    overdueActions = 0,
}: {
    entries: Entry[];
    active?: NavKey;
    links: AppSidebarProps['links'];
    overdueActions?: number;
}) {
    const { t } = useTrans();

    return (
        <SidebarMenu>
            {entries.map(({ key, label, icon: Icon }) => {
                const href = links[key];

                if (href === undefined) {
                    return null;
                }

                const isActive = active === key;
                const hasOverdue = key === 'actions' && overdueActions > 0;
                const overdueLabel = hasOverdue
                    ? t(':count overdue', { count: overdueActions })
                    : null;
                const accessibleLabel =
                    overdueLabel === null ? label : `${label}, ${overdueLabel}`;

                return (
                    <SidebarMenuItem key={key}>
                        <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={{ children: accessibleLabel }}
                            className="data-[active=true]:font-semibold"
                        >
                            <Link
                                href={href}
                                prefetch
                                aria-label={accessibleLabel}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                <Icon
                                    className={
                                        isActive
                                            ? 'text-skrum-primary-text'
                                            : undefined
                                    }
                                />
                                <span className="truncate">{label}</span>
                            </Link>
                        </SidebarMenuButton>
                        {hasOverdue && (
                            <span
                                aria-hidden
                                data-slot="overdue-dot"
                                className="pointer-events-none absolute top-1 right-1 hidden size-2 rounded-full bg-destructive group-data-[collapsible=icon]:block"
                            />
                        )}
                        {hasOverdue && (
                            <SidebarMenuBadge className="rounded-full bg-destructive px-1.5 text-destructive-foreground tabular-nums peer-hover/menu-button:text-destructive-foreground">
                                <span aria-hidden>
                                    {overdueActions > 99
                                        ? '99+'
                                        : overdueActions}
                                </span>
                                <span className="sr-only">{overdueLabel}</span>
                            </SidebarMenuBadge>
                        )}
                    </SidebarMenuItem>
                );
            })}
        </SidebarMenu>
    );
}

function TeamSwitcher({
    team,
    teams,
    workspace,
    workspaces,
    newWorkspaceHref,
    newTeamHref,
}: Pick<
    AppSidebarProps,
    | 'team'
    | 'teams'
    | 'workspace'
    | 'workspaces'
    | 'newWorkspaceHref'
    | 'newTeamHref'
>) {
    const { t } = useTrans();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="gap-2">
                    <span
                        aria-hidden
                        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground"
                    >
                        {team?.initials ??
                            workspace?.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="grid min-w-0 flex-1 text-left">
                        <span className="truncate text-sm font-semibold">
                            {team?.name ??
                                workspace?.name ??
                                t('Select a workspace')}
                        </span>
                        {team !== null && workspace !== null && (
                            <span className="truncate text-xs text-muted-foreground">
                                {workspace.name} ·{' '}
                                {team.membersCount === 1
                                    ? t('1 member')
                                    : t(':count members', {
                                          count: team.membersCount,
                                      })}
                            </span>
                        )}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0" />
                </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
                {teams.length > 0 && (
                    <>
                        <DropdownMenuLabel
                            variant="overline"
                            className="truncate"
                        >
                            {t('Teams')}
                        </DropdownMenuLabel>
                        {teams.map((entry) => (
                            <DropdownMenuItem key={entry.id} asChild>
                                <Link href={entry.href}>
                                    <span className="min-w-0 flex-1 truncate">
                                        {entry.name}
                                    </span>
                                    {entry.id === team?.id && (
                                        <Check className="size-4 shrink-0" />
                                    )}
                                </Link>
                            </DropdownMenuItem>
                        ))}
                    </>
                )}
                {newTeamHref !== undefined && (
                    <DropdownMenuItem asChild>
                        <Link href={newTeamHref}>
                            <Plus className="size-4 shrink-0" />
                            <span className="truncate">{t('New team')}</span>
                        </Link>
                    </DropdownMenuItem>
                )}
                {(teams.length > 0 || newTeamHref !== undefined) && (
                    <DropdownMenuSeparator />
                )}
                <DropdownMenuLabel variant="overline" className="truncate">
                    {t('Workspaces')}
                </DropdownMenuLabel>
                {workspaces.map((entry) => (
                    <DropdownMenuItem key={entry.id} asChild>
                        <Link href={entry.href}>
                            <span className="min-w-0 flex-1 truncate">
                                {entry.name}
                            </span>
                            {entry.id === workspace?.id && (
                                <Check className="size-4 shrink-0" />
                            )}
                        </Link>
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href={newWorkspaceHref}>
                        <Plus className="size-4 shrink-0" />
                        <span className="truncate">{t('New workspace')}</span>
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function AppSidebar({
    active,
    brand,
    team,
    teams,
    workspace,
    workspaces,
    newWorkspaceHref,
    newTeamHref,
    homeHref,
    links,
    overdueActions,
    footer,
    user,
}: AppSidebarProps) {
    const { t } = useTrans();

    const teamEntries: Entry[] = [
        { key: 'dashboard', label: t('Dashboard'), icon: LayoutDashboard },
        { key: 'sessions', label: t('Sessions'), icon: CalendarClock },
        { key: 'actions', label: t('Actions'), icon: ListChecks },
        { key: 'mood', label: t('Mood & ROTI'), icon: TrendingUp },
        { key: 'games', label: t('Games'), icon: PartyPopper },
        { key: 'members', label: t('Members'), icon: Users },
    ];

    const workspaceEntries: Entry[] = [
        { key: 'templates', label: t('Templates'), icon: LayoutTemplate },
        { key: 'teams', label: t('All teams'), icon: Building2 },
    ];

    const footerEntries: Entry[] = [
        { key: 'settings', label: t('Team settings'), icon: Settings },
        { key: 'admin', label: t('Administration'), icon: ShieldCheck },
    ];

    const hasFooterLinks =
        links.settings !== undefined || links.admin !== undefined;

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                            <Link
                                href={homeHref}
                                prefetch
                                aria-label={brand?.name ?? 'Skrüm'}
                                className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
                            >
                                <BrandLogo
                                    brand={brand}
                                    className="h-7"
                                    fallback={
                                        <>
                                            <SkrumLogo
                                                decorative
                                                variant="symbol"
                                                className="size-6!"
                                            />
                                            <SkrumLogo
                                                decorative
                                                variant="wordmark"
                                                className="h-5! w-auto! group-data-[collapsible=icon]:hidden"
                                            />
                                        </>
                                    }
                                />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <TeamSwitcher
                            team={team}
                            teams={teams}
                            workspace={workspace}
                            workspaces={workspaces}
                            newWorkspaceHref={newWorkspaceHref}
                            newTeamHref={newTeamHref}
                        />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <nav aria-label={t('Navigation')}>
                    {team !== null && (
                        <SidebarGroup>
                            <SidebarGroupLabel>{t('Team')}</SidebarGroupLabel>
                            <NavEntries
                                entries={teamEntries}
                                active={active}
                                links={links}
                                overdueActions={overdueActions}
                            />
                        </SidebarGroup>
                    )}
                    <SidebarGroup>
                        <SidebarGroupLabel>{t('Workspace')}</SidebarGroupLabel>
                        <NavEntries
                            entries={
                                team === null
                                    ? [
                                          ...teamEntries.filter(
                                              (entry) =>
                                                  entry.key === 'actions',
                                          ),
                                          ...workspaceEntries,
                                      ]
                                    : workspaceEntries
                            }
                            active={active}
                            links={links}
                            overdueActions={overdueActions}
                        />
                    </SidebarGroup>
                </nav>
            </SidebarContent>

            <SidebarFooter>
                {hasFooterLinks && (
                    <nav aria-label={t('Team and administration')}>
                        <NavEntries
                            entries={footerEntries}
                            active={active}
                            links={links}
                        />
                    </nav>
                )}
                {footer ??
                    (user !== undefined && (
                        <UserCard user={user} menu={user.menu} />
                    ))}
            </SidebarFooter>
        </Sidebar>
    );
}
