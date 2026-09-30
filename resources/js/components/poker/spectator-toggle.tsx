import { Eye, Hand, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import PokerSpectatorsController from '@/actions/App/Http/Controllers/Poker/PokerSpectatorsController';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import type { PokerPlayer } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

function useSetSpectator() {
    const { snapshot, run, refetch } = useGame();
    const [busy, setBusy] = useState(false);

    const setSpectator = async (playerId: string, spectator: boolean) => {
        setBusy(true);

        const result = await run(
            retroRequest(
                PokerSpectatorsController.update({
                    game: snapshot.game.id,
                    player: playerId,
                }),
                { spectator },
            ),
        );

        setBusy(false);

        if (result !== undefined) {
            await refetch();
        }
    };

    return { busy, setSpectator };
}

export function SpectatorToggle() {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const { busy, setSpectator } = useSetSpectator();

    if (snapshot.game.endedAt !== null) {
        return null;
    }

    const watching = snapshot.me.isSpectator;

    return (
        <Button
            size="sm"
            variant="outline"
            aria-pressed={watching}
            disabled={busy}
            onClick={() => void setSpectator(snapshot.me.playerId, !watching)}
        >
            {watching ? (
                <Hand className="size-4" aria-hidden="true" />
            ) : (
                <Eye className="size-4" aria-hidden="true" />
            )}
            {watching ? t('Play') : t('Watch only')}
        </Button>
    );
}

export function PlayerRoleMenu({ player }: { player: PokerPlayer }) {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const { busy, setSpectator } = useSetSpectator();

    if (
        !snapshot.me.isFacilitator ||
        snapshot.game.endedAt !== null ||
        player.id === snapshot.me.playerId
    ) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    aria-label={t('Player options')}
                >
                    <MoreHorizontal className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    disabled={busy}
                    onSelect={() =>
                        void setSpectator(player.id, !player.isSpectator)
                    }
                >
                    {player.isSpectator
                        ? t('Make player')
                        : t('Make spectator')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
