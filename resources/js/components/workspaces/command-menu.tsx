import { router, usePage } from '@inertiajs/react';
import {
    Bell,
    Building2,
    CalendarClock,
    ClipboardList,
    History,
    Keyboard,
    KeyRound,
    Layers,
    LayoutDashboard,
    LayoutTemplate,
    ListChecks,
    Moon,
    PenTool,
    Plus,
    Search,
    Settings,
    ShieldCheck,
    Spade,
    Sparkles,
    StickyNote,
    Sun,
    TrendingUp,
    UserPlus,
    UserRound,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import WorkspaceMembersController from '@/actions/App/Http/Controllers/WorkspaceMembersController';
import type { AppSidebarProps, NavKey } from '@/components/skrum/app-sidebar';
import { detectPlatform } from '@/components/skrum/keyboard-shortcuts';
import { teamSettingsPages } from '@/components/team-settings/team-settings-pages';
import { insightsPages } from '@/components/teams/insights-tabs';
import type { SessionType } from '@/components/teams/session-create/use-new-session-intent';
import { Button } from '@/components/ui/button';
import { CommandPalette } from '@/components/ui/command';
import type { CommandPaletteItem } from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { useAppearance } from '@/hooks/use-appearance';
import type { ResolvedAppearance } from '@/hooks/use-appearance';
import { useGlobalSearch } from '@/hooks/use-global-search';
import { useIsMounted } from '@/hooks/use-is-mounted';
import type { SearchResult, SearchResultKind } from '@/hooks/use-global-search';
import { useRecentSessions } from '@/hooks/use-recent-sessions';
import type { RecentSession } from '@/hooks/use-recent-sessions';
import { useShortcutSequence } from '@/hooks/use-shortcut-sequence';
import {
    openCommandMenuEvent,
    openKeyboardShortcutsEvent,
} from '@/lib/shortcuts/events';
import { useTrans } from '@/hooks/use-trans';
import { create as joinWithCode } from '@/routes/joinCodes';
import { edit as notificationSettings } from '@/routes/notificationPreferences';
import { edit as profileSettings } from '@/routes/profile';
import { edit as securitySettings } from '@/routes/security';

export { openCommandMenuEvent, openKeyboardShortcutsEvent };

type Translate = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

type Links = AppSidebarProps['links'];

type Href = NonNullable<Links[NavKey]>;

const KindIcons: Record<SearchResultKind, LucideIcon> = {
    retro: Layers,
    poker: Spade,
    whiteboard: PenTool,
    game: Sparkles,
    survey: ClipboardList,
    action: ListChecks,
    card: StickyNote,
};

const DayMs = 86_400_000;
const HourMs = 3_600_000;
const MinuteMs = 60_000;

function urlOf(href: Href): string {
    return typeof href === 'string' ? href : href.url;
}

function visit(href: Href): void {
    router.visit(urlOf(href));
}

/**
 * "2 days ago" under seven days, "16 Sept" otherwise, in the page's locale.
 */
export function recentDate(
    updatedAt: string,
    locale: string,
    now: number = Date.now(),
): string {
    const then = new Date(updatedAt).getTime();

    if (Number.isNaN(then)) {
        return '';
    }

    const elapsed = Math.max(0, now - then);

    if (elapsed >= 7 * DayMs) {
        return new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'short',
        }).format(then);
    }

    const relative = new Intl.RelativeTimeFormat(locale, {
        numeric: 'auto',
        style: 'short',
    });

    if (elapsed >= DayMs) {
        return relative.format(-Math.floor(elapsed / DayMs), 'day');
    }

    if (elapsed >= HourMs) {
        return relative.format(-Math.floor(elapsed / HourMs), 'hour');
    }

    return relative.format(-Math.floor(elapsed / MinuteMs), 'minute');
}

export function resultItems(
    results: SearchResult[],
    term: string,
): CommandPaletteItem[] {
    return results.map((result) => ({
        id: `${result.kind}-${result.id}`,
        group: 'results',
        label: result.title,
        icon: KindIcons[result.kind],
        meta:
            result.kind === 'card'
                ? (result.context ?? result.team.name)
                : result.team.name,
        keywords: [term],
        onSelect: () => router.visit(result.url),
    }));
}

/** A live session first, as the server sends them; the retro names its team, the others their kind. */
export function recentItems(
    sessions: RecentSession[],
    t: Translate,
    locale: string,
    now: number = Date.now(),
): CommandPaletteItem[] {
    const kinds: Record<RecentSession['kind'], string> = {
        retro: t('Retrospective'),
        poker: t('Planning poker'),
        whiteboard: t('Whiteboard'),
        game: t('Game'),
        survey: t('Survey'),
    };

    return [...sessions]
        .sort((first, second) => Number(second.live) - Number(first.live))
        .map((session) => {
            const subject =
                session.kind === 'retro'
                    ? session.team.name
                    : kinds[session.kind];
            const date = recentDate(session.updatedAt, locale, now);

            return {
                id: `recent-${session.kind}-${session.id}`,
                group: 'recent',
                label: session.title,
                icon: KindIcons[session.kind],
                meta: date === '' ? subject : `${subject} · ${date}`,
                badge: session.live ? t('Live') : undefined,
                onSelect: () => router.visit(session.url),
            } satisfies CommandPaletteItem;
        });
}

type CommandMenuContext = {
    /** Page of the current team, where the "New session" dialog lives. */
    teamUrl?: string;
    /** Members page of the current workspace, for those who may invite. */
    invite?: { workspace: string; url: string };
    /** The theme on screen and what flips it. */
    theme?: { resolved: ResolvedAppearance; onToggle: () => void };
};

export function actionItems(
    { teamUrl, invite, theme }: CommandMenuContext,
    t: Translate,
): CommandPaletteItem[] {
    const items: CommandPaletteItem[] = [];

    /** The five kinds of the "New session" dialog, in its order; a survey is a "poll" on the Sessions page. */
    const newSessions: {
        type: SessionType;
        label: string;
        icon: LucideIcon;
        keywords?: string[];
    }[] = [
        { type: 'retro', label: t('New retrospective'), icon: Plus },
        { type: 'poker', label: t('New poker session'), icon: Spade },
        { type: 'whiteboard', label: t('New whiteboard'), icon: PenTool },
        {
            type: 'survey',
            label: t('New survey'),
            icon: ClipboardList,
            keywords: [t('Poll')],
        },
        { type: 'icebreaker', label: t('New icebreaker'), icon: Sparkles },
    ];

    if (teamUrl !== undefined) {
        items.push(
            ...newSessions.map(({ type, label, icon, keywords }) => ({
                id: `new-${type}`,
                group: 'actions' as const,
                label,
                icon,
                keywords,
                onSelect: () => router.visit(`${teamUrl}?new=${type}`),
            })),
        );
    }

    items.push({
        id: 'join',
        group: 'actions',
        label: t('Join a session with a code'),
        icon: KeyRound,
        onSelect: () => router.visit(joinWithCode.url()),
    });

    if (invite !== undefined) {
        items.push({
            id: 'invite',
            group: 'actions',
            label: t('Invite to :workspace', { workspace: invite.workspace }),
            icon: UserPlus,
            onSelect: () => router.visit(invite.url),
        });
    }

    if (theme !== undefined) {
        const toDark = theme.resolved === 'light';

        items.push({
            id: 'theme',
            group: 'actions',
            label: toDark
                ? t('Switch to dark theme')
                : t('Switch to light theme'),
            icon: toDark ? Moon : Sun,
            keywords: [t('Theme'), t('Appearance')],
            onSelect: theme.onToggle,
        });
    }

    items.push({
        id: 'shortcuts',
        group: 'actions',
        label: t('Show keyboard shortcuts'),
        icon: Keyboard,
        shortcut: ['?'],
        onSelect: () =>
            window.dispatchEvent(new Event(openKeyboardShortcutsEvent)),
    });

    return items;
}

/** The second key of `G` then a key, for the pages that have one. */
const GotoSequences: Partial<Record<NavKey, string>> = {
    dashboard: 'H',
    sessions: 'E',
    actions: 'A',
    insights: 'I',
    members: 'M',
    templates: 'T',
    admin: 'S',
};

type GotoPage = { id: string; label: string; icon: LucideIcon; href: string };

type GotoExtras = {
    /** The other pages of the team settings the viewer may open. */
    settingsPages?: GotoPage[];
    /** The other tabs of Insights. */
    insightsPages?: GotoPage[];
    /** The other teams of the workspace the viewer belongs to. */
    teams?: GotoPage[];
};

/**
 * One item per link of the sidebar, each followed by its other pages
 * (settings, Insights), then the other teams and the three settings pages of
 * the account.
 */
export function gotoItems(
    links: Links,
    t: Translate,
    { settingsPages = [], insightsPages = [], teams = [] }: GotoExtras = {},
): CommandPaletteItem[] {
    const entries: {
        key: NavKey;
        label: string;
        icon: LucideIcon;
    }[] = [
        { key: 'dashboard', label: t('Home'), icon: LayoutDashboard },
        { key: 'sessions', label: t('Sessions'), icon: CalendarClock },
        { key: 'actions', label: t('Action items'), icon: ListChecks },
        { key: 'insights', label: t('Insights'), icon: TrendingUp },
        { key: 'members', label: t('Members'), icon: Users },
        { key: 'activity', label: t('Activity'), icon: History },
        { key: 'settings', label: t('Settings'), icon: Settings },
        { key: 'templates', label: t('Templates'), icon: LayoutTemplate },
        { key: 'teams', label: t('All teams'), icon: Building2 },
        { key: 'admin', label: t('Administration'), icon: ShieldCheck },
    ];
    const under: Partial<Record<NavKey, { pages: GotoPage[]; of: string }>> = {
        settings: { pages: settingsPages, of: t('Settings') },
        insights: { pages: insightsPages, of: t('Insights') },
    };
    const teamWord = t('Team');
    const account: {
        id: string;
        label: string;
        icon: LucideIcon;
        url: string;
    }[] = [
        {
            id: 'profile',
            label: t('Profile'),
            icon: UserRound,
            url: profileSettings.url(),
        },
        {
            id: 'security',
            label: t('Security'),
            icon: ShieldCheck,
            url: securitySettings.url(),
        },
        {
            id: 'notifications',
            label: t('Notification settings'),
            icon: Bell,
            url: notificationSettings.url(),
        },
    ];
    const settingsKeyword = t('Settings');

    return [
        ...entries.flatMap(({ key, label, icon }) => {
            const href = links[key];
            const second = GotoSequences[key];

            if (href === undefined) {
                return [];
            }

            return [
                {
                    id: `goto-${key}`,
                    group: 'goto',
                    label,
                    icon,
                    shortcut: second === undefined ? undefined : ['G', second],
                    onSelect: () => visit(href),
                } satisfies CommandPaletteItem,
                ...(under[key]?.pages ?? []).map(
                    (page) =>
                        ({
                            id: `goto-${key}-${page.id}`,
                            group: 'goto',
                            label: page.label,
                            icon: page.icon,
                            meta: under[key]?.of,
                            keywords: [under[key]?.of ?? ''],
                            onSelect: () => router.visit(page.href),
                        }) satisfies CommandPaletteItem,
                ),
            ];
        }),
        ...teams.map(
            (team) =>
                ({
                    id: `goto-team-${team.id}`,
                    group: 'goto',
                    label: team.label,
                    icon: team.icon,
                    meta: teamWord,
                    keywords: [teamWord],
                    onSelect: () => router.visit(team.href),
                }) satisfies CommandPaletteItem,
        ),
        ...account.map(
            ({ id, label, icon, url }) =>
                ({
                    id: `goto-${id}`,
                    group: 'goto',
                    label,
                    icon,
                    keywords: [settingsKeyword],
                    onSelect: () => router.visit(url),
                }) satisfies CommandPaletteItem,
        ),
    ];
}

/** `G` then the key of a page of the sidebar opens it, where the viewer has that page. */
function useGotoSequence(key: NavKey, links: Links): void {
    const href = links[key];
    const second = GotoSequences[key] ?? '';

    useShortcutSequence(
        ['g', second.toLowerCase()],
        () => href !== undefined && visit(href),
        { enabled: href !== undefined && second !== '' },
    );
}

/**
 * The search field of the topbar and the palette it opens: actions, recent
 * sessions, content results of the current workspace, and the pages of the
 * sidebar. `G` then the key shown beside a page works outside the palette too.
 * A page with its own search drops the wide button (`wideTrigger`), keeping
 * the phone's icon button, and may take mod+K for its field
 * (`toggleShortcut`).
 */
export function CommandMenu({
    links,
    wideTrigger = true,
    toggleShortcut = true,
}: {
    links: Links;
    wideTrigger?: boolean;
    toggleShortcut?: boolean;
}) {
    const { t } = useTrans();
    const { currentWorkspace, currentTeam, teams, locale } = usePage().props;
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const search = useGlobalSearch(isOpen ? query : '');
    const recent = useRecentSessions(isOpen);
    const platform = useIsMounted() ? detectPlatform() : 'mac';

    useEffect(() => {
        const open = () => setIsOpen(true);

        window.addEventListener(openCommandMenuEvent, open);

        return () => window.removeEventListener(openCommandMenuEvent, open);
    }, []);

    useGotoSequence('dashboard', links);
    useGotoSequence('sessions', links);
    useGotoSequence('actions', links);
    useGotoSequence('insights', links);
    useGotoSequence('members', links);
    useGotoSequence('templates', links);
    useGotoSequence('admin', links);

    const canInvite = currentWorkspace?.canManageMembers === true;
    const context: CommandMenuContext = {
        teamUrl:
            currentWorkspace &&
            currentTeam &&
            currentTeam.viewerRole !== 'observer'
                ? TeamsController.show.url({
                      workspace: currentWorkspace.slug,
                      team: currentTeam.id,
                  })
                : undefined,
        invite:
            currentWorkspace && canInvite
                ? {
                      workspace: currentWorkspace.name,
                      url: WorkspaceMembersController.index.url(
                          currentWorkspace.slug,
                      ),
                  }
                : undefined,
        theme: {
            resolved: resolvedAppearance,
            onToggle: () =>
                updateAppearance(
                    resolvedAppearance === 'dark' ? 'light' : 'dark',
                ),
        },
    };
    const scope =
        currentWorkspace && currentTeam
            ? { workspace: currentWorkspace.slug, team: currentTeam.id }
            : null;
    const extras: GotoExtras = {
        /** "Settings" leads to the first page the viewer may open, "Insights" to its first tab: the others follow. */
        settingsPages:
            scope === null
                ? []
                : teamSettingsPages(scope, t)
                      .filter(
                          (page) =>
                              currentTeam?.settingsSections?.[page.section],
                      )
                      .slice(1)
                      .map((page) => ({ ...page, id: page.section })),
        insightsPages:
            scope === null
                ? []
                : insightsPages(scope, t)
                      .slice(1)
                      .map((page) => ({
                          ...page,
                          id: page.key,
                          icon: TrendingUp,
                      })),
        teams: currentWorkspace
            ? teams
                  .filter((team) => team.id !== currentTeam?.id)
                  .map((team) => ({
                      id: team.id,
                      label: team.name,
                      icon: Users,
                      href: TeamsController.show.url({
                          workspace: currentWorkspace.slug,
                          team: team.id,
                      }),
                  }))
            : [],
    };
    const modKey = platform === 'mac' ? '⌘K' : 'Ctrl K';

    return (
        <>
            {wideTrigger && (
                <Button
                    type="button"
                    variant="outline"
                    className="hidden w-65 max-w-full justify-start gap-2 px-3 font-normal text-muted-foreground md:inline-flex"
                    onClick={() => setIsOpen(true)}
                    aria-keyshortcuts="Meta+K Control+K"
                    data-test="command-menu-button"
                >
                    <Search aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-left">
                        {t('Search…')}
                    </span>
                    <Kbd aria-hidden="true">{modKey}</Kbd>
                </Button>
            )}
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setIsOpen(true)}
                aria-label={t('Search')}
                data-test="command-menu-button-compact"
            >
                <Search aria-hidden="true" />
            </Button>
            <CommandPalette
                open={isOpen}
                onOpenChange={setIsOpen}
                onSearchChange={setQuery}
                items={[
                    ...actionItems(context, t),
                    ...recentItems(recent.sessions, t, locale),
                    ...resultItems(search.results, search.term),
                    ...gotoItems(links, t, extras),
                ]}
                loading={search.loading}
                toggleShortcut={toggleShortcut}
                emptyText={
                    search.failed
                        ? t('Search is unavailable. Try again in a moment.')
                        : undefined
                }
            />
        </>
    );
}
