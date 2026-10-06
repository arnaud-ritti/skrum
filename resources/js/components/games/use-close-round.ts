import { useState } from 'react';
import GameClosuresController from '@/actions/App/Http/Controllers/Games/GameClosuresController';
import type { GameRoundEnded } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

/** Closes the votes of a round, which ends it. Resolves to false when the server refused. */
export function useCloseRound(): {
    busy: boolean;
    close: (roundId: string) => Promise<boolean>;
} {
    const ctx = useRoom();
    const [busy, setBusy] = useState(false);

    const close = async (roundId: string): Promise<boolean> => {
        setBusy(true);

        let response: { ended: GameRoundEnded } | undefined;

        try {
            response = await ctx.run(
                retroRequest<{ ended: GameRoundEnded }>(
                    GameClosuresController.store({
                        room: ctx.snapshot.room.id,
                        round: roundId,
                    }),
                ),
            );
        } finally {
            setBusy(false);
        }

        if (!response) {
            return false;
        }

        ctx.dispatch({ type: 'round.ended', ended: response.ended });
        void ctx.refetch();

        return true;
    };

    return { busy, close };
}
