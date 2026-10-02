import { Check, Crown } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useTrans } from '@/hooks/use-trans';
import { pendingAnswers } from '@/lib/games/gif';
import type { GameRound } from '@/lib/games/types';
import { useHasRightColumn } from './game-layout';
import { GifSteps, useGifStep } from './gif-steps';
import { GuessChat } from './guess-chat';
import { HangmanFeed } from './hangman-feed';
import { PlayerRow } from './player-row';
import { useRoom } from './room-context';
import { RoomScores } from './room-scores';

type SidebarTab = 'players' | 'scores';

/** Who has done the step in play of a Sprint in one GIF round; null for another game. */
function gifDoneIds(
    round: GameRound | null,
    myPlayerId: string,
): Set<string> | null {
    if (round?.game !== 'gif') {
        return null;
    }

    if (round.revealedAt !== null) {
        return new Set(round.voters ?? []);
    }

    const answered = pendingAnswers(round).map((answer) => answer.playerId);

    return new Set(round.myAnswer ? [...answered, myPlayerId] : answered);
}

function GifPlayerStatus({ done, voting }: { done: boolean; voting: boolean }) {
    const { t } = useTrans();

    if (!done) {
        return voting ? t('voting…') : t('picking…');
    }

    return (
        <span className="inline-flex items-center gap-1 text-skrum-success-text">
            <Check aria-hidden className="size-3.5 shrink-0" />
            {voting ? t('voted') : t('GIF picked')}
        </span>
    );
}

function PlayersList({
    highlightPlayerId,
}: {
    highlightPlayerId: string | null;
}) {
    const { snapshot, online } = useRoom();
    const { t } = useTrans();
    const onlineIds = new Set(online.map((member) => member.id));
    const { round } = snapshot;
    const gifDone = gifDoneIds(round, snapshot.me.playerId);
    const isPicking = gifDone !== null && round?.revealedAt === null;
    const players = [...snapshot.players].sort(
        (first, second) =>
            Number(onlineIds.has(second.presenceId)) -
            Number(onlineIds.has(first.presenceId)),
    );

    return (
        <section
            aria-labelledby="game-players"
            className="flex min-w-0 flex-col gap-2"
        >
            <div className="flex items-baseline justify-between gap-2">
                <h2 id="game-players" className="sr-only">
                    {t('Players')}
                </h2>
                <span className="text-xs text-muted-foreground">
                    {t(':count players', { count: players.length })}
                </span>
            </div>
            {gifDone !== null && isPicking && (
                <Progress
                    data-slot="gif-ready"
                    label={t('Ready')}
                    value={gifDone.size}
                    max={Math.max(players.length, 1)}
                    valueLabel={`${gifDone.size} / ${players.length}`}
                />
            )}
            <ul className="flex flex-col gap-0.5">
                {players.map((player) => (
                    <PlayerRow
                        key={player.id}
                        name={player.name}
                        avatarUrl={player.avatarUrl}
                        isGuest={player.isGuest}
                        isMe={player.id === snapshot.me.playerId}
                        offline={!onlineIds.has(player.presenceId)}
                        detail={
                            gifDone === null ? undefined : (
                                <GifPlayerStatus
                                    done={gifDone.has(player.id)}
                                    voting={!isPicking}
                                />
                            )
                        }
                        trailing={
                            <>
                                {player.id === snapshot.room.hostPlayerId && (
                                    <Crown
                                        className="size-4 shrink-0 text-skrum-warning-text"
                                        aria-label={t('Host')}
                                    />
                                )}
                                {player.id === highlightPlayerId && (
                                    <Check
                                        className="size-4 shrink-0 text-skrum-success-text"
                                        aria-label={t('Winner')}
                                    />
                                )}
                            </>
                        }
                    />
                ))}
            </ul>
        </section>
    );
}

export type RoomSidebarProps = {
    /** The winner of the round that just ended. */
    highlightPlayerId: string | null;
    /** Place left under the players for the turn order of a game (GM-2). */
    turnOrder?: ReactNode;
    /** Place left for the podium of a Sprint in one GIF round (GM-3). */
    gifPodium?: ReactNode;
};

/** The side of a game: who plays, the scores, then what the game in play adds. */
export function RoomSidebar({
    highlightPlayerId,
    turnOrder,
    gifPodium,
}: RoomSidebarProps) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const [tab, setTab] = useState<SidebarTab>('players');
    const { round } = snapshot;
    const hasRightColumn = useHasRightColumn();
    const gifStep = useGifStep();
    const hasGuesses = round?.game === 'draw' || round?.game === 'decoded';

    return (
        <>
            <Tabs<SidebarTab>
                value={tab}
                onValueChange={setTab}
                fullWidth
                aria-label={t('Players and scores')}
                items={[
                    { value: 'players', label: t('Players') },
                    { value: 'scores', label: t('Scores') },
                ]}
            >
                <TabsContent value="players">
                    <PlayersList highlightPlayerId={highlightPlayerId} />
                </TabsContent>
                <TabsContent value="scores">
                    <RoomScores />
                </TabsContent>
            </Tabs>
            {turnOrder}
            {gifPodium}
            {gifStep !== null && (
                <div className="border-t pt-5">
                    <GifSteps step={gifStep} />
                </div>
            )}
            {round?.game === 'hangman' && <HangmanFeed round={round} />}
            {round && hasGuesses && hasRightColumn && (
                <GuessChat
                    round={round}
                    isLeader={round.leaderPlayerId === snapshot.me.playerId}
                    className="min-h-64 flex-1 border-t pt-5"
                />
            )}
        </>
    );
}
