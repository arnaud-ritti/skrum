import { Flag } from 'lucide-react';
import { useState } from 'react';
import GameRoundPassesController from '@/actions/App/Http/Controllers/Games/GameRoundPassesController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { GameRound, GameRoundEnded } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

/** The round's leader or the host ends the turn without a winner. */
export function PassRoundButton({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { room, me } = ctx.snapshot;

    if (!room.isHost && round.leaderPlayerId !== me.playerId) {
        return null;
    }

    const pass = async () => {
        setBusy(true);

        let response: { ended: GameRoundEnded } | undefined;

        try {
            response = await ctx.run(
                retroRequest<{ ended: GameRoundEnded }>(
                    GameRoundPassesController.store({
                        room: room.id,
                        round: round.id,
                    }),
                ),
            );
        } finally {
            setBusy(false);
        }

        if (response?.ended) {
            ctx.dispatch({ type: 'round.ended', ended: response.ended });
            void ctx.refetch();
        }
    };

    return (
        <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void pass()}
        >
            <Flag className="size-4" />
            {round.game === 'hangman' ? t('Give up') : t('Pass')}
        </Button>
    );
}
