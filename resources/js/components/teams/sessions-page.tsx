import { Link, router, usePage } from '@inertiajs/react';
import {
    Copy,
    Ellipsis,
    History,
    LayoutTemplate,
    Library,
    Plus,
    Trash2,
    Trophy,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import PokerDecksController from '@/actions/App/Http/Controllers/PokerDecksController';
import TeamEstimatesController from '@/actions/App/Http/Controllers/TeamEstimatesController';
import TeamGameRoomsController from '@/actions/App/Http/Controllers/TeamGameRoomsController';
import TeamSurveyDuplicatesController from '@/actions/App/Http/Controllers/TeamSurveys/TeamSurveyDuplicatesController';
import TeamSurveysController from '@/actions/App/Http/Controllers/TeamSurveys/TeamSurveysController';
import WhiteboardsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardsController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { ListSkeleton } from '@/components/skrum/skeletons';
import { EmptyState } from '@/components/skrum/empty-state';
import { LoadingButton } from '@/components/skrum/loading-button';
import { SessionRow } from '@/components/skrum/session-row';
import type { SessionType } from '@/components/skrum/session-type-picker';
import { roomLimitReason } from '@/components/teams/session-create/icebreaker-session-fields';
import { useNewSessionIntent } from '@/components/teams/session-create/use-new-session-intent';
import { TeamNewSessionDialog } from '@/components/teams/team-new-session-dialog';
import { WhiteboardTemplatesDialog } from '@/components/teams/whiteboard-templates-dialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadMore, LoadMoreFeed } from '@/components/ui/pagination';
import { useLastDefined } from '@/hooks/use-last-defined';
import { useOptionalProp } from '@/hooks/use-optional-prop';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import {
    SessionKinds,
    groupSessions,
    sessionKindLabel,
    sessionMeta,
    sessionOutcome,
    sessionStatus,
    sessionsHref,
} from '@/lib/teams/sessions';
import type { TeamSession } from '@/lib/teams/sessions';
import { cn } from '@/lib/utils';
import type {
    NewSessionOptions,
    TeamSummary,
    WhiteboardTemplateSummary,
    WorkspaceSummary,
} from '@/types';

export type SessionsPageProps = NewSessionOptions & {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    /** The chip in use; null on "All". */
    kind: SessionType | null;
    /** The page search: the sessions whose title holds it. */
    q: string | null;
    /** Every live session under the chip and the search; not paged. */
    live: TeamSession[];
    /** The sessions that are not live, newest first, page after page. */
    sessions: TeamSession[];
    counts: Record<'all' | SessionType, number>;
    /** How many sessions are not live under the chip and the search. */
    total: number;
    nextCursor: string | null;
    hasSprints: boolean;
    /** Loaded on demand: the templates dialog asks for it. */
    whiteboardTemplates?: WhiteboardTemplateSummary[];
};

type Translate = ReturnType<typeof useTrans>['t'];

const KindLinksClass = 'flex min-w-0 flex-wrap items-center gap-1';

const GroupHeadingClass = 'text-overline text-muted-foreground uppercase';

function sessionKey(session: TeamSession): string {
    return `${session.kind}:${session.id}`;
}

function emptyTitle(kind: SessionType | null, t: Translate): string {
    switch (kind) {
        case null:
            return t('No session yet');
        case 'retro':
            return t('No retro yet');
        case 'poker':
            return t('No planning poker yet');
        case 'whiteboard':
            return t('No whiteboard yet');
        case 'survey':
            return t('No poll yet');
        case 'icebreaker':
            return t('No icebreaker yet');
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
    /** The `sessions` prop the feed last saw. */
    source: TeamSession[];
    loadingMore: boolean;
    /** The first row a "Load more" added: it takes the focus. */
    focusKey: string | null;
};

/**
 * The state of "Load more". The server merges each page it brings into the
 * `sessions` prop, so the page in the history keeps every loaded row.
 */
function useSessionFeed(
    sessions: TeamSession[],
    kind: SessionType | null,
    nextCursor: string | null,
    q: string | null,
) {
    const [feed, setFeed] = useState<Feed>({
        source: sessions,
        loadingMore: false,
        focusKey: null,
    });

    if (feed.source !== sessions) {
        const added = feed.loadingMore
            ? sessions[feed.source.length]
            : undefined;

        setFeed({
            source: sessions,
            loadingMore: false,
            focusKey: added === undefined ? null : sessionKey(added),
        });
    }

    const loadMore = (): void => {
        if (nextCursor === null) {
            return;
        }

        setFeed((current) => ({ ...current, loadingMore: true }));
        router.reload({
            only: ['live', 'sessions', 'total', 'nextCursor'],
            data: {
                ...(kind === null ? {} : { kind }),
                before: nextCursor,
                ...(q === null ? {} : { q }),
            },
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

/** A visit to another chip of this page: the list gives way to its skeleton. */
function useKindVisit(): boolean {
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

/**
 * The deletion a row menu asks for: a board or a survey, each with the
 * request and the texts of its own page.
 */
function useSessionDeletion(live: TeamSession[], sessions: TeamSession[]) {
    const { t } = useTrans();
    const [target, setTarget] = useState<TeamSession | null>(null);
    const [open, setOpen] = useState(false);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const deletedKey = useRef<string | null>(null);

    // The menu that opened the dialog leaves with its row: the focus goes to
    // the heading of the page once the reloaded lists no longer hold it.
    useEffect(() => {
        if (deletedKey.current === null) {
            return;
        }

        if (
            [...live, ...sessions].some(
                (row) => sessionKey(row) === deletedKey.current,
            )
        ) {
            return;
        }

        deletedKey.current = null;
        headingRef.current?.focus();
    }, [live, sessions]);

    const leave = (row: TeamSession): void => {
        deletedKey.current = sessionKey(row);
        router.reload({
            only: ['live', 'sessions', 'counts', 'total', 'nextCursor'],
            reset: ['sessions'],
        });
    };

    const destroy = async (): Promise<void> => {
        if (target === null) {
            return;
        }

        try {
            await retroRequest(
                target.kind === 'whiteboard'
                    ? WhiteboardsController.destroy(target.id)
                    : TeamSurveysController.destroy(target.id),
            );
        } catch (error) {
            toast.error(
                error instanceof RetroRequestError && error.status > 0
                    ? error.message
                    : t('Something went wrong. Please try again.'),
            );

            if (error instanceof RetroRequestError && error.status === 404) {
                leave(target);

                return;
            }

            throw error;
        }

        leave(target);
    };

    const ask = (row: TeamSession): void => {
        setTarget(row);
        setOpen(true);
    };

    return { target, open, setOpen, ask, destroy, headingRef };
}

function SessionMenu({
    row,
    onDelete,
}: {
    row: TeamSession;
    onDelete: (row: TeamSession) => void;
}) {
    const { t } = useTrans();
    const afterClose = useRef<(() => void) | null>(null);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('More actions')}
                >
                    <Ellipsis aria-hidden />
                </Button>
            </DropdownMenuTrigger>
            {/*
              A dialog gives the keyboard back to what had it at its opening:
              opened from an entry, that is the entry, gone with the menu. It
              opens once the menu has handed the keyboard back to its button.
            */}
            <DropdownMenuContent
                align="end"
                onCloseAutoFocus={() => {
                    const openDialog = afterClose.current;

                    afterClose.current = null;
                    openDialog?.();
                }}
            >
                {row.canDuplicate && (
                    <DropdownMenuItem
                        onSelect={() =>
                            router.post(
                                TeamSurveyDuplicatesController.store(row.id)
                                    .url,
                                {},
                                { preserveScroll: true },
                            )
                        }
                    >
                        <Copy aria-hidden />
                        <span className="truncate">{t('Duplicate')}</span>
                    </DropdownMenuItem>
                )}
                {row.canDuplicate && row.canDelete && <DropdownMenuSeparator />}
                {row.canDelete && (
                    <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                            afterClose.current = () => onDelete(row);
                        }}
                    >
                        <Trash2 aria-hidden />
                        <span className="truncate">{t('Delete')}</span>
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function SessionListRow({
    row,
    onDelete,
}: {
    row: TeamSession;
    onDelete: (row: TeamSession) => void;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const status = sessionStatus(row, t);
    const isLive = row.state === 'live';
    const isPending = row.isDraft || row.state === 'upcoming';

    return (
        <SessionRow
            href={row.url}
            kind={row.kind}
            title={row.title}
            meta={sessionMeta(row, t)}
            outcome={sessionOutcome(row, t, locale) ?? undefined}
            date={
                isLive
                    ? t('Now')
                    : new Intl.DateTimeFormat(locale, {
                          dateStyle: 'medium',
                      }).format(new Date(row.updatedAt))
            }
            badge={isPending ? status : undefined}
            status={isPending ? undefined : status}
            action={
                isLive ? (
                    <Button asChild size="sm">
                        <Link href={row.url}>{t('Join')}</Link>
                    </Button>
                ) : undefined
            }
            menu={
                row.canDelete || row.canDuplicate ? (
                    <SessionMenu row={row} onDelete={onDelete} />
                ) : undefined
            }
        />
    );
}

/** The pages a kind has beside its sessions, under the chips of that kind only. */
function KindLinks({
    workspace,
    team,
    kind,
    templates,
}: {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    kind: SessionType | null;
    templates: WhiteboardTemplateSummary[] | undefined;
}) {
    const { t } = useTrans();
    const [managing, setManaging] = useState(false);
    const templatesButton = useRef<HTMLButtonElement>(null);
    const templatesLoad = useOptionalProp(
        'whiteboardTemplates',
        managing && templates === undefined,
    );
    // The redirect that follows a change of a template brings the page
    // without the list: the dialog keeps the last one while it is asked
    // again, so a refused change stays on screen with its error.
    const listed = useLastDefined(templates);
    const params = { workspace: workspace.slug, team: team.id };

    if (kind === 'poker') {
        return (
            <div data-slot="session-kind-links" className={KindLinksClass}>
                <Button variant="ghost" size="sm" asChild>
                    <Link href={TeamEstimatesController.index(params)}>
                        <History aria-hidden />
                        <span className="truncate">
                            {t('Estimation history')}
                        </span>
                    </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                    <Link href={PokerDecksController.index(params)}>
                        <Library aria-hidden />
                        <span className="truncate">{t('Saved decks')}</span>
                    </Link>
                </Button>
            </div>
        );
    }

    if (kind === 'icebreaker') {
        return (
            <div data-slot="session-kind-links" className={KindLinksClass}>
                <Button variant="ghost" size="sm" asChild>
                    <Link href={TeamGameRoomsController.index(params)}>
                        <Trophy aria-hidden />
                        <span className="truncate">{t('Leaderboard')}</span>
                    </Link>
                </Button>
            </div>
        );
    }

    if (kind !== 'whiteboard') {
        return null;
    }

    return (
        <div data-slot="session-kind-links" className={KindLinksClass}>
            <LoadingButton
                ref={templatesButton}
                variant="ghost"
                size="sm"
                loading={
                    managing && listed === undefined && !templatesLoad.failed
                }
                onClick={() => {
                    templatesLoad.retry();
                    setManaging(true);
                }}
            >
                <LayoutTemplate aria-hidden />
                <span className="truncate">{t('Whiteboard templates')}</span>
            </LoadingButton>
            {templatesLoad.failed && (
                <p role="alert" className="text-sm text-skrum-destructive-text">
                    {t('Something went wrong. Please try again.')}
                </p>
            )}
            <WhiteboardTemplatesDialog
                open={managing && listed !== undefined}
                onOpenChange={setManaging}
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    templatesButton.current?.focus();
                }}
                workspaceSlug={workspace.slug}
                templates={listed ?? []}
            />
        </div>
    );
}

function SessionList({
    rows,
    feed,
    total,
    nextCursor,
    hasSprints,
    liveCount,
    onDelete,
}: {
    rows: TeamSession[];
    feed: ReturnType<typeof useSessionFeed>;
    total: number;
    nextCursor: string | null;
    hasSprints: boolean;
    liveCount: number;
    onDelete: (row: TeamSession) => void;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const list = useRef<HTMLDivElement>(null);
    const groupId = useId();
    const positions = new Map(
        rows.map((row, index) => [sessionKey(row), index + 1]),
    );
    const shown = total + liveCount;

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
            {rows.length > 0 && (
                <LoadMoreFeed
                    ref={list}
                    loading={feed.loadingMore}
                    aria-label={t('Sessions')}
                    className="flex min-w-0 flex-col gap-6"
                >
                    {groupSessions(rows, hasSprints, locale, t).map((group) => (
                        <section
                            key={group.key}
                            aria-labelledby={`${groupId}-${group.key}`}
                            className="flex min-w-0 flex-col gap-2"
                        >
                            <h2
                                id={`${groupId}-${group.key}`}
                                className={GroupHeadingClass}
                            >
                                {group.label}
                            </h2>
                            {group.rows.map((row) => (
                                <article
                                    key={sessionKey(row)}
                                    data-session-key={sessionKey(row)}
                                    aria-posinset={positions.get(
                                        sessionKey(row),
                                    )}
                                    aria-setsize={total}
                                    className="min-w-0"
                                >
                                    <SessionListRow
                                        row={row}
                                        onDelete={onDelete}
                                    />
                                </article>
                            ))}
                        </section>
                    ))}
                </LoadMoreFeed>
            )}
            <LoadMore
                remaining={nextCursor === null ? 0 : total - rows.length}
                loading={feed.loadingMore}
                onLoadMore={feed.loadMore}
                total={shown}
                endLabel={
                    shown === 1
                        ? t("You're all caught up · 1 session")
                        : t("You're all caught up · :count sessions", {
                              count: shown,
                          })
                }
            />
        </div>
    );
}

export function SessionsPage({
    workspace,
    team,
    kind,
    q,
    live,
    sessions,
    counts,
    total,
    nextCursor,
    hasSprints,
    whiteboardTemplates,
    ...options
}: SessionsPageProps) {
    const { t } = useTrans();
    const intent = useNewSessionIntent();
    const visiting = useKindVisit();
    const feed = useSessionFeed(sessions, kind, nextCursor, q);
    const deletion = useSessionDeletion(live, sessions);
    const newSessionButton = useRef<HTMLButtonElement>(null);
    const liveHeadingId = useId();
    const canCreate = offersNewSession(options, t);
    const liveKeys = new Set(live.map(sessionKey));
    const rows = sessions.filter((row) => !liveKeys.has(sessionKey(row)));
    const isEmpty = live.length === 0 && rows.length === 0;
    const deletesBoard = deletion.target?.kind === 'whiteboard';

    return (
        <div data-slot="sessions-page" className="flex min-w-0 flex-col gap-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h1
                        ref={deletion.headingRef}
                        tabIndex={-1}
                        className="rounded-sm font-display text-2xl font-bold tracking-heading wrap-anywhere outline-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
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

            <div className="flex min-w-0 flex-col gap-2">
                <nav
                    aria-label={t('Kinds')}
                    className="flex max-w-full min-w-0 self-start overflow-x-auto"
                >
                    <div className="inline-flex h-9 shrink-0 items-center rounded-lg bg-muted p-0.75">
                        {[null, ...SessionKinds].map((item) => (
                            <Link
                                key={item ?? 'all'}
                                href={sessionsHref(workspace.slug, team.id, {
                                    kind: item,
                                    q,
                                })}
                                preserveScroll={false}
                                aria-current={
                                    item === kind ? 'page' : undefined
                                }
                                className={cn(
                                    'inline-flex h-7.5 items-center justify-center gap-1.5 rounded-md px-3 text-body-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors duration-140 ease-out outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                                    'aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-card',
                                )}
                            >
                                {item === null
                                    ? t('All')
                                    : sessionKindLabel(item, t)}
                                <span className="font-normal tabular-nums">
                                    {counts[item ?? 'all']}
                                </span>
                            </Link>
                        ))}
                    </div>
                </nav>
                <KindLinks
                    workspace={workspace}
                    team={team}
                    kind={kind}
                    templates={whiteboardTemplates}
                />
            </div>

            {visiting ? (
                <ListSkeleton rows={5} withBadge={false} />
            ) : isEmpty && q !== null ? (
                <EmptyState
                    module="sessions"
                    title={t('No session matches “:term”.', { term: q })}
                    description={t('Look for another word of the title.')}
                    action={{
                        label: t('Clear the search'),
                        variant: 'outline',
                        href: sessionsHref(workspace.slug, team.id, { kind }),
                    }}
                />
            ) : isEmpty ? (
                <EmptyState
                    module={
                        kind === null || counts.all === 0 ? 'sessions' : kind
                    }
                    title={emptyTitle(counts.all === 0 ? null : kind, t)}
                    description={t(
                        'The sessions of the team show up here, newest first.',
                    )}
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
                <>
                    {live.length > 0 && (
                        <section
                            aria-labelledby={liveHeadingId}
                            className="flex min-w-0 flex-col gap-2"
                        >
                            <h2
                                id={liveHeadingId}
                                className={GroupHeadingClass}
                            >
                                {t('Live now')}
                            </h2>
                            {live.map((row) => (
                                <SessionListRow
                                    key={sessionKey(row)}
                                    row={row}
                                    onDelete={deletion.ask}
                                />
                            ))}
                        </section>
                    )}
                    <SessionList
                        rows={rows}
                        feed={feed}
                        total={total}
                        nextCursor={nextCursor}
                        hasSprints={hasSprints}
                        liveCount={live.length}
                        onDelete={deletion.ask}
                    />
                </>
            )}

            <ConfirmDialog
                open={deletion.open}
                onOpenChange={deletion.setOpen}
                tone="destructive"
                title={
                    deletesBoard
                        ? t('Delete this board?')
                        : t('Delete this survey?')
                }
                description={
                    deletesBoard
                        ? t('Everything on it is removed for everyone.')
                        : t('Its questions and answers are deleted too.')
                }
                confirmLabel={
                    deletesBoard ? t('Delete this board') : t('Delete')
                }
                onConfirm={deletion.destroy}
            />
        </div>
    );
}
