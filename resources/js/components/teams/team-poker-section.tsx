import { Link, usePage } from '@inertiajs/react';
import { History, Library, Spade } from 'lucide-react';
import { useState } from 'react';
import PokerGamesController from '@/actions/App/Http/Controllers/Poker/PokerGamesController';
import PokerDecksController from '@/actions/App/Http/Controllers/PokerDecksController';
import TeamEstimatesController from '@/actions/App/Http/Controllers/TeamEstimatesController';
import { EmptyState } from '@/components/skrum/empty-state';
import { SectionActionsMenu } from '@/components/teams/section-actions-menu';
import { TeamSection } from '@/components/teams/team-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useTrans } from '@/hooks/use-trans';
import { formatRelativeTime } from '@/lib/action-items/format';
import { formatPoints } from '@/lib/poker/format';
import type { PokerGameSummary } from '@/types';

type Props = {
    workspaceSlug: string;
    teamId: string;
    games: PokerGameSummary[];
    /**
     * Players online per open game. `undefined` while the deferred prop is on
     * its way, `null` when the presence server did not answer.
     */
    presence?: Record<string, number | null> | null;
};

export function TeamPokerSection({
    workspaceSlug,
    teamId,
    games,
    presence,
}: Props) {
    const { t } = useTrans();
    const params = { workspace: workspaceSlug, team: teamId };
    const active = games.filter((game) => game.endedAt === null);
    const ended = games.filter((game) => game.endedAt !== null);

    return (
        <TeamSection
            icon={Spade}
            title={t('Planning poker')}
            actions={
                <>
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={TeamEstimatesController.index(params)}>
                            <History aria-hidden />
                            <span className="truncate">
                                {t('Estimation history')}
                            </span>
                        </Link>
                    </Button>
                    <SectionActionsMenu
                        label={t('Planning poker actions')}
                        items={[
                            {
                                label: t('Saved decks'),
                                icon: Library,
                                href: PokerDecksController.index(params),
                            },
                        ]}
                    />
                </>
            }
        >
            {games.length === 0 && (
                <Card className="border-dashed shadow-none">
                    <EmptyState
                        module="poker"
                        headingLevel="h3"
                        illustration={false}
                        title={t('No games yet.')}
                        description={t(
                            'Estimate a backlog together: pick Planning poker in New session.',
                        )}
                        className="py-6"
                    />
                </Card>
            )}
            {games.length > 0 && (
                <Card data-slot="team-poker-games" className="overflow-hidden">
                    {active.length > 0 && (
                        <GamesTable
                            title={t('Active games')}
                            games={active}
                            presence={presence}
                        />
                    )}
                    {ended.length > 0 && (
                        <GamesTable
                            title={t('Ended games')}
                            games={ended}
                            presence={null}
                            className={
                                active.length > 0 ? 'border-t' : undefined
                            }
                        />
                    )}
                </Card>
            )}
        </TeamSection>
    );
}

function GamesTable({
    title,
    games,
    presence,
    className,
}: {
    title: string;
    games: PokerGameSummary[];
    presence: Props['presence'];
    className?: string;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [now] = useState(() => Date.now());

    return (
        <div className={className}>
            <p className="px-4 pt-3 text-overline text-muted-foreground uppercase">
                {title} · {games.length}
            </p>
            <Table className="max-sm:block">
                <TableHeader className="max-sm:hidden">
                    <TableRow>
                        <TableHead className="px-4">{t('Game')}</TableHead>
                        <TableHead className="px-4">{t('Deck')}</TableHead>
                        <TableHead className="px-4">{t('Points')}</TableHead>
                        <TableHead className="px-4">
                            {t('Last activity')}
                        </TableHead>
                        <TableHead className="px-4">
                            <span className="sr-only">{t('Action')}</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody className="max-sm:block">
                    {games.map((game) => {
                        const online = presence?.[game.id] ?? 0;
                        const href = PokerGamesController.show(game.id);

                        return (
                            <TableRow
                                key={game.id}
                                data-slot="team-poker-game"
                                className="max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-center max-sm:gap-x-3"
                            >
                                <TableCell className="w-full px-4 max-sm:block">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span
                                            aria-hidden
                                            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-skrum-col-iris text-skrum-col-iris-text"
                                        >
                                            <Spade className="size-3.5" />
                                        </span>
                                        <div className="flex min-w-0 flex-col">
                                            <Link
                                                href={href}
                                                className="truncate rounded-sm font-semibold outline-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                                            >
                                                {game.title}
                                            </Link>
                                            <div className="flex flex-wrap gap-x-1 text-xs text-muted-foreground tabular-nums">
                                                <span>
                                                    {t(
                                                        ':tasks tasks · :estimated estimated',
                                                        {
                                                            tasks: game.tasksCount,
                                                            estimated:
                                                                game.estimatedCount,
                                                        },
                                                    )}
                                                    {game.totalPoints !==
                                                        null &&
                                                        ` · ${t(
                                                            ':points points',
                                                            {
                                                                points: formatPoints(
                                                                    game.totalPoints,
                                                                    locale,
                                                                ),
                                                            },
                                                        )}`}
                                                </span>
                                                {presence === undefined && (
                                                    <Skeleton
                                                        data-slot="poker-presence-loading"
                                                        className="h-4 w-16"
                                                    />
                                                )}
                                                {online > 0 && (
                                                    <span
                                                        data-slot="poker-presence"
                                                        className="font-semibold text-skrum-success-text"
                                                    >
                                                        ·{' '}
                                                        {t(
                                                            ':count in the room',
                                                            { count: online },
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 whitespace-nowrap max-sm:hidden">
                                    <Badge variant="outline">
                                        {game.deckLabel}
                                    </Badge>
                                </TableCell>
                                <TableCell className="px-4 font-semibold whitespace-nowrap tabular-nums max-sm:hidden">
                                    {game.totalPoints === null
                                        ? '—'
                                        : t(':points pts', {
                                              points: formatPoints(
                                                  game.totalPoints,
                                                  locale,
                                              ),
                                          })}
                                </TableCell>
                                <TableCell className="px-4 whitespace-nowrap text-muted-foreground max-sm:hidden">
                                    {formatRelativeTime(
                                        game.lastActivityAt,
                                        locale,
                                        now,
                                    )}
                                </TableCell>
                                <TableCell className="px-4 text-right whitespace-nowrap max-sm:block max-sm:pl-0">
                                    <Button
                                        size="sm"
                                        variant={
                                            online > 0 ? 'default' : 'outline'
                                        }
                                        asChild
                                    >
                                        <Link href={href}>
                                            {online > 0
                                                ? t('Join')
                                                : t('Open the game')}
                                            <span className="sr-only">
                                                {' '}
                                                ({game.title})
                                            </span>
                                        </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
