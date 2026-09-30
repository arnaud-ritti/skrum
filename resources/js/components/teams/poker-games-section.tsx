import { Link, usePage } from '@inertiajs/react';
import PokerGamesController from '@/actions/App/Http/Controllers/Poker/PokerGamesController';
import TeamEstimatesController from '@/actions/App/Http/Controllers/TeamEstimatesController';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { formatPoints } from '@/lib/poker/format';
import type {
    PokerDeckOption,
    PokerGameSummary,
    SavedPokerDeck,
} from '@/types';
import { NewPokerGameDialog } from './new-poker-game-dialog';
import { SavedDecksDialog } from './saved-decks-dialog';

type Props = {
    workspaceSlug: string;
    teamId: string;
    games: PokerGameSummary[];
    deckOptions: PokerDeckOption[];
    savedDecks: SavedPokerDeck[];
    canCreate: boolean;
};

export function PokerGamesSection({
    workspaceSlug,
    teamId,
    games,
    deckOptions,
    savedDecks,
    canCreate,
}: Props) {
    const { t } = useTrans();
    const active = games.filter((game) => game.endedAt === null);
    const ended = games.filter((game) => game.endedAt !== null);

    return (
        <section className="space-y-3">
            <Heading variant="small" title={t('Planning poker')} />

            <div className="flex flex-wrap items-center gap-2">
                {canCreate && (
                    <NewPokerGameDialog
                        workspaceSlug={workspaceSlug}
                        teamId={teamId}
                        deckOptions={deckOptions}
                        savedDecks={savedDecks}
                    />
                )}
                <Button variant="outline" asChild>
                    <Link
                        href={TeamEstimatesController.index({
                            workspace: workspaceSlug,
                            team: teamId,
                        })}
                    >
                        {t('Estimation history')}
                    </Link>
                </Button>
                <SavedDecksDialog
                    workspaceSlug={workspaceSlug}
                    teamId={teamId}
                    decks={savedDecks}
                />
            </div>

            {games.length === 0 && (
                <p className="text-muted-foreground">{t('No games yet.')}</p>
            )}

            {active.length > 0 && (
                <GameList title={t('Active games')} games={active} />
            )}
            {ended.length > 0 && (
                <GameList title={t('Ended games')} games={ended} />
            )}
        </section>
    );
}

function GameList({
    title,
    games,
}: {
    title: string;
    games: PokerGameSummary[];
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const formatDate = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

    return (
        <div className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">
                {title}
            </h3>
            <ul className="divide-y rounded-md border">
                {games.map((game) => (
                    <li key={game.id}>
                        <Link
                            href={PokerGamesController.show(game.id)}
                            className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-muted"
                        >
                            <span>
                                <span className="block font-medium">
                                    {game.title}
                                </span>
                                <span className="block text-sm text-muted-foreground">
                                    {game.deckLabel}
                                    {' · '}
                                    {t(':tasks tasks · :estimated estimated', {
                                        tasks: game.tasksCount,
                                        estimated: game.estimatedCount,
                                    })}
                                    {game.totalPoints !== null &&
                                        ` · ${t(':points points', {
                                            points: formatPoints(
                                                game.totalPoints,
                                                locale,
                                            ),
                                        })}`}
                                </span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {t('Last activity :date', {
                                    date: formatDate.format(
                                        new Date(game.lastActivityAt),
                                    ),
                                })}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
