import { Brush, Image, Smile, SpellCheck, type LucideIcon } from 'lucide-react';
import { ClueRow } from '@/components/games/clue-row';
import { GifTile } from '@/components/games/gif-tile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { outcomeLabel } from '@/lib/games/outcomes';
import type { GameKind } from '@/lib/games/types';
import type { GamesPlayedPerson, GamesPlayedRound } from '@/lib/retro/types';

const GameIcons: Record<GameKind, LucideIcon> = {
    draw: Brush,
    gif: Image,
    hangman: SpellCheck,
    decoded: Smile,
};

type Props = {
    round: GamesPlayedRound;
    names: Map<string, string>;
    onReplay: (roundId: string) => void;
};

function Person({
    person,
    label,
}: {
    person: GamesPlayedPerson;
    label: string;
}) {
    return (
        <span className="inline-flex items-center gap-1" title={label}>
            <img
                src={person.avatarUrl}
                alt=""
                className="size-5 rounded-full bg-muted"
            />
            <span className="sr-only">{label}</span>
            <span aria-hidden>{person.name}</span>
        </span>
    );
}

export function GamesPlayedRound({ round, names, onReplay }: Props) {
    const { t } = useTrans();
    const Icon = GameIcons[round.game];

    return (
        <li className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
                <Icon className="size-4 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">
                    {round.word ?? round.question ?? '—'}
                </span>
                <Badge variant="secondary">
                    {outcomeLabel(round.outcome, t)}
                </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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
                        {t('Replay')}
                    </Button>
                )}
            </div>
            {round.clue && round.clue.length > 0 && (
                <ClueRow clue={round.clue} />
            )}
            {round.answers && round.answers.length > 0 && (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {round.answers.map((answer) => (
                        <li key={answer.gif.id}>
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
