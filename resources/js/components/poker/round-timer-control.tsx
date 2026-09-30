import { AlarmClock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import PokerTimersController from '@/actions/App/Http/Controllers/Poker/PokerTimersController';
import { TimerDisplay } from '@/components/retro/timer-display';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

const PresetSeconds = [30, 60, 120, 180];

export function RoundTimerControl() {
    const { snapshot, run, apply } = useGame();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const [customOpen, setCustomOpen] = useState(false);
    const [minutes, setMinutes] = useState('5');
    const round = snapshot.current?.round ?? null;

    if (
        !snapshot.me.isFacilitator ||
        snapshot.game.endedAt !== null ||
        round === null ||
        round.revealedAt !== null
    ) {
        return null;
    }

    const set = async (seconds: number | null) => {
        setBusy(true);

        const response = await run(
            retroRequest<{ timerEndsAt: string | null }>(
                PokerTimersController.update({
                    game: snapshot.game.id,
                    round: round.id,
                }),
                { seconds },
            ),
        );

        setBusy(false);

        if (response) {
            apply({
                type: 'timer.set',
                roundId: round.id,
                timerEndsAt: response.timerEndsAt,
            });
        }
    };

    const startCustom = (event: FormEvent) => {
        event.preventDefault();

        const value = Number(minutes);

        if (!Number.isInteger(value) || value < 1 || value > 60) {
            return;
        }

        setCustomOpen(false);
        void set(value * 60);
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" aria-label={t('Timer')}>
                        <AlarmClock className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {PresetSeconds.map((seconds) => (
                        <DropdownMenuItem
                            key={seconds}
                            disabled={busy}
                            onSelect={() => void set(seconds)}
                        >
                            {seconds < 60
                                ? t(':count s', { count: seconds })
                                : t(':count min', { count: seconds / 60 })}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem
                        disabled={busy}
                        onSelect={() => setCustomOpen(true)}
                    >
                        {t('Custom minutes…')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        disabled={busy || round.timerEndsAt === null}
                        onSelect={() => void set(null)}
                    >
                        {t('Stop timer')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={customOpen} onOpenChange={setCustomOpen}>
                <DialogContent aria-describedby={undefined}>
                    <DialogTitle>{t('Custom minutes')}</DialogTitle>
                    <form onSubmit={startCustom} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="poker-timer-minutes">
                                {t('Minutes')}
                            </Label>
                            <Input
                                id="poker-timer-minutes"
                                type="number"
                                min={1}
                                max={60}
                                step={1}
                                required
                                value={minutes}
                                onChange={(event) =>
                                    setMinutes(event.target.value)
                                }
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={busy}>
                                {t('Start timer')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

export function RoundCountdown() {
    const { snapshot, serverOffset } = useGame();
    const round = snapshot.current?.round ?? null;

    if (
        round === null ||
        round.revealedAt !== null ||
        round.timerEndsAt === null ||
        snapshot.game.endedAt !== null
    ) {
        return null;
    }

    return (
        <TimerDisplay
            key={round.timerEndsAt}
            endsAt={round.timerEndsAt}
            offset={serverOffset}
        />
    );
}
