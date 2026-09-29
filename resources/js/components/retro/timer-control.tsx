import { AlarmClock } from 'lucide-react';
import RetroTimersController from '@/actions/App/Http/Controllers/Retros/RetroTimersController';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardContextValue } from './board';

const Minutes = [1, 3, 5, 10];

export function TimerControl({ ctx }: { ctx: BoardContextValue }) {
    const { t } = useTrans();

    const set = async (seconds: number | null) => {
        const response = await ctx.run(
            retroRequest<{ timerEndsAt: string | null }>(
                RetroTimersController.update(ctx.board.retro.id),
                { seconds },
            ),
        );

        if (response) {
            ctx.dispatch({
                type: 'timer.set',
                timerEndsAt: response.timerEndsAt,
            });
        }
    };

    return (
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
                        onSelect={() => void set(minutes * 60)}
                    >
                        {t(':count min', { count: minutes })}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    disabled={ctx.board.retro.timerEndsAt === null}
                    onSelect={() => void set(null)}
                >
                    {t('Stop timer')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
