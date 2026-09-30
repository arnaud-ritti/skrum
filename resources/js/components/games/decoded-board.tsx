import { useSecretWord } from '@/hooks/use-secret-word';
import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { ClueEditor } from './clue-editor';
import { ClueRow } from './clue-row';
import { GuessChat } from './guess-chat';
import { HintButton } from './hint-button';
import { LeaderWord } from './leader-word';
import { useRoom } from './room-context';
import { WordMask } from './word-mask';

export function DecodedBoard({ round }: { round: GameRound }) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const isLeader = round.leaderPlayerId === snapshot.me.playerId;
    const word = useSecretWord(round);
    const leader =
        snapshot.players.find((player) => player.id === round.leaderPlayerId) ??
        null;

    return (
        <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-[1fr_18rem]">
            <div className="flex min-w-0 flex-col items-center gap-6 py-4">
                {isLeader ? (
                    <>
                        <LeaderWord
                            word={word}
                            label={t('Your word to describe')}
                        />
                        <ClueEditor round={round} />
                        <HintButton round={round} />
                    </>
                ) : (
                    <>
                        {leader && (
                            <p className="text-sm text-muted-foreground">
                                {t(':name is giving clues', {
                                    name: leader.name,
                                })}
                            </p>
                        )}
                        <ClueRow clue={round.clue ?? []} />
                    </>
                )}
                <WordMask mask={round.mask ?? []} />
            </div>
            <GuessChat round={round} isLeader={isLeader} />
        </div>
    );
}
