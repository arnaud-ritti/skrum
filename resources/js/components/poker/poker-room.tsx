import { Eye } from 'lucide-react';
import { useState } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import {
    CursorToggle,
    useHideMyCursor,
} from '@/components/session/cursor-preference';
import { SessionPresence } from '@/components/session/session-presence';
import { SessionShell } from '@/components/session/session-shell';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useRestoreFocus } from '@/components/ui/use-restore-focus';
import { useMinWidth } from '@/hooks/use-min-width';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePokerGame } from '@/hooks/use-poker-game';
import { useTrans } from '@/hooks/use-trans';
import { showsPokerCursors } from '@/lib/poker/room-adapters';
import type { PokerSnapshot } from '@/lib/poker/types';
import { realtimeState } from '@/lib/realtime/realtime-state';
import type { PokerDeckOption } from '@/types';
import { AutoRevealTriggers } from './auto-reveal-triggers';
import { GameProvider, useGame, type GameContextValue } from './game-context';
import { RoomCursors } from './room-cursors';
import { RoomDialogs } from './room-dialogs';
import type { RoomDialog } from './room-dialogs';
import { RoomDock } from './room-dock';
import { RoomGone } from './room-gone';
import { RoomReactions } from './room-reactions';
import { RoomTable } from './room-table';
import {
    CopyGuestLinkButton,
    DeckBadge,
    FacilitatorMenu,
    RoomStateBadges,
    RoomTimer,
    RoomTitle,
    ShareButton,
    TakeControlButton,
    TasksToggle,
    WatchSwitch,
} from './room-topbar';
import { StoryCard } from './story-card';
import { TaskQueue } from './task-queue';
import { useRoundActions, useSetSpectator } from './use-round-actions';

/** The queue is a side panel from this width; below, a drawer. */
const WideFrom = 1024;

type Props = { snapshot: PokerSnapshot; deckOptions: PokerDeckOption[] };

/**
 * The planning poker room, on the single table model: the story on top, the
 * players around the oval table, the queue on the right, the deck at the
 * bottom with the reaction bar above it.
 */
export function PokerRoom({ snapshot: initial, deckOptions }: Props) {
    const [departures, setDepartures] = useState(0);
    const game = usePokerGame(initial, {
        onLeaving: () => setDepartures((count) => count + 1),
    });

    if (game.status !== 'active') {
        return (
            <RoomGone reason={game.status} teamUrl={game.snapshot.links.team} />
        );
    }

    const ctx: GameContextValue = {
        snapshot: game.snapshot,
        dispatch: game.dispatch,
        apply: game.apply,
        run: game.run,
        handleError: game.handleError,
        refetch: game.refetch,
        sessionExpired: game.sessionExpired,
        online: game.online,
        presence: game.presence,
        serverOffset: game.serverOffset,
        deckOptions,
    };

    return (
        <GameProvider value={ctx}>
            <AutoRevealTriggers departures={departures} />
            <RoomView
                connected={game.connected}
                reconnecting={game.reconnecting}
            />
        </GameProvider>
    );
}

/** The watcher's notice, under the header. "Join the vote" gives the viewer a hand again. */
function WatchingBanner() {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const { busy, setSpectator } = useSetSpectator();
    const canJoin = snapshot.game.endedAt === null && snapshot.me.isSpectator;

    return (
        <div
            role="status"
            data-slot="poker-watching-banner"
            className="flex min-w-0 shrink-0 items-center gap-3 border-b border-skrum-info-text/20 bg-skrum-info-soft px-4 py-2 text-sm font-medium text-skrum-info-text"
        >
            <Eye aria-hidden className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">
                {t("You're watching — switch to Play to vote")}
            </span>
            {canJoin && (
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto shrink-0 p-0 text-skrum-info-text"
                    disabled={busy}
                    onClick={() =>
                        void setSpectator(snapshot.me.playerId, false)
                    }
                >
                    {t('Join the vote')}
                </Button>
            )}
        </div>
    );
}

/** The room as it is drawn from the game context; the design-system bench renders it on fixed data. */
export function RoomView({
    connected,
    reconnecting,
}: {
    connected: boolean;
    reconnecting: boolean;
}) {
    const { snapshot, online, sessionExpired } = useGame();
    const { t } = useTrans();
    const isWide = useMinWidth(WideFrom);
    const isPhone = useIsMobile();
    const [stage, setStage] = useState<HTMLElement | null>(null);
    const [hideMyCursor, setHideMyCursor] = useHideMyCursor();
    const [tasksCollapsed, setTasksCollapsed] = useState(false);
    const [tasksOpen, setTasksOpen] = useState(false);
    const [dialog, setDialog] = useState<RoomDialog | null>(null);
    const restoreFocus = useRestoreFocus(tasksOpen);
    const actions = useRoundActions();
    const { game, me, current } = snapshot;
    const currentTask = current
        ? (snapshot.tasks.find((task) => task.id === current.taskId) ?? null)
        : null;
    const player = snapshot.players.find(
        (candidate) => candidate.id === me.playerId,
    );
    const self = player
        ? {
              name: player.name,
              avatarUrl: player.avatarUrl,
              isGuest: player.isGuest,
          }
        : null;
    const showsQueue = isWide && !tasksCollapsed;
    const tasksToggle = (
        <TasksToggle
            wide={isWide}
            collapsed={tasksCollapsed}
            onCollapsedChange={setTasksCollapsed}
            onOpenDrawer={() => setTasksOpen(true)}
        />
    );

    return (
        <SessionShell
            kind="poker"
            self={self}
            realtime={realtimeState(connected, online)}
            connection={{ reconnecting, expired: sessionExpired }}
            title={<RoomTitle showDeck={!isPhone} />}
            phases={
                isWide ? (
                    <RoomStateBadges className="max-h-12 justify-center overflow-hidden" />
                ) : undefined
            }
            timer={isPhone ? undefined : <RoomTimer />}
            presence={
                <SessionPresence
                    online={online}
                    selfId={me.playerId}
                    facilitatorId={game.facilitatorPlayerId}
                    className="shrink-0 flex-nowrap"
                />
            }
            actions={
                <>
                    {!isPhone && (
                        <>
                            <WatchSwitch />
                            {tasksToggle}
                            <TakeControlButton />
                            <CopyGuestLinkButton />
                            {showsPokerCursors(snapshot) && (
                                <CursorToggle
                                    hidden={hideMyCursor}
                                    onChange={setHideMyCursor}
                                />
                            )}
                            <ShareButton onClick={() => setDialog('share')} />
                        </>
                    )}
                    <FacilitatorMenu
                        shareInMenu={isPhone}
                        onChoose={setDialog}
                    />
                    {me.isGuest && <LanguageSwitcher />}
                </>
            }
        >
            <div
                data-slot="poker-room"
                className="flex h-full min-h-0 flex-col"
            >
                {!me.canVote && <WatchingBanner />}
                {!isWide && (
                    <div
                        data-slot="poker-subbar"
                        className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-2"
                    >
                        {isPhone && <DeckBadge />}
                        <RoomStateBadges />
                        {isPhone && (
                            <>
                                <span className="flex-1" />
                                <RoomTimer />
                                <WatchSwitch />
                                {tasksToggle}
                                <TakeControlButton />
                                <CopyGuestLinkButton />
                            </>
                        )}
                    </div>
                )}
                <div
                    className={
                        showsQueue
                            ? 'grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_20rem]'
                            : 'grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)]'
                    }
                >
                    <div className="flex min-h-0 min-w-0 flex-col">
                        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
                            {/*
                             * The cursor layer takes the size of this box and
                             * would then keep it from shrinking: it is capped
                             * to the box, which follows the content.
                             */}
                            <div
                                ref={setStage}
                                data-slot="poker-stage"
                                className="relative flex min-h-full flex-col items-center gap-4 px-4 pt-5 pb-4 lg:px-8 [&>.lc-overlay]:max-h-full [&>.lc-overlay]:max-w-full"
                            >
                                {currentTask && (
                                    <StoryCard
                                        key={currentTask.id}
                                        task={currentTask}
                                        className="max-w-5xl"
                                    />
                                )}
                                <RoomTable
                                    task={currentTask}
                                    actions={actions}
                                />
                                <RoomCursors
                                    container={stage}
                                    hidden={hideMyCursor}
                                />
                            </div>
                        </div>
                        <RoomDock
                            reactions={<RoomReactions compact={isPhone} />}
                            actions={actions}
                            compact={isPhone}
                        />
                    </div>
                    {showsQueue && (
                        <aside
                            id="poker-tasks"
                            aria-label={t('Tasks')}
                            className="flex min-h-0 flex-col border-l border-border bg-card"
                        >
                            <TaskQueue />
                        </aside>
                    )}
                </div>
            </div>
            <RoomDialogs dialog={dialog} onClose={() => setDialog(null)} />
            {!isWide && (
                <Drawer open={tasksOpen} onOpenChange={setTasksOpen}>
                    <DrawerContent
                        id="poker-tasks"
                        aria-describedby={undefined}
                        closeLabel={t('Close')}
                        className="px-0"
                        onCloseAutoFocus={restoreFocus}
                    >
                        <DrawerTitle className="sr-only">
                            {t('Tasks')}
                        </DrawerTitle>
                        <TaskQueue onSelected={() => setTasksOpen(false)} />
                    </DrawerContent>
                </Drawer>
            )}
        </SessionShell>
    );
}
