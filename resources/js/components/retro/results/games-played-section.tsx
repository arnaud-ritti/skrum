import { useState } from 'react';
import { useTrans } from '@/hooks/use-trans';
import type { GamesPlayed } from '@/lib/retro/types';
import { GamesPlayedPodium } from './games-played-podium';
import { GamesPlayedRound } from './games-played-round';
import { ResultsSection } from './results-section';
import { RoundReplayDialog } from './round-replay-dialog';

export function GamesPlayedSection({ games }: { games: GamesPlayed }) {
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
        <ResultsSection title={t('Games we played')}>
            <p className="text-sm text-muted-foreground">
                {t(':count rounds played', { count: games.roundsPlayed })}
            </p>
            <GamesPlayedPodium leaderboard={games.leaderboard} />
            <ol className="space-y-2">
                {games.rounds.map((round) => (
                    <GamesPlayedRound
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
        </ResultsSection>
    );
}
