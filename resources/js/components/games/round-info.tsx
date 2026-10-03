import { useTrans } from '@/hooks/use-trans';
import { WordGames, wordThemeLabel } from '@/lib/games/settings';
import type { GameRound } from '@/lib/games/types';
import { useRoom } from './room-context';

/** "Round 2 of 3 · Theme: Team & tech" above the stage title (spec §9.3). */
export function RoundInfo({ round }: { round: GameRound }) {
    const { snapshot } = useRoom();
    const { t } = useTrans();

    if (round.number === null || round.number === undefined) {
        return null;
    }

    const { wordThemes } = snapshot.room.settings;
    const parts = [
        round.roundsTotal === null || round.roundsTotal === undefined
            ? t('Round :number', { number: round.number })
            : t('Round :number of :total', {
                  number: round.number,
                  total: round.roundsTotal,
              }),
    ];

    if (WordGames.includes(round.game) && wordThemes.length === 1) {
        parts.push(
            t('Theme: :theme', { theme: wordThemeLabel(wordThemes[0], t) }),
        );
    }

    return (
        <p
            data-slot="round-info"
            className="min-w-0 truncate text-overline text-muted-foreground uppercase"
        >
            {parts.join(' · ')}
        </p>
    );
}
