import { Brush, Film, Smile, WholeWord } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import GameRoundsController from '@/actions/App/Http/Controllers/Games/GameRoundsController';
import { ClueRow } from '@/components/games/clue-row';
import { DrawingCanvas } from '@/components/games/drawing-canvas';
import { GifTile } from '@/components/games/gif-tile';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { outcomeLabel } from '@/lib/games/outcomes';
import type { GameKind, GameRoundDetail } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import type {
    GamesPlayed as GamesPlayedPayload,
    GamesPlayedLeaderRow,
    GamesPlayedPerson,
    GamesPlayedRound,
} from '@/lib/retro/types';
import { useBoard } from '../board-context';
import { ResultsCard } from './results-card';

const PodiumSize = 3;

const GameIcons: Record<GameKind, LucideIcon> = {
    hangman: WholeWord,
    decoded: Smile,
    draw: Brush,
    gif: Film,
};

function Podium({ leaderboard }: { leaderboard: GamesPlayedLeaderRow[] }) {
    const { t } = useTrans();
    const [showAll, setShowAll] = useState(false);
    const shown = showAll ? leaderboard : leaderboard.slice(0, PodiumSize);

    if (leaderboard.length === 0) {
        return null;
    }

    return (
        <div className="flex min-w-0 flex-col items-start gap-2">
            <ol className="grid w-full min-w-0 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-2">
                {shown.map((row, index) => (
                    <li
                        key={row.playerId}
                        className="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                        <b className="w-5 shrink-0 text-right font-semibold text-muted-foreground tabular-nums">
                            {index + 1}
                        </b>
                        <PersonAvatar
                            name={row.name}
                            src={row.avatarUrl}
                            kind={row.isGuest ? 'guest' : 'member'}
                            size="sm"
                            decorative
                        />
                        <span className="min-w-0 flex-1 truncate">
                            {row.name}
                            {row.isGuest && (
                                <span className="text-muted-foreground">
                                    {' '}
                                    {t('(guest)')}
                                </span>
                            )}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                            {t(':count points', { count: row.points })}
                        </span>
                    </li>
                ))}
            </ol>
            {leaderboard.length > PodiumSize && (
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAll((current) => !current)}
                >
                    <span className="truncate">
                        {showAll ? t('Show less') : t('Show all')}
                    </span>
                </Button>
            )}
        </div>
    );
}

function Person({
    person,
    label,
}: {
    person: GamesPlayedPerson;
    label: string;
}) {
    return (
        <span
            className="inline-flex min-w-0 items-center gap-1.5"
            title={label}
        >
            <PersonAvatar
                name={person.name}
                src={person.avatarUrl}
                kind={person.isGuest ? 'guest' : 'member'}
                size="xs"
                decorative
            />
            <span className="sr-only">{label}</span>
            <span aria-hidden className="min-w-0 truncate">
                {person.name}
            </span>
        </span>
    );
}

function Round({
    round,
    names,
    onReplay,
}: {
    round: GamesPlayedRound;
    names: Map<string, string>;
    onReplay: (roundId: string) => void;
}) {
    const { t } = useTrans();
    const Icon = GameIcons[round.game];

    return (
        <li className="flex min-w-0 flex-col gap-3 rounded-lg border p-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Icon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                    {round.word ?? round.question ?? '—'}
                </span>
                <Badge variant="secondary">
                    {outcomeLabel(round.outcome, t)}
                </Badge>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {round.leader && (
                    <Person
                        person={round.leader}
                        label={t('Led by :name', { name: round.leader.name })}
                    />
                )}
                {round.winner && (
                    <Person
                        person={round.winner}
                        label={t(':name found it!', {
                            name: round.winner.name,
                        })}
                    />
                )}
                {round.game === 'draw' && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReplay(round.id)}
                    >
                        <span className="truncate">{t('Replay')}</span>
                    </Button>
                )}
            </div>
            {round.clue && round.clue.length > 0 && (
                <ClueRow clue={round.clue} />
            )}
            {round.answers && round.answers.length > 0 && (
                <ul className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2">
                    {round.answers.map((answer) => (
                        <li key={answer.gif.id} className="min-w-0">
                            <GifTile
                                gif={answer.gif}
                                caption={
                                    answer.playerId === null
                                        ? t('Anonymous GIF')
                                        : t('by :name', {
                                              name:
                                                  names.get(answer.playerId) ??
                                                  t('Someone'),
                                          })
                                }
                            >
                                {typeof answer.votes === 'number' && (
                                    <p className="text-center text-xs text-muted-foreground">
                                        {t('Votes: :count', {
                                            count: answer.votes,
                                        })}
                                    </p>
                                )}
                            </GifTile>
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}

/**
 * Drawings are not part of the results: the round endpoint resolves the
 * viewer as a player of the icebreaker room.
 */
function RoundReplayDialog({
    roomId,
    roundId,
    onClose,
}: {
    roomId: string;
    roundId: string | null;
    onClose: () => void;
}) {
    const { handleError } = useBoard();
    const { t } = useTrans();
    const [detail, setDetail] = useState<GameRoundDetail | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (roundId === null) {
            return;
        }

        let isCurrent = true;

        setDetail(null);
        setError(null);

        retroRequest<GameRoundDetail>(
            GameRoundsController.show({ room: roomId, round: roundId }),
        )
            .then((fresh) => {
                if (isCurrent) {
                    setDetail(fresh);
                }
            })
            .catch((failure: unknown) => {
                if (isCurrent) {
                    setError(handleError(failure));
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [roomId, roundId, handleError]);

    return (
        <Dialog
            open={roundId !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent
                aria-describedby={undefined}
                closeLabel={t('Close')}
                className="sm:max-w-2xl"
            >
                <DialogHeader className="pr-8">
                    <DialogTitle>{t('Replay')}</DialogTitle>
                </DialogHeader>
                {error !== null ? (
                    <p
                        role="alert"
                        className="text-sm text-skrum-destructive-text"
                    >
                        {error}
                    </p>
                ) : detail === null ? (
                    <Spinner aria-label={t('Loading')} />
                ) : (
                    <div className="flex min-w-0 flex-col gap-2">
                        <DrawingCanvas
                            ops={detail.drawing ?? []}
                            label={t('Drawing of :word', {
                                word: detail.word ?? '',
                            })}
                        />
                        {detail.word && (
                            <p className="text-center text-xl font-semibold">
                                {detail.word}
                            </p>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** The icebreaker of the retro: who scored, and each round with its outcome. */
export function GamesPlayed({ games }: { games: GamesPlayedPayload }) {
    const { t } = useTrans();
    const [replayed, setReplayed] = useState<string | null>(null);
    const names = new Map(
        games.leaderboard.map((row) => [row.playerId, row.name]),
    );

    for (const round of games.rounds) {
        for (const person of [round.leader, round.winner]) {
            if (person) {
                names.set(person.playerId, person.name);
            }
        }
    }

    return (
        <ResultsCard title={t('Games we played')}>
            <p className="text-sm text-muted-foreground">
                {t(':count rounds played', { count: games.roundsPlayed })}
            </p>
            <Podium leaderboard={games.leaderboard} />
            <ol className="min-w-0 space-y-2">
                {games.rounds.map((round) => (
                    <Round
                        key={round.id}
                        round={round}
                        names={names}
                        onReplay={setReplayed}
                    />
                ))}
            </ol>
            <RoundReplayDialog
                roomId={games.roomId}
                roundId={replayed}
                onClose={() => setReplayed(null)}
            />
        </ResultsCard>
    );
}
