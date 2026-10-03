import { Link, router, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ListSkeleton } from '@/components/skrum/skeletons';
import { EmptyState } from '@/components/skrum/empty-state';
import { SessionRow } from '@/components/skrum/session-row';
import { roomLimitReason } from '@/components/teams/session-create/icebreaker-session-fields';
import { useNewSessionIntent } from '@/components/teams/session-create/use-new-session-intent';
import { TeamNewSessionDialog } from '@/components/teams/team-new-session-dialog';
import { Button } from '@/components/ui/button';
import { LoadMore, LoadMoreFeed } from '@/components/ui/pagination';
import { useTrans } from '@/hooks/use-trans';
import { SessionTabs, sessionMeta, sessionsHref } from '@/lib/teams/sessions';
import type { SessionTab, TeamSession } from '@/lib/teams/sessions';
import { cn } from '@/lib/utils';
import type { NewSessionOptions, TeamSummary, WorkspaceSummary } from '@/types';

export type SessionsPageProps = NewSessionOptions & {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    tab: SessionTab;
    sessions: TeamSession[];
    total: number;
    nextCursor: string | null;
};

type Translate = ReturnType<typeof useTrans>['t'];

/** The tabs whose rows end their meta line with the last activity date (P22-01). */
const DatedTabs: readonly SessionTab[] = ['upcoming', 'finished'];

function sessionKey(session: TeamSession): string {
    return `${session.kind}:${session.id}`;
}

function tabLabel(tab: SessionTab, t: Translate): string {
    switch (tab) {
        case 'upcoming':
            return t('Upcoming sessions');
        case 'live':
            return t('Live sessions');
        case 'finished':
            return t('Finished sessions');
    }
}

function emptyText(
    tab: SessionTab,
    t: Translate,
): { title: string; description: string } {
    switch (tab) {
        case 'upcoming':
            return {
                title: t('No upcoming session'),
                description: t(
                    'A session you create waits here until it starts.',
                ),
            };
        case 'live':
            return {
                title: t('No live session right now'),
                description: t('The sessions in progress show up here.'),
            };
        case 'finished':
            return {
                title: t('No finished session yet'),
                description: t(
                    'The sessions that ended show up here, newest first.',
                ),
            };
    }
}

/** Whether the "New session" dialog has a form the viewer may use. */
function offersNewSession(options: NewSessionOptions, t: Translate): boolean {
    return (
        options.canCreateRetro ||
        options.canCreatePokerGame ||
        options.canCreateWhiteboard ||
        options.canCreateSurvey ||
        roomLimitReason(options.canCreateGameRoom, options.roomLimit, t) ===
            undefined
    );
}

type Feed = {
    /** The `sessions` prop the rows were last built from. */
    source: TeamSession[];
    rows: TeamSession[];
    loadingMore: boolean;
    /** The first row a "Load more" added: it takes the focus. */
    focusKey: string | null;
};

function appendPage(rows: TeamSession[], page: TeamSession[]): TeamSession[] {
    const known = new Set(rows.map(sessionKey));

    return [...rows, ...page.filter((row) => !known.has(sessionKey(row)))];
}

/**
 * The rows shown: the first page, then each page "Load more" brings. A new
 * `sessions` prop is appended when it answers "Load more", and replaces the
 * rows otherwise (a fresh visit of the page).
 */
function useSessionFeed(
    sessions: TeamSession[],
    tab: SessionTab,
    nextCursor: string | null,
) {
    const [feed, setFeed] = useState<Feed>({
        source: sessions,
        rows: sessions,
        loadingMore: false,
        focusKey: null,
    });

    if (feed.source !== sessions) {
        const rows = feed.loadingMore
            ? appendPage(feed.rows, sessions)
            : sessions;
        const added = rows[feed.rows.length];

        setFeed({
            source: sessions,
            rows,
            loadingMore: false,
            focusKey:
                feed.loadingMore && added !== undefined
                    ? sessionKey(added)
                    : null,
        });
    }

    const loadMore = (): void => {
        if (nextCursor === null) {
            return;
        }

        setFeed((current) => ({ ...current, loadingMore: true }));
        router.reload({
            only: ['sessions', 'nextCursor'],
            data: { tab, before: nextCursor },
            preserveUrl: true,
            onFinish: () =>
                setFeed((current) =>
                    current.loadingMore
                        ? { ...current, loadingMore: false }
                        : current,
                ),
        });
    };

    return { ...feed, loadMore };
}

/** A visit to another tab of this page: the list gives way to its skeleton. */
function useTabVisit(): boolean {
    const [visiting, setVisiting] = useState(false);

    useEffect(() => {
        const offStart = router.on('start', (event) => {
            const visit = event.detail.visit;

            if (
                visit.only.length === 0 &&
                visit.url.pathname === window.location.pathname
            ) {
                setVisiting(true);
            }
        });
        const offFinish = router.on('finish', () => setVisiting(false));

        return () => {
            offStart();
            offFinish();
        };
    }, []);

    return visiting;
}

function SessionList({
    tab,
    feed,
    total,
    nextCursor,
    locale,
}: {
    tab: SessionTab;
    feed: ReturnType<typeof useSessionFeed>;
    total: number;
    nextCursor: string | null;
    locale: string;
}) {
    const { t } = useTrans();
    const list = useRef<HTMLDivElement>(null);
    const dated = DatedTabs.includes(tab);
    const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

    useEffect(() => {
        if (feed.focusKey === null) {
            return;
        }

        Array.from(
            list.current?.querySelectorAll<HTMLElement>('[data-session-key]') ??
                [],
        )
            .find((row) => row.dataset.sessionKey === feed.focusKey)
            ?.querySelector<HTMLElement>('a')
            ?.focus();
    }, [feed.focusKey]);

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <LoadMoreFeed
                ref={list}
                loading={feed.loadingMore}
                aria-label={t('Sessions')}
                className="flex min-w-0 flex-col gap-2"
            >
                {feed.rows.map((row, index) => {
                    const meta = sessionMeta(row, t);

                    return (
                        <article
                            key={sessionKey(row)}
                            data-session-key={sessionKey(row)}
                            aria-posinset={index + 1}
                            aria-setsize={total}
                            className="min-w-0"
                        >
                            <SessionRow
                                href={row.url}
                                kind={row.kind}
                                title={row.title}
                                badge={row.isDraft ? t('Draft') : undefined}
                                meta={
                                    dated
                                        ? `${meta} · ${date.format(new Date(row.updatedAt))}`
                                        : meta
                                }
                            />
                        </article>
                    );
                })}
            </LoadMoreFeed>
            <LoadMore
                remaining={nextCursor === null ? 0 : total - feed.rows.length}
                loading={feed.loadingMore}
                onLoadMore={feed.loadMore}
                total={total}
                endLabel={t("You're all caught up · :count sessions", {
                    count: total,
                })}
            />
        </div>
    );
}

export function SessionsPage({
    workspace,
    team,
    tab,
    sessions,
    total,
    nextCursor,
    ...options
}: SessionsPageProps) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const intent = useNewSessionIntent();
    const visiting = useTabVisit();
    const feed = useSessionFeed(sessions, tab, nextCursor);
    const newSessionButton = useRef<HTMLButtonElement>(null);
    const canCreate = offersNewSession(options, t);
    const empty = emptyText(tab, t);

    return (
        <div data-slot="sessions-page" className="flex min-w-0 flex-col gap-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h1 className="font-display text-2xl font-bold tracking-heading wrap-anywhere">
                        {t('Sessions')}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t(
                            'Retros, poker, whiteboards, polls and icebreakers of :team',
                            { team: team.name },
                        )}
                    </p>
                </div>
                <TeamNewSessionDialog
                    workspace={workspace}
                    team={team}
                    options={options}
                    intent={intent}
                    trigger={
                        <Button
                            ref={newSessionButton}
                            aria-label={t('New session')}
                        >
                            <Plus aria-hidden />
                            <span className="truncate max-[22.5rem]:sr-only">
                                {t('New session')}
                            </span>
                        </Button>
                    }
                />
            </header>

            <nav
                aria-label={t('Session tabs')}
                className="flex max-w-full min-w-0 self-start overflow-x-auto"
            >
                <div className="inline-flex h-9 shrink-0 items-center rounded-lg bg-muted p-0.75">
                    {SessionTabs.map((item) => (
                        <Link
                            key={item}
                            href={sessionsHref(workspace.slug, team.id, item)}
                            preserveScroll={false}
                            aria-current={item === tab ? 'page' : undefined}
                            className={cn(
                                'inline-flex h-7.5 items-center justify-center rounded-md px-3 text-body-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors duration-140 ease-out outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                                'aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-card',
                            )}
                        >
                            {tabLabel(item, t)}
                        </Link>
                    ))}
                </div>
            </nav>

            {visiting ? (
                <ListSkeleton rows={5} withBadge={false} />
            ) : feed.rows.length === 0 ? (
                <EmptyState
                    module="sessions"
                    title={empty.title}
                    description={empty.description}
                    action={
                        canCreate
                            ? {
                                  label: t('New session'),
                                  icon: Plus,
                                  onClick: () =>
                                      newSessionButton.current?.click(),
                              }
                            : undefined
                    }
                />
            ) : (
                <SessionList
                    tab={tab}
                    feed={feed}
                    total={total}
                    nextCursor={nextCursor}
                    locale={locale}
                />
            )}
        </div>
    );
}
