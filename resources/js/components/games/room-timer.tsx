import { AlarmClock } from 'lucide-react';
import { useState } from 'react';
import GameTimersController from '@/actions/App/Http/Controllers/Games/GameTimersController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatSeconds, useCountdown } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

const Minutes = [1, 2, 3, 5, 10];

export function RoomTimer() {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { room } = ctx.snapshot;
    const remaining = useCountdown(room.timerEndsAt, ctx.serverOffset);
    const canSet = room.isHost && !room.isIcebreaker;

    const set = async (seconds: number | null) => {
        setBusy(true);

        let response: { timerEndsAt: string | null } | undefined;

        try {
            response = await ctx.run(
                retroRequest<{ timerEndsAt: string | null }>(
                    GameTimersController.update(room.id),
                    { seconds },
                ),
            );
        } finally {
            setBusy(false);
        }

        if (response) {
            ctx.apply({ type: 'timer.set', timerEndsAt: response.timerEndsAt });
        }
    };

    const display =
        remaining === null ? null : remaining === 0 ? (
            <Badge variant="destructive">{t("Time's up")}</Badge>
        ) : (
            <Badge variant="secondary" className="tabular-nums">
                {formatSeconds(remaining)}
            </Badge>
        );

    if (!canSet) {
        return display;
    }

    return (
        <div className="flex items-center gap-2">
            {display}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" aria-label={t('Timer')}>
                        <AlarmClock className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {Minutes.map((minutes) => (
                        <DropdownMenuItem
                            key={minutes}
                            disabled={busy}
                            onSelect={() => void set(minutes * 60)}
                        >
                            {t(':count min', { count: minutes })}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        disabled={busy || room.timerEndsAt === null}
                        onSelect={() => void set(null)}
                    >
                        {t('Stop timer')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
