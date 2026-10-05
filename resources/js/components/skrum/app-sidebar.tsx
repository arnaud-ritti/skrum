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
import { markColorClass } from '@/lib/mark-color';
import { cn, firstLetter } from '@/lib/utils';
import type { BrandIdentity } from '@/types';

export type NavKey =
    | 'dashboard'
    | 'sessions'
    | 'actions'
    | 'insights'
    | 'members'
    | 'settings'
    | 'templates'
    | 'teams'
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
    workspaces: {
        id: string;
        name: string;
        href: NavHref;
        /** Teams of the workspace the user can see. */
        teamsCount?: number;
        role?: 'owner' | 'admin' | 'member';
    }[];
    newWorkspaceHref: NavHref;
    newTeamHref?: NavHref;
    homeHref: NavHref;
    links: Partial<Record<NavKey, NavHref>>;
    overdueActions?: number;
    /** Live sessions of the current team the viewer may see. */
    liveSessions?: number;
    /** Where "New session" leads; absent for a viewer who may create none. */
    newSessionHref?: NavHref;
    footer?: ReactNode;
    user?: UserCardUser & { menu?: ReactNode };
};

type Entry = { key: NavKey; label: string; icon: LucideIcon };

function NavEntries({
    entries,
    active,
    links,
    overdueActions = 0,
    liveSessions = 0,
}: {
    entries: Entry[];
    active?: NavKey;
    links: AppSidebarProps['links'];
    overdueActions?: number;
    liveSessions?: number;
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
                const isLive = key === 'sessions' && liveSessions > 0;
                const liveLabel = isLive
                    ? t(':count live', { count: liveSessions })
                    : null;
                const note = overdueLabel ?? liveLabel;
                const accessibleLabel =
                    note === null ? label : `${label}, ${note}`;

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
                            <SidebarMenuBadge className="rounded-full bg-destructive px-1.5 whitespace-nowrap text-destructive-foreground tabular-nums peer-hover/menu-button:text-destructive-foreground">
                                {overdueActions > 99 ? (
                                    <>
                                        <span aria-hidden>
                                            {t(':count overdue', {
                                                count: '99+',
                                            })}
                                        </span>
                                        <span className="sr-only">
                                            {overdueLabel}
                                        </span>
                                    </>
                                ) : (
                                    overdueLabel
                                )}
                            </SidebarMenuBadge>
                        )}
                        {isLive && (
                            <span
                                aria-hidden
                                data-slot="live-dot"
                                className="pointer-events-none absolute top-1 right-1 hidden size-2 rounded-full bg-skrum-success group-data-[collapsible=icon]:block"
                            />
                        )}
                        {isLive && (
                            <SidebarMenuBadge aria-hidden className="gap-1.5">
                                <span
                                    data-slot="live-mark"
                                    className="size-2 rounded-full bg-skrum-success"
                                />
                                {liveSessions}
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
    const roleLabels = {
        owner: t('Owner'),
        admin: t('Admin'),
        member: t('Member'),
    };

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
            <DropdownMenuContent align="start" className="w-70">
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
                                <Link
                                    href={entry.href}
                                    aria-current={
                                        entry.id === team?.id
                                            ? 'true'
                                            : undefined
                                    }
                                >
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
                {workspaces.map((entry) => {
                    const isCurrent = entry.id === workspace?.id;
                    const details = [
                        entry.teamsCount === undefined
                            ? undefined
                            : entry.teamsCount === 1
                              ? t('1 team')
                              : t(':count teams', { count: entry.teamsCount }),
                        entry.role === undefined
                            ? undefined
                            : roleLabels[entry.role],
                    ].filter((detail) => detail !== undefined);

                    return (
                        <DropdownMenuItem
                            key={entry.id}
                            asChild
                            className="min-h-11"
                        >
                            <Link
                                href={entry.href}
                                aria-current={isCurrent ? 'true' : undefined}
                            >
                                <span
                                    aria-hidden
                                    data-slot="workspace-mark"
                                    className={cn(
                                        'flex size-7 shrink-0 items-center justify-center rounded-md border text-xs font-bold',
                                        isCurrent
                                            ? 'border-transparent bg-sidebar-primary text-sidebar-primary-foreground'
                                            : [
                                                  'border-(--col-border) bg-(--col) text-(--col-text)',
                                                  markColorClass(entry.id),
                                              ],
                                    )}
                                >
                                    {firstLetter(entry.name)}
                                </span>
                                <span className="grid min-w-0 flex-1">
                                    <span
                                        className={cn(
                                            'truncate',
                                            isCurrent && 'font-semibold',
                                        )}
                                    >
                                        {entry.name}
                                    </span>
                                    {details.length > 0 && (
                                        <span
                                            data-slot="workspace-details"
                                            className="truncate text-xs text-muted-foreground"
                                        >
                                            {details.join(' · ')}
                                        </span>
                                    )}
                                </span>
                                {isCurrent && (
                                    <Check
                                        aria-hidden
                                        className="size-4 shrink-0 text-skrum-primary-text"
                                    />
                                )}
                            </Link>
                        </DropdownMenuItem>
                    );
                })}
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
    liveSessions,
    newSessionHref,
    footer,
    user,
}: AppSidebarProps) {
    const { t } = useTrans();

    const actionsEntry: Entry = {
        key: 'actions',
        label: t('Actions'),
        icon: ListChecks,
    };

    const hubEntries: Entry[] = [
        { key: 'dashboard', label: t('Home'), icon: LayoutDashboard },
        { key: 'sessions', label: t('Sessions'), icon: CalendarClock },
        actionsEntry,
        { key: 'insights', label: t('Insights'), icon: TrendingUp },
    ];

    const teamEntries: Entry[] = [
        { key: 'members', label: t('Members'), icon: Users },
        { key: 'settings', label: t('Settings'), icon: Settings },
    ];

    const workspaceEntries: Entry[] = [
        { key: 'templates', label: t('Templates'), icon: LayoutTemplate },
        { key: 'teams', label: t('All teams'), icon: Building2 },
    ];

    const adminEntries: Entry[] = [
        { key: 'admin', label: t('Administration'), icon: ShieldCheck },
    ];

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            className="mb-4 hover:bg-transparent active:bg-transparent"
                        >
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
                    {newSessionHref !== undefined && (
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                asChild
                                variant="outline"
                                tooltip={{ children: t('New session') }}
                            >
                                <Link href={newSessionHref}>
                                    <Plus />
                                    <span className="truncate">
                                        {t('New session')}
                                    </span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    )}
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <nav aria-label={t('Navigation')}>
                    {team !== null && (
                        <>
                            <SidebarGroup>
                                <NavEntries
                                    entries={hubEntries}
                                    active={active}
                                    links={links}
                                    overdueActions={overdueActions}
                                    liveSessions={liveSessions}
                                />
                            </SidebarGroup>
                            <SidebarGroup>
                                <SidebarGroupLabel>
                                    {t('Team')}
                                </SidebarGroupLabel>
                                <NavEntries
                                    entries={teamEntries}
                                    active={active}
                                    links={links}
                                />
                            </SidebarGroup>
                        </>
                    )}
                    <SidebarGroup>
                        <SidebarGroupLabel>{t('Workspace')}</SidebarGroupLabel>
                        <NavEntries
                            entries={
                                team === null
                                    ? [actionsEntry, ...workspaceEntries]
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
                {links.admin !== undefined && (
                    <nav aria-label={t('Administration')}>
                        <NavEntries
                            entries={adminEntries}
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
