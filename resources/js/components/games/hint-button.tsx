import { Lightbulb } from 'lucide-react';
import { useState } from 'react';
import GameRoundHintsController from '@/actions/App/Http/Controllers/Games/GameRoundHintsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { hintsUsed } from '@/lib/games/hints';
import type { GameHintResponse, GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

export function HintButton({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const left = Math.max(
        0,
        (round.maxHints ?? 0) - hintsUsed(round.mask ?? []),
    );

    const reveal = async () => {
        setBusy(true);

        let response: GameHintResponse | undefined;

        try {
            response = await ctx.run(
                retroRequest<GameHintResponse>(
                    GameRoundHintsController.store({
                        room: ctx.snapshot.room.id,
                        round: round.id,
                    }),
                ),
            );
        } finally {
            setBusy(false);
        }

        if (response) {
            ctx.dispatch({
                type: 'round.patched',
                roundId: round.id,
                patch: { mask: response.mask },
            });
        }
    };

    return (
        <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-w-0"
            disabled={busy || left === 0}
            onClick={() => void reveal()}
        >
            <Lightbulb aria-hidden />
            <span className="truncate">
                {left === 1
                    ? t('Reveal a letter (1 left)')
                    : t('Reveal a letter (:count left)', { count: left })}
            </span>
        </Button>
    );
}
