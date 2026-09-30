import { useState } from 'react';
import GameSwitchesController from '@/actions/App/Http/Controllers/Games/GameSwitchesController';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { GameKind } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

/** Switching mid-round abandons the round for everyone (spec §4). */
export function GameSwitcher() {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { room, games } = ctx.snapshot;

    const change = async (game: GameKind) => {
        if (game === room.game) {
            return;
        }

        setBusy(true);

        let result: unknown;

        try {
            result = await ctx.run(
                retroRequest(GameSwitchesController.update(room.id), { game }),
            );
        } finally {
            setBusy(false);
        }

        if (result !== undefined) {
            await ctx.refetch();
        }
    };

    return (
        <Select
            value={room.game}
            disabled={busy}
            onValueChange={(value) => void change(value as GameKind)}
        >
            <SelectTrigger className="w-48" aria-label={t('Game')}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {games
                    .filter(
                        (option) =>
                            option.available || option.value === room.game,
                    )
                    .map((option) => (
                        <SelectItem
                            key={option.value}
                            value={option.value}
                            disabled={!option.available}
                        >
                            {option.label}
                        </SelectItem>
                    ))}
            </SelectContent>
        </Select>
    );
}
