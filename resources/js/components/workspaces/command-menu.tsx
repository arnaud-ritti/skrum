import { router, usePage } from '@inertiajs/react';
import {
    Bell,
    Building2,
    CalendarClock,
    Keyboard,
    Layers,
    LayoutDashboard,
    LayoutTemplate,
    ListChecks,
    PartyPopper,
    PenTool,
    Plus,
    Search,
    Settings,
    ShieldCheck,
    Spade,
    Sparkles,
    StickyNote,
    TrendingUp,
    UserPlus,
    UserRound,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import WorkspaceMembersController from '@/actions/App/Http/Controllers/WorkspaceMembersController';
import type { AppSidebarProps, NavKey } from '@/components/skrum/app-sidebar';
import { detectPlatform } from '@/components/skrum/keyboard-shortcuts';
import { Button } from '@/components/ui/button';
import { CommandPalette } from '@/components/ui/command';
import type { CommandPaletteItem } from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { useGlobalSearch } from '@/hooks/use-global-search';
import type { SearchResult, SearchResultKind } from '@/hooks/use-global-search';
import { useRecentSessions } from '@/hooks/use-recent-sessions';
import type { RecentSession } from '@/hooks/use-recent-sessions';
import { useShortcutSequence } from '@/hooks/use-shortcut-sequence';
import {
    openCommandMenuEvent,
    openKeyboardShortcutsEvent,
} from '@/lib/shortcuts/events';
import { useTrans } from '@/hooks/use-trans';
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
};

export function actionItems(
    { teamUrl, invite }: CommandMenuContext,
    t: Translate,
): CommandPaletteItem[] {
    const items: CommandPaletteItem[] = [];

    if (teamUrl !== undefined) {
        items.push(
            {
                id: 'new-retro',
                group: 'actions',
                label: t('New retrospective'),
                icon: Plus,
                onSelect: () => router.visit(`${teamUrl}?new=retro`),
            },
            {
                id: 'new-poker',
                group: 'actions',
                label: t('New poker session'),
                icon: Spade,
                onSelect: () => router.visit(`${teamUrl}?new=poker`),
            },
        );
    }

    if (invite !== undefined) {
        items.push({
            id: 'invite',
            group: 'actions',
            label: t('Invite to :workspace', { workspace: invite.workspace }),
            icon: UserPlus,
            onSelect: () => router.visit(invite.url),
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

/** One item per link of the sidebar, then the three settings pages of the account. */
export function gotoItems(links: Links, t: Translate): CommandPaletteItem[] {
    const entries: {
        key: NavKey;
        label: string;
        icon: LucideIcon;
        shortcut?: string[];
    }[] = [
        { key: 'dashboard', label: t('Dashboard'), icon: LayoutDashboard },
        { key: 'sessions', label: t('Sessions'), icon: CalendarClock },
        {
            key: 'actions',
            label: t('Action items'),
            icon: ListChecks,
            shortcut: ['G', 'A'],
        },
        { key: 'mood', label: t('Mood & ROTI'), icon: TrendingUp },
        { key: 'games', label: t('Games'), icon: PartyPopper },
        { key: 'members', label: t('Members'), icon: Users },
        { key: 'templates', label: t('Templates'), icon: LayoutTemplate },
        { key: 'teams', label: t('All teams'), icon: Building2 },
        { key: 'settings', label: t('Team settings'), icon: Settings },
        {
            key: 'admin',
            label: t('Administration'),
            icon: ShieldCheck,
            shortcut: ['G', 'S'],
        },
    ];
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
        ...entries.flatMap(({ key, label, icon, shortcut }) => {
            const href = links[key];

            if (href === undefined) {
                return [];
            }

            return [
                {
                    id: `goto-${key}`,
                    group: 'goto',
                    label,
                    icon,
                    shortcut,
                    onSelect: () => visit(href),
                } satisfies CommandPaletteItem,
            ];
        }),
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

function subscribeToNothing(): () => void {
    return () => {};
}

/**
 * The search field of the topbar and the palette it opens: actions, recent
 * sessions, content results of the current workspace, and the pages of the
 * sidebar. `G` then `A` and `G` then `S` work outside the palette too.
 */
export function CommandMenu({ links }: { links: Links }) {
    const { t } = useTrans();
    const { currentWorkspace, currentTeam, locale } = usePage().props;
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const search = useGlobalSearch(isOpen ? query : '');
    const recent = useRecentSessions(isOpen);
    const platform = useSyncExternalStore(
        subscribeToNothing,
        detectPlatform,
        () => 'mac' as const,
    );

    useEffect(() => {
        const open = () => setIsOpen(true);

        window.addEventListener(openCommandMenuEvent, open);

        return () => window.removeEventListener(openCommandMenuEvent, open);
    }, []);

    useShortcutSequence(
        ['g', 'a'],
        () => links.actions !== undefined && visit(links.actions),
        { enabled: links.actions !== undefined },
    );
    useShortcutSequence(
        ['g', 's'],
        () => links.admin !== undefined && visit(links.admin),
        { enabled: links.admin !== undefined },
    );

    const canInvite =
        currentWorkspace?.role === 'owner' ||
        currentWorkspace?.role === 'admin';
    const context: CommandMenuContext = {
        teamUrl:
            currentWorkspace && currentTeam
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
    };
    const modKey = platform === 'mac' ? '⌘K' : 'Ctrl K';

    return (
        <>
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
                    ...gotoItems(links, t),
                ]}
                loading={search.loading}
                emptyText={
                    search.failed
                        ? t('Search is unavailable. Try again in a moment.')
                        : undefined
                }
            />
        </>
    );
}
