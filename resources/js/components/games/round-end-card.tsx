import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { outcomeLabel } from '@/lib/games/outcomes';
import { useRoom } from './room-context';
import { StartRoundControls } from './start-round-controls';

export function RoundEndCard() {
    const { snapshot, lastEnded } = useRoom();
    const { t } = useTrans();
    const lastRound =
        snapshot.history.find(
            (round) => round.id === snapshot.room.currentRoundId,
        ) ?? null;
    const outcome = lastEnded?.outcome ?? lastRound?.outcome ?? null;
    const word = lastEnded?.word ?? lastRound?.word ?? null;
    const winnerId =
        lastEnded?.winnerPlayerId ?? lastRound?.winnerPlayerId ?? null;
    const winner =
        snapshot.players.find((player) => player.id === winnerId) ?? null;

    if (outcome === null) {
        return (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
                <h2 className="text-xl font-semibold">{t('Ready to play?')}</h2>
                <StartRoundControls label={t('Start')} />
            </div>
        );
    }

    return (
        <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-lg border p-6 text-center">
            <Badge variant="secondary">{outcomeLabel(outcome, t)}</Badge>
            {word && (
                <p className="text-2xl font-semibold tracking-wide">{word}</p>
            )}
            {winner && (
                <p className="text-muted-foreground">
                    {t(':name found it!', { name: winner.name })}
                </p>
            )}
            <StartRoundControls label={t('Next round')} />
        </div>
    );
}
