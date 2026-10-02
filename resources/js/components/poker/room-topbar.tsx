import {
    ArrowRightLeft,
    CircleStop,
    Ellipsis,
    Eye,
    Hand as HandIcon,
    Link2,
    ListTodo,
    PanelRightClose,
    PanelRightOpen,
    RotateCcw,
    Share2,
    Spade,
    Trash2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCountdown } from '@/hooks/use-countdown';
import { useMinWidth } from '@/hooks/use-min-width';
import { useTrans } from '@/hooks/use-trans';
import { hasShareChannel } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { useGame } from './game-context';
import { CustomTimerDialog } from './room-dialogs';
import type { RoomDialog } from './room-dialogs';
import { useSetEnded, useSetSpectator } from './use-round-actions';

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
            className="h-8 w-full min-w-0 border-transparent bg-transparent px-2 text-base font-semibold shadow-none hover:border-input md:-ml-2 md:h-7 md:text-base"
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

/** "team · Planning poker"; a guest is not told the team. */
function useRoomOverline(): string {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const { teamName } = snapshot.game;

    return teamName === null
        ? t('Planning poker')
        : `${teamName} · ${t('Planning poker')}`;
}

/** Back link, the team line, the name and, beside it, the deck. From `md` the name is capped so that the rest of the header keeps its room; on a phone it has what the counter and the menu leave. */
export function RoomTitle({ showDeck }: { showDeck: boolean }) {
    const { snapshot } = useGame();
    const overline = useRoomOverline();
    const { game, me, links } = snapshot;
    const canRename = me.isFacilitator && game.endedAt === null;

    return (
        <div
            className={cn(
                'md:max-w-64 xl:max-w-96',
                canRename && 'w-36 md:w-64 xl:w-96',
            )}
        >
            <SessionTitle
                backHref={links.team}
                overline={overline}
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
    const [customOpen, setCustomOpen] = useState(false);
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

    const set = async (seconds: number | null): Promise<boolean> => {
        const response = await run(
            retroRequest<{ timerEndsAt: string | null }>(
                PokerTimersController.update(route),
                { seconds },
            ),
        );

        if (!response) {
            return false;
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

        return true;
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
                <CustomTimerDialog
                    open={customOpen}
                    onOpenChange={setCustomOpen}
                    onStart={set}
                />
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
            aria-expanded={!collapsed}
            aria-controls={collapsed ? undefined : 'poker-tasks'}
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

/** A member who does not facilitate copies the guest link from here; the facilitator has it in the Share dialog. */
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

/** The header's Share button shows its label from this width. */
const ShareLabelFrom = 1536;

/**
 * "Share" of the header: the guest link and the channels. The facilitator's,
 * while the game runs. Its label shows from 96rem: below, the header keeps the
 * room for the state of the round.
 */
export function ShareButton({ onClick }: { onClick: () => void }) {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const isRoomy = useMinWidth(ShareLabelFrom);

    if (!snapshot.me.isFacilitator || snapshot.game.endedAt !== null) {
        return null;
    }

    if (isRoomy) {
        return (
            <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                aria-label={t('Share')}
                data-slot="poker-share"
                onClick={onClick}
            >
                <Share2 aria-hidden />
                <span>{t('Share')}</span>
            </Button>
        );
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="shrink-0"
                    aria-label={t('Share')}
                    data-slot="poker-share"
                    onClick={onClick}
                >
                    <Share2 aria-hidden />
                </Button>
            </TooltipTrigger>
            <TooltipContent>{t('Share')}</TooltipContent>
        </Tooltip>
    );
}

/**
 * The facilitator's menu. The settings have their own button beside it, and
 * the guest link is in the Share dialog only; "Share…" is listed when a
 * channel is connected, and where the header has no room for its Share button.
 */
export function FacilitatorMenu({
    shareInMenu,
    onChoose,
}: {
    shareInMenu: boolean;
    onChoose: (dialog: RoomDialog) => void;
}) {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const { busy, setEnded } = useSetEnded();
    const { game, me, share } = snapshot;
    const isEnded = game.endedAt !== null;
    const offersShare =
        hasShareChannel(share) || (shareInMenu && me.isFacilitator && !isEnded);

    if (!me.isFacilitator && !me.canDelete) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="shrink-0"
                    aria-label={t('Facilitator menu')}
                >
                    <Ellipsis aria-hidden />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {offersShare && (
                    <>
                        <DropdownMenuItem onSelect={() => onChoose('share')}>
                            <Share2 aria-hidden />
                            {t('Share…')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </>
                )}
                {me.isFacilitator && !isEnded && (
                    <>
                        <DropdownMenuItem onSelect={() => onChoose('transfer')}>
                            <ArrowRightLeft aria-hidden />
                            {t('Hand over facilitation…')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onChoose('end')}>
                            <CircleStop aria-hidden />
                            {t('End game')}
                        </DropdownMenuItem>
                    </>
                )}
                {me.isFacilitator && isEnded && (
                    <DropdownMenuItem
                        disabled={busy}
                        onSelect={() => void setEnded(false)}
                    >
                        <RotateCcw aria-hidden />
                        {t('Reopen game')}
                    </DropdownMenuItem>
                )}
                {me.canDelete && (
                    <>
                        {me.isFacilitator && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => onChoose('delete')}
                        >
                            <Trash2 aria-hidden />
                            {t('Delete game…')}
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
