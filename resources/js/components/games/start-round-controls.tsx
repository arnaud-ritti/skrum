import { Play } from 'lucide-react';
import { useState } from 'react';
import GameRoundsController from '@/actions/App/Http/Controllers/Games/GameRoundsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { GameStartResponse } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

export function StartRoundControls({ label }: { label: string }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { room, games } = ctx.snapshot;
    const isAvailable = games.some(
        (option) => option.value === room.game && option.available,
    );

    if (!room.isHost) {
        return (
            <p className="text-muted-foreground">
                {t('Waiting for the host to start.')}
            </p>
        );
    }

    if (!isAvailable) {
        return (
            <p className="text-muted-foreground">
                {t('This game is not available.')}
            </p>
        );
    }

    const start = async () => {
        setBusy(true);

        let response: GameStartResponse | undefined;

        try {
            response = await ctx.run(
                retroRequest<GameStartResponse>(
                    GameRoundsController.store(room.id),
                    {},
                ),
            );
        } finally {
            setBusy(false);
        }

        if (!response) {
            return;
        }

        if (response.ended) {
            ctx.dispatch({ type: 'round.ended', ended: response.ended });
        }

        ctx.dispatch({ type: 'round.started', round: response.round });
    };

    return (
        <Button disabled={busy} onClick={() => void start()}>
            <Play className="size-4" />
            {label}
        </Button>
    );
}
