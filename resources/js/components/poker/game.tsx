import { ListTodo } from 'lucide-react';
import { useState } from 'react';
import { ConnectionBanner } from '@/components/retro/connection-banner';
import { HideMyCursorKey } from '@/components/retro/live-cursor-layer';
import { SessionExpiredBanner } from '@/components/retro/session-expired-banner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { usePokerGame } from '@/hooks/use-poker-game';
import { useTrans } from '@/hooks/use-trans';
import type { PokerSnapshot } from '@/lib/poker/types';
import type { PokerDeckOption } from '@/types';
import { FacilitatorToolbar } from './facilitator-toolbar';
import { GameProvider, useGame, type GameContextValue } from './game-context';
import { GameCursors } from './game-cursors';
import { GameGone } from './game-gone';
import { GameHeader } from './game-header';
import { GameReactions } from './game-reactions';
import { Hand } from './hand';
import { PlayersGrid } from './players-grid';
import { ResultPanel } from './result-panel';
import { TaskDetail } from './task-detail';
import { TaskFormDialog } from './task-form-dialog';
import { TasksPane } from './tasks-pane';

type Props = { snapshot: PokerSnapshot; deckOptions: PokerDeckOption[] };

export function Game({ snapshot: initial, deckOptions }: Props) {
    const { t } = useTrans();
    const game = usePokerGame(initial);
    const [mainPane, setMainPane] = useState<HTMLElement | null>(null);
    const [hideMyCursor, setHideMyCursor] = useLocalPreference(
        HideMyCursorKey,
        false,
    );
    const [tasksCollapsed, setTasksCollapsed] = useState(false);
    const [tasksOpen, setTasksOpen] = useState(false);

    if (game.status !== 'active') {
        return (
            <GameGone reason={game.status} teamUrl={game.snapshot.links.team} />
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
            <div className="flex min-h-dvh flex-col">
                {game.sessionExpired && <SessionExpiredBanner />}
                <div
                    className="flex flex-1 flex-col"
                    inert={game.sessionExpired}
                >
                    <GameHeader
                        hideMyCursor={hideMyCursor}
                        onHideMyCursorChange={setHideMyCursor}
                        actions={
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="lg:hidden"
                                    onClick={() => setTasksOpen(true)}
                                >
                                    <ListTodo className="size-4" />
                                    {t('Tasks')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="hidden lg:inline-flex"
                                    aria-pressed={!tasksCollapsed}
                                    onClick={() =>
                                        setTasksCollapsed(!tasksCollapsed)
                                    }
                                >
                                    <ListTodo className="size-4" />
                                    {tasksCollapsed
                                        ? t('Show tasks')
                                        : t('Hide tasks')}
                                </Button>
                            </>
                        }
                    />
                    <ConnectionBanner reconnecting={game.reconnecting} />
                    <div className="flex flex-1 lg:min-h-0">
                        {!tasksCollapsed && (
                            <aside className="hidden w-80 shrink-0 flex-col border-r lg:flex">
                                <TasksPane />
                            </aside>
                        )}
                        <Sheet open={tasksOpen} onOpenChange={setTasksOpen}>
                            <SheetContent
                                side="left"
                                className="w-full gap-0 sm:max-w-sm"
                            >
                                <SheetTitle className="sr-only">
                                    {t('Tasks')}
                                </SheetTitle>
                                <TasksPane
                                    onSelected={() => setTasksOpen(false)}
                                />
                            </SheetContent>
                        </Sheet>
                        <main
                            ref={setMainPane}
                            className="relative flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-4"
                        >
                            <Table />
                            <GameCursors
                                container={mainPane}
                                hidden={hideMyCursor}
                            />
                        </main>
                    </div>
                </div>
            </div>
            <GameReactions />
        </GameProvider>
    );
}

function Table() {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const [adding, setAdding] = useState(false);
    const { game, me, current } = snapshot;
    const currentTask = current
        ? (snapshot.tasks.find((task) => task.id === current.taskId) ?? null)
        : null;

    if (snapshot.tasks.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <p className="text-muted-foreground">
                    {t('Add the first task')}
                </p>
                {me.canEditTasks && game.endedAt === null && (
                    <Button onClick={() => setAdding(true)}>
                        {t('Add task')}
                    </Button>
                )}
                <TaskFormDialog
                    task={null}
                    open={adding}
                    onOpenChange={setAdding}
                />
            </div>
        );
    }

    return (
        <>
            {current && currentTask ? (
                <>
                    <PlayersGrid />
                    <FacilitatorToolbar />
                    {current.round.revealedAt !== null && (
                        <ResultPanel round={current.round} />
                    )}
                    <TaskDetail task={currentTask} />
                </>
            ) : (
                <p className="flex flex-1 items-center justify-center text-center text-muted-foreground">
                    {me.isFacilitator
                        ? t('Pick a task to start voting')
                        : t('Waiting for the facilitator to pick a task')}
                </p>
            )}
            <Hand />
        </>
    );
}
