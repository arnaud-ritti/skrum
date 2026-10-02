import {
    Eye,
    Hand as HandIcon,
    Link2,
    ListTodo,
    PanelRightClose,
    PanelRightOpen,
    Spade,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { toast } from 'sonner';
import PokerFacilitatorsController from '@/actions/App/Http/Controllers/Poker/PokerFacilitatorsController';
import PokerSettingsController from '@/actions/App/Http/Controllers/Poker/PokerSettingsController';
import PokerTimerExtensionsController from '@/actions/App/Http/Controllers/Poker/PokerTimerExtensionsController';
import PokerTimersController from '@/actions/App/Http/Controllers/Poker/PokerTimersController';
import { SessionTimer } from '@/components/session/session-timer';
import { SessionTitle } from '@/components/session/session-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCountdown } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { useGame } from './game-context';
import { useSetSpectator } from './use-round-actions';

/** The game's name: edited in place by the facilitator, saved on blur or Enter, Escape cancels. */
function TitleEditor() {
    const { snapshot, run, refetch } = useGame();
    const { t } = useTrans();
    const [value, setValue] = useState(snapshot.game.title);
    const isCancelled = useRef(false);

    const save = async () => {
        if (isCancelled.current) {
            isCancelled.current = false;
            setValue(snapshot.game.title);

            return;
        }

        const title = value.trim();

        if (title === '' || title === snapshot.game.title) {
            setValue(snapshot.game.title);

            return;
        }

        const result = await run(
            retroRequest(PokerSettingsController.update(snapshot.game.id), {
                title,
            }),
        );

        if (result !== undefined) {
            await refetch();
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.currentTarget.blur();
        }

        if (event.key === 'Escape') {
            isCancelled.current = true;
            event.currentTarget.blur();
        }
    };

    return (
        <Input
            value={value}
            maxLength={120}
            aria-label={t('Game title')}
            className="h-8 w-full min-w-0 border-transparent bg-transparent px-2 text-base font-semibold shadow-none hover:border-input md:text-base"
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => void save()}
            onKeyDown={onKeyDown}
        />
    );
}

/** The deck of the game, as the topbar of the mockup shows it. */
export function DeckBadge() {
    const { snapshot } = useGame();

    return (
        <Badge
            variant="soft"
            shape="pill"
            icon={Spade}
            className="max-w-40 min-w-0 shrink"
        >
            <span className="truncate">{snapshot.game.deckLabel}</span>
        </Badge>
    );
}

/** Back link, name and, beside it, the deck. The name is capped so that the rest of the header keeps its room. */
export function RoomTitle({ showDeck }: { showDeck: boolean }) {
    const { snapshot } = useGame();
    const { game, me, links } = snapshot;
    const canRename = me.isFacilitator && game.endedAt === null;

    return (
        <div
            className={cn(
                'max-w-36 md:max-w-64 xl:max-w-96',
                canRename && 'w-36 md:w-64 xl:w-96',
            )}
        >
            <SessionTitle
                backHref={links.team}
                badges={showDeck ? <DeckBadge /> : undefined}
            >
                {canRename ? <TitleEditor key={game.title} /> : game.title}
            </SessionTitle>
        </div>
    );
}

/** Where the game stands: the round, and what the facilitator turned on. */
export function RoomStateBadges({ className }: { className?: string }) {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const { game, current } = snapshot;
    const isEnded = game.endedAt !== null;

    return (
        <div
            data-slot="poker-state"
            className={cn(
                'flex min-w-0 flex-wrap items-center gap-2',
                className,
            )}
        >
            {isEnded && <Badge variant="muted">{t('Game ended')}</Badge>}
            {current && !isEnded && (
                <Badge variant="outline" shape="pill">
                    {current.round.revealedAt === null
                        ? t('Round :number · voting', {
                              number: current.round.number,
                          })
                        : t('Round :number · revealed', {
                              number: current.round.number,
                          })}
                </Badge>
            )}
            {game.anonymousVotes && (
                <Badge variant="outline" shape="pill">
                    {t('Anonymous votes')}
                </Badge>
            )}
            {game.autoReveal && (
                <Badge variant="outline" shape="pill">
                    {t('Auto-reveal')}
                </Badge>
            )}
        </div>
    );
}

/**
 * The countdown of the open round, for everyone. The facilitator starts it
 * from the timer's own list or from "Custom…", stops it and adds two minutes.
 */
export function RoomTimer() {
    const { snapshot, serverOffset, run, apply } = useGame();
    const { t } = useTrans();
    const [customOpen, setCustomOpen] = useState(false);
    const [minutes, setMinutes] = useState('5');
    const [started, setStarted] = useState<{
        endsAt: string;
        seconds: number;
    } | null>(null);
    const { game, me, current } = snapshot;
    const round = current?.round ?? null;
    const isOpen =
        round !== null && round.revealedAt === null && game.endedAt === null;
    const endsAt = isOpen ? round.timerEndsAt : null;
    const canControl = isOpen && me.isFacilitator;
    const remaining = useCountdown(endsAt, serverOffset);

    if (!isOpen) {
        return null;
    }

    const route = { game: game.id, round: round.id };

    const set = async (seconds: number | null) => {
        const response = await run(
            retroRequest<{ timerEndsAt: string | null }>(
                PokerTimersController.update(route),
                { seconds },
            ),
        );

        if (!response) {
            return;
        }

        setStarted(
            seconds !== null && response.timerEndsAt !== null
                ? { endsAt: response.timerEndsAt, seconds }
                : null,
        );
        apply({
            type: 'timer.set',
            roundId: round.id,
            timerEndsAt: response.timerEndsAt,
        });
    };

    const extend = async () => {
        const response = await run(
            retroRequest<{ timerEndsAt: string }>(
                PokerTimerExtensionsController.store(route),
            ),
        );

        if (!response) {
            return;
        }

        setStarted(null);
        apply({
            type: 'timer.set',
            roundId: round.id,
            timerEndsAt: response.timerEndsAt,
        });
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
            <SessionTimer
                endsAt={endsAt}
                offset={serverOffset}
                totalSeconds={
                    started !== null && started.endsAt === endsAt
                        ? started.seconds
                        : undefined
                }
                onStart={
                    canControl ? (seconds) => void set(seconds) : undefined
                }
                onStop={canControl ? () => void set(null) : undefined}
                onCustom={canControl ? () => setCustomOpen(true) : undefined}
                onExtend={
                    canControl && remaining !== null && remaining > 0
                        ? () => void extend()
                        : undefined
                }
                className="shrink-0"
            />
            {canControl && (
                <Dialog open={customOpen} onOpenChange={setCustomOpen}>
                    <DialogContent aria-describedby={undefined}>
                        <DialogTitle>{t('Custom minutes')}</DialogTitle>
                        <form
                            onSubmit={startCustom}
                            className="flex flex-col gap-4"
                        >
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
                                <Button type="submit">
                                    {t('Start timer')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

/** "Watch only": the viewer sits out. The label stays when it is on (3-D9). */
export function WatchSwitch() {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const { busy, setSpectator } = useSetSpectator();

    if (snapshot.game.endedAt !== null) {
        return null;
    }

    const watching = snapshot.me.isSpectator;

    return (
        <label
            htmlFor="poker-watch-only"
            data-slot="poker-watch"
            data-state={watching ? 'on' : 'off'}
            className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-input bg-card pr-2 pl-3 text-sm font-semibold whitespace-nowrap data-[state=on]:border-primary data-[state=on]:bg-skrum-primary-soft data-[state=on]:text-skrum-primary-text"
        >
            <Eye aria-hidden className="size-4 shrink-0" />
            <span>{t('Watch only')}</span>
            <Switch
                id="poker-watch-only"
                checked={watching}
                disabled={busy}
                onCheckedChange={(checked) =>
                    void setSpectator(snapshot.me.playerId, checked)
                }
            />
        </label>
    );
}

/** The queue toggle: it hides the panel on a wide screen, and opens the drawer elsewhere. */
export function TasksToggle({
    wide,
    collapsed,
    onCollapsedChange,
    onOpenDrawer,
}: {
    wide: boolean;
    collapsed: boolean;
    onCollapsedChange: (collapsed: boolean) => void;
    onOpenDrawer: () => void;
}) {
    const { t } = useTrans();

    if (!wide) {
        return (
            <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={onOpenDrawer}
            >
                <ListTodo aria-hidden />
                <span>{t('Tasks')}</span>
            </Button>
        );
    }

    return (
        <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0"
            aria-pressed={!collapsed}
            aria-controls="poker-tasks"
            onClick={() => onCollapsedChange(!collapsed)}
        >
            {collapsed ? (
                <PanelRightOpen aria-hidden />
            ) : (
                <PanelRightClose aria-hidden />
            )}
            <span>{collapsed ? t('Show tasks') : t('Hide tasks')}</span>
        </Button>
    );
}

export function TakeControlButton() {
    const { snapshot, run, refetch } = useGame();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { me, game } = snapshot;

    if (!me.canTakeControl || me.userId === null) {
        return null;
    }

    const takeControl = async () => {
        setBusy(true);

        const result = await run(
            retroRequest(PokerFacilitatorsController.update(game.id), {
                user_id: me.userId,
            }),
        );

        setBusy(false);

        if (result !== undefined) {
            await refetch();
        }
    };

    return (
        <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={busy}
            onClick={() => void takeControl()}
        >
            <HandIcon aria-hidden />
            <span>{t('Take control')}</span>
        </Button>
    );
}

/** A member who does not facilitate copies the guest link from here; the facilitator has it in the menu. */
export function CopyGuestLinkButton() {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const { game, me } = snapshot;

    if (me.isGuest || me.isFacilitator || game.guestUrl === null) {
        return null;
    }

    const url = game.guestUrl;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            toast(t('Link copied'));
        } catch {
            toast.error(t('Something went wrong. Please try again.'));
        }
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t('Copy guest link')}
                    onClick={() => void copy()}
                >
                    <Link2 aria-hidden />
                </Button>
            </TooltipTrigger>
            <TooltipContent>{t('Copy guest link')}</TooltipContent>
        </Tooltip>
    );
}
