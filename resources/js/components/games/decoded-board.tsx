import { WholeWord } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { useSecretWord } from '@/hooks/use-secret-word';
import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { ClueEditor } from './clue-editor';
import { ClueRow } from './clue-row';
import { useHasRightColumn } from './game-layout';
import { GuessChat } from './guess-chat';
import { AutoHintCountdown } from './auto-hint-countdown';
import { HintButton } from './hint-button';
import { LeaderWord, MaskedWord } from './leader-word';
import { useRoom } from './room-context';

/** The sky card of the clue: its tiles follow the width of the card. */
function CluePuzzle({ children }: { children: ReactNode }) {
    return (
        <div
            data-slot="clue-puzzle"
            className="col-sky @container flex w-full max-w-2xl flex-col items-center gap-3 rounded-2xl border border-(--col-border) bg-[color-mix(in_oklch,var(--col)_65%,var(--card))] px-3 pt-6 pb-5 shadow-raised sm:px-6"
        >
            {children}
        </div>
    );
}

export function DecodedBoard({ round }: { round: GameRound }) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const isLeader = round.leaderPlayerId === snapshot.me.playerId;
    const word = useSecretWord(round);
    const hasRightColumn = useHasRightColumn();
    const mask = round.mask ?? [];
    const letters = mask.filter(
        (character) => character === null || /\p{L}/u.test(character),
    ).length;

    return (
        <div
            data-slot="decoded-board"
            className="flex w-full flex-col items-center gap-5"
        >
            {isLeader && (
                <LeaderWord
                    word={word}
                    label={t('Your word to describe')}
                    action={<HintButton round={round} />}
                />
            )}
            <CluePuzzle>
                {isLeader ? (
                    <ClueEditor round={round} />
                ) : (
                    <ClueRow clue={round.clue ?? []} size="lg" />
                )}
                <Badge variant="outline" shape="pill">
                    <WholeWord aria-hidden />
                    {letters === 1
                        ? t(':count letter', { count: 1 })
                        : t(':count letters', { count: letters })}
                </Badge>
            </CluePuzzle>
            <MaskedWord
                mask={mask}
                maxHints={round.maxHints ?? 0}
                footnote={<AutoHintCountdown round={round} />}
            />
            {!hasRightColumn && (
                <GuessChat
                    fieldFirst
                    round={round}
                    isLeader={isLeader}
                    className="max-h-72 w-full max-w-2xl shrink-0"
                />
            )}
        </div>
    );
}
