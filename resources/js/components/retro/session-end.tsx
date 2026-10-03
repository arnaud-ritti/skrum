import { Link, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    ChevronDown,
    Ellipsis,
    Layers,
    ListChecks,
    Mail,
    Share2,
    StickyNote,
    ThumbsUp,
    Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import { toast } from 'sonner';
import { DeliveryLines } from '@/components/integrations/share/delivery-lines';
import { StatCard } from '@/components/skrum/stat-card';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHeightInRem } from '@/hooks/use-height-in-rem';
import { useIsMobile } from '@/hooks/use-mobile';
import { useIsMounted } from '@/hooks/use-is-mounted';
import { useTrans } from '@/hooks/use-trans';
import { ShareChannels, shareResultsLabel } from '@/lib/integrations';
import {
    formatSessionDuration,
    sessionEndStats,
} from '@/lib/retro/session-end';
import type { Snapshot } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import type { ShareChannel } from '@/types';
import { useBoard } from './board-context';
import { BoardReactions, showsRetroReactions } from './board-reactions';
import { ActionsCreated } from './results/action-items';
import { GamesPlayed } from './results/games-played';
import { HealthResult } from './results/health';
import { Participants } from './results/participants';
import { RecapEmailDialog } from './results/recap-email';
import { RecapShareDialog } from './results/recap-share';
import { RotiResult } from './results/roti';
import { Summary } from './results/summary';
import { TopTopics } from './results/top-topics';
import { prefersReducedMotion, SessionConfetti } from './session-confetti';
import { SurveyResultList } from './surveys/survey-result-list';

export type CompletedView = 'results' | 'board';

function CompletedTabId(view: CompletedView): string {
    return `completed-tab-${view}`;
}

type Recap = { kind: 'share'; channel: ShareChannel } | { kind: 'email' };

function recapChannels(board: Pick<Snapshot, 'integrations'>): ShareChannel[] {
    return ShareChannels.filter((channel) => board.integrations[channel]);
}

/**
 * Whether the session end has something to do: on a phone its actions are a
 * bar stuck to the bottom of the screen.
 */
export function hasSessionEndActions(
    board: Pick<Snapshot, 'integrations' | 'links'>,
): boolean {
    return (
        board.integrations.email ||
        board.links.team !== null ||
        recapChannels(board).length > 0
    );
}

/** "Session ended · 58 min · Thu, Oct 2": the duration only when the retro has a start time. */
function useEndedLine(): { text: string; completedAt: string | null } {
    const { board } = useBoard();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const isMounted = useIsMounted();
    const { completedAt } = board.retro;
    const seconds = board.results?.stats.durationSeconds ?? null;
    const date =
        isMounted && completedAt
            ? new Date(completedAt).toLocaleDateString(locale, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
              })
            : null;

    return {
        completedAt,
        text: [
            t('Session ended'),
            seconds === null ? null : formatSessionDuration(seconds, locale),
            date,
        ]
            .filter((part) => part !== null)
            .join(' · '),
    };
}

function RecapActions({
    onRecap,
    footerRef,
}: {
    onRecap: (recap: Recap) => void;
    /** The sticky foot of the phone, which the reaction bar must clear. */
    footerRef?: Ref<HTMLDivElement>;
}) {
    const { board, sessionExpired } = useBoard();
    const { t } = useTrans();
    const isMobile = useIsMobile();
    const backHref = board.links.team;
    const channels = recapChannels(board);
    const hasEmail = board.integrations.email;

    if (!hasSessionEndActions(board)) {
        return null;
    }

    const email = hasEmail && (
        <Button
            disabled={sessionExpired}
            className={isMobile ? 'min-w-0 flex-1' : 'min-w-0'}
            onClick={() => onRecap({ kind: 'email' })}
        >
            <Mail aria-hidden />
            <span className="truncate">{t('Send the recap by e-mail')}</span>
        </Button>
    );
    const shareItems = channels.map((channel) => (
        <DropdownMenuItem
            key={channel}
            onSelect={() => onRecap({ kind: 'share', channel })}
        >
            <span className="truncate">{shareResultsLabel(channel, t)}</span>
        </DropdownMenuItem>
    ));

    if (isMobile && hasEmail) {
        return (
            <div
                ref={footerRef}
                data-slot="retro-session-end-actions"
                className="sticky bottom-0 z-20 mt-auto flex min-w-0 items-center gap-2 border-t bg-background px-4 py-3"
            >
                {email}
                {(backHref !== null || channels.length > 0) && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                aria-label={t('More actions')}
                                disabled={sessionExpired}
                            >
                                <Ellipsis aria-hidden />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {backHref !== null && (
                                <DropdownMenuItem asChild>
                                    <Link href={backHref}>
                                        <ArrowLeft aria-hidden />
                                        <span className="truncate">
                                            {t('Back to the team')}
                                        </span>
                                    </Link>
                                </DropdownMenuItem>
                            )}
                            {shareItems}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        );
    }

    return (
        <div
            ref={isMobile ? footerRef : undefined}
            data-slot="retro-session-end-actions"
            className={
                isMobile
                    ? 'sticky bottom-0 z-20 mt-auto flex min-w-0 items-center gap-2 border-t bg-background px-4 py-3'
                    : 'flex min-w-0 shrink-0 flex-wrap items-center gap-2'
            }
        >
            {backHref !== null && (
                <Button variant="ghost" asChild className="min-w-0">
                    <Link href={backHref}>
                        <ArrowLeft aria-hidden />
                        <span className="truncate">
                            {t('Back to the team')}
                        </span>
                    </Link>
                </Button>
            )}
            {channels.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            disabled={sessionExpired}
                            className="min-w-0"
                        >
                            <Share2 aria-hidden />
                            <span className="truncate">{t('Share')}</span>
                            <ChevronDown aria-hidden />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {shareItems}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            {email}
        </div>
    );
}

function Stats() {
    const { board } = useBoard();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const stats = sessionEndStats(board);

    if (stats === null) {
        return null;
    }

    const participation = t(':count of :total', {
        count: stats.participants,
        total: stats.expected,
    });

    return (
        <div
            data-slot="retro-session-end-stats"
            className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3"
        >
            <StatCard
                layout="inline"
                emphasis
                icon={ListChecks}
                label={t('Actions created')}
                value={String(stats.actions)}
            />
            <StatCard
                layout="inline"
                icon={Users}
                label={t('Participation')}
                value={
                    stats.participationRatio === null
                        ? participation
                        : `${participation} · ${new Intl.NumberFormat(locale, {
                              style: 'percent',
                          }).format(stats.participationRatio)}`
                }
            />
            <StatCard
                layout="inline"
                icon={StickyNote}
                label={t('Cards')}
                value={String(stats.cards)}
            />
            <StatCard
                layout="inline"
                icon={Layers}
                label={t('Groups')}
                value={String(stats.groups)}
            />
            <StatCard
                layout="inline"
                icon={ThumbsUp}
                label={t('Votes cast')}
                value={t(':count of :total', {
                    count: stats.votesCast,
                    total: stats.votesAvailable,
                })}
            />
        </div>
    );
}

function Results() {
    const { board } = useBoard();
    const { results } = board;

    if (results === null) {
        return null;
    }

    return (
        <div className="flex min-w-0 flex-col gap-4 px-4 pb-8 md:px-8">
            <Stats />
            <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
                <div className="min-w-0 lg:col-start-1 lg:row-start-1">
                    <ActionsCreated />
                </div>
                <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
                    <RotiResult roti={results.roti} />
                    {results.health && (
                        <HealthResult
                            health={results.health}
                            trend={results.healthTrend}
                        />
                    )}
                    <Participants participants={results.participants} />
                </div>
                <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-2">
                    <Summary />
                    <TopTopics />
                    <SurveyResultList surveys={results.surveys} />
                    {results.games && <GamesPlayed games={results.games} />}
                </div>
            </div>
        </div>
    );
}

type Props = {
    view: CompletedView;
    onViewChange: (view: CompletedView) => void;
    /**
     * True when the viewer saw the session end live: the confetti plays, or
     * a toast says it for who prefers reduced motion. False on a later visit.
     */
    celebrates?: boolean;
    /** The read-only board of the "Board" tab. */
    children: ReactNode;
};

/**
 * Session end: what the retro was and what it leaves behind. The header and
 * the two tabs stay; "Results" holds the figures and the cards, "Board" the
 * columns as they were.
 */
export function SessionEnd({
    view,
    onViewChange,
    celebrates = false,
    children,
}: Props) {
    const { board, presence } = useBoard();
    const { t } = useTrans();
    const isMobile = useIsMobile();
    const [recap, setRecap] = useState<Recap | null>(null);
    const ended = useEndedLine();
    const announced = useRef(false);
    const participants = board.results?.participants.length ?? 0;
    const actions = board.actionItems.length;

    useEffect(() => {
        if (!celebrates || announced.current || !prefersReducedMotion()) {
            return;
        }

        announced.current = true;
        toast(
            actions === 1
                ? t('Session ended — 1 action created')
                : t('Session ended — :count actions created', {
                      count: actions,
                  }),
        );
    }, [celebrates, actions, t]);

    const [footerRef, footerHeight] = useHeightInRem();
    const hasReactions = Boolean(presence) && showsRetroReactions(board.retro);
    const recapActions = (
        <RecapActions onRecap={setRecap} footerRef={footerRef} />
    );

    return (
        <div
            data-slot="retro-session-end"
            data-reactions={hasReactions || undefined}
            className="relative mx-auto flex w-full max-w-screen-2xl min-w-0 flex-1 flex-col"
        >
            {celebrates && (
                <SessionConfetti
                    colors={board.columns.map((column) => column.color)}
                />
            )}
            <Tabs<CompletedView>
                value={view}
                onValueChange={onViewChange}
                className={cn(
                    'relative z-10 flex-1 gap-4 pt-5',
                    // Room for the docked reaction bar under the last card.
                    hasReactions && 'pb-16',
                )}
            >
                <div className="flex min-w-0 flex-col gap-4 px-4 md:px-8">
                    <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:gap-6">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <p
                                data-slot="retro-session-end-line"
                                className="text-overline text-muted-foreground uppercase"
                            >
                                {ended.completedAt ? (
                                    <time dateTime={ended.completedAt}>
                                        {ended.text}
                                    </time>
                                ) : (
                                    ended.text
                                )}
                            </p>
                            <h2 className="font-display text-display-lg wrap-anywhere">
                                {t(':title, wrapped up', {
                                    title: board.retro.title,
                                })}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {participants === 1
                                    ? t(':count participant', {
                                          count: participants,
                                      })
                                    : t(':count participants', {
                                          count: participants,
                                      })}
                                .{' '}
                                <span className="font-display font-semibold text-skrum-primary-text">
                                    {t('Meetings end, actions stay.')}
                                </span>
                            </p>
                            {board.results && (
                                <DeliveryLines
                                    deliveries={board.results.deliveries}
                                />
                            )}
                        </div>
                        {!isMobile && recapActions}
                    </div>
                    <TabsList aria-label={t('Retrospective views')}>
                        <TabsTrigger
                            id={CompletedTabId('results')}
                            value="results"
                        >
                            {t('Results')}
                        </TabsTrigger>
                        <TabsTrigger id={CompletedTabId('board')} value="board">
                            {t('Board')}
                        </TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent
                    value="results"
                    aria-labelledby={CompletedTabId('results')}
                    className="flex min-w-0 flex-col"
                >
                    <Results />
                </TabsContent>
                <TabsContent
                    value="board"
                    aria-labelledby={CompletedTabId('board')}
                    className="flex min-w-0 flex-col pb-8 lg:flex-row"
                >
                    {children}
                </TabsContent>
            </Tabs>
            {isMobile && recapActions}
            <BoardReactions
                compact={isMobile}
                offsetBottom={
                    isMobile && footerHeight > 0 ? footerHeight : undefined
                }
            />
            <RecapShareDialog
                channel={recap?.kind === 'share' ? recap.channel : null}
                onClose={() => setRecap(null)}
            />
            <RecapEmailDialog
                open={recap?.kind === 'email'}
                onOpenChange={(open) => {
                    if (!open) {
                        setRecap(null);
                    }
                }}
            />
        </div>
    );
}
