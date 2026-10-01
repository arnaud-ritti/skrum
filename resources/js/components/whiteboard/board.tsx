import { usePage } from '@inertiajs/react';
import { History, Lock } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { ConnectionBanner } from '@/components/retro/connection-banner';
import { SessionExpiredBanner } from '@/components/retro/session-expired-banner';
import { TimerDisplay } from '@/components/retro/timer-display';
import { Button } from '@/components/ui/button';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { useTrans } from '@/hooks/use-trans';
import { useWhiteboard } from '@/hooks/use-whiteboard';
import { useWhiteboardCursors } from '@/hooks/use-whiteboard-cursors';
import { useWhiteboardFollow } from '@/hooks/use-whiteboard-follow';
import { useWhiteboardToolbarSlot } from '@/hooks/use-whiteboard-toolbar-slot';
import {
    CanvasLocales,
    isDark,
    subscribeToTheme,
} from '@/lib/whiteboard/appearance';
import {
    Excalidraw,
    HiddenSaveToDiskAction,
    MainMenu,
    closeTextEditor,
    type ExcalidrawImperativeAPI,
} from '@/lib/whiteboard/excalidraw';
import { restoreScene } from '@/lib/whiteboard/restore';
import { createSceneSync, type SceneSync } from '@/lib/whiteboard/scene-sync';
import type {
    RejectReason,
    SceneElement,
    WhiteboardSnapshot,
} from '@/lib/whiteboard/types';
import { BoardGone } from './board-gone';
import { BoardMenu } from './board-menu';
import { BoardReactions } from './board-reactions';
import { SceneExport } from './scene-export';
import { FacilitatorBar } from './facilitator-bar';
import { HistoryPanel } from './history-panel';
import { StatusBar } from './status-bar';
import { StickyTool } from './sticky-tool';
import { TopBar } from './top-bar';

const HideMyCursorKey = 'skrum.hideMyCursor';
const PollMs = 5000;

export default function Board({ snapshot }: { snapshot: WhiteboardSnapshot }) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const state = useWhiteboard(snapshot);
    const { board, me } = state.snapshot;
    const viewOnly = board.locked && !me.isFacilitator;
    const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
    const [offline, setOffline] = useState(false);
    const [hideMyCursor, setHideMyCursor] = useLocalPreference(
        HideMyCursorKey,
        false,
    );
    const [historyOpen, setHistoryOpen] = useState(false);
    const sync = useRef<SceneSync | null>(null);
    const canvas = useRef<HTMLDivElement | null>(null);
    const toolbarSlot = useWhiteboardToolbarSlot(canvas, api !== null);
    const initial = useRef(snapshot);
    const [initialElements] = useState(() =>
        restoreScene(initial.current.elements),
    );
    const cursors = useWhiteboardCursors({
        api,
        presence: state.presence,
        online: state.online,
        meId: state.snapshot.me.id,
        enabled: board.cursorsEnabled,
        hidden: hideMyCursor,
    });
    const follow = useWhiteboardFollow({
        api,
        presence: state.presence,
        enabled: board.followEnabled,
        leading: me.isFacilitator,
        facilitatorId: board.facilitatorMemberId,
    });
    const forgetCursor = useRef(cursors.forget);

    forgetCursor.current = cursors.forget;
    const dark = useSyncExternalStore(subscribeToTheme, isDark, () => false);
    const boardId = snapshot.board.id;
    const { fail, listeners, refetch } = state;

    const rejectionMessages = useRef<Record<RejectReason, string>>({
        invalid: '',
        stale: '',
        locked: '',
        file: '',
        full: '',
    });
    const lockedMessage = useRef('');

    lockedMessage.current = t('This board is locked.');

    rejectionMessages.current = {
        invalid: t('This element could not be saved.'),
        stale: '',
        locked: t('Only the facilitator can change a locked element.'),
        file: t('This image could not be added.'),
        full: t('This board is full.'),
    };

    useEffect(() => {
        if (!api) {
            return;
        }

        const created = createSceneSync({
            boardId,
            api,
            initial: initial.current,
            onFatal: fail,
            onRejected: (reason) =>
                toast.error(rejectionMessages.current[reason], { id: reason }),
            onOffline: setOffline,
            onLocked: () => {
                toast.error(lockedMessage.current, { id: 'locked' });
                // The lock may have been missed with its board.changed.
                void refetch();
            },
        });

        sync.current = created;
        listeners.current = {
            onElementsChanged: (payload) => created.handleRemote(payload),
            onResync: () => void created.resync(),
            onLeaving: (member) => forgetCursor.current(member.id),
        };
        // Events that came in before the canvas was ready had no listener.
        void created.resync();

        return () => {
            created.dispose();
            sync.current = null;
            listeners.current = null;
        };
    }, [api, boardId, fail, listeners, refetch]);

    useEffect(() => {
        if (!api || !viewOnly) {
            return;
        }

        // Outside React's commit: closing the editor flushes canvas state.
        queueMicrotask(() => {
            closeTextEditor();
            api.updateScene({ appState: { selectedElementIds: {} } });
        });
    }, [api, viewOnly]);

    useEffect(() => {
        if (state.connected || state.status !== 'active') {
            return;
        }

        const poll = setInterval(() => void sync.current?.resync(), PollMs);

        return () => clearInterval(poll);
    }, [state.connected, state.status]);

    if (state.status !== 'active') {
        return (
            <BoardGone
                reason={state.status}
                teamUrl={state.snapshot.links.team}
            />
        );
    }

    return (
        <div className="flex h-dvh flex-col">
            {state.sessionExpired && <SessionExpiredBanner />}
            <div
                className="flex min-h-0 flex-1 flex-col"
                inert={state.sessionExpired}
            >
                <TopBar state={state}>
                    <TimerDisplay
                        endsAt={board.timerEndsAt}
                        offset={state.serverOffset}
                    />
                    {me.isFacilitator && <FacilitatorBar state={state} />}
                    {api && !toolbarSlot && !viewOnly && (
                        <StickyTool api={api} />
                    )}
                    {!me.isGuest && (
                        <Button
                            size="icon"
                            variant="outline"
                            aria-label={t('Version history')}
                            title={t('Version history')}
                            onClick={() => setHistoryOpen(true)}
                        >
                            <History className="size-4" />
                        </Button>
                    )}
                    <BoardMenu
                        state={state}
                        hideMyCursor={hideMyCursor}
                        onHideMyCursorChange={setHideMyCursor}
                    />
                </TopBar>
                <ConnectionBanner
                    reconnecting={state.reconnecting || offline}
                />
                <StatusBar>
                    {viewOnly && (
                        <span className="flex items-center gap-1.5">
                            <Lock className="size-4" aria-hidden="true" />
                            {t('This board is locked.')}
                        </span>
                    )}
                    {board.followEnabled && me.isFacilitator && (
                        <span>{t('Everyone follows your view.')}</span>
                    )}
                    {follow.following && !follow.paused && (
                        <span>{t('Following the facilitator')}</span>
                    )}
                    {follow.paused && (
                        <span className="flex items-center gap-2">
                            {t('Following paused')}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={follow.resume}
                            >
                                {t('Resume')}
                            </Button>
                        </span>
                    )}
                </StatusBar>
                {api &&
                    toolbarSlot &&
                    createPortal(
                        <StickyTool api={api} inToolbar />,
                        toolbarSlot,
                    )}
                <div
                    ref={canvas}
                    className="whiteboard-canvas relative min-h-0 flex-1"
                    data-facilitator={me.isFacilitator}
                >
                    <Excalidraw
                        viewModeEnabled={viewOnly ? true : undefined}
                        excalidrawAPI={setApi}
                        initialData={{ elements: initialElements as never }}
                        name={board.title}
                        onChange={(elements, appState) =>
                            sync.current?.handleChange(
                                elements as unknown as SceneElement[],
                                appState.editingTextElement?.id ?? null,
                            )
                        }
                        onPointerUpdate={cursors.onPointerUpdate}
                        langCode={CanvasLocales[locale as string] ?? 'en'}
                        theme={dark ? 'dark' : 'light'}
                        aiEnabled={false}
                        UIOptions={{
                            canvasActions: {
                                loadScene: false,
                                saveToActiveFile: false,
                                toggleTheme: false,
                                ...HiddenSaveToDiskAction,
                                export: {
                                    saveFileToDisk: false,
                                    renderCustomUI: (
                                        exportedElements,
                                        exportedAppState,
                                        exportedFiles,
                                    ) => (
                                        <SceneExport
                                            title={board.title}
                                            elements={exportedElements}
                                            appState={exportedAppState}
                                            files={exportedFiles}
                                        />
                                    ),
                                },
                            },
                        }}
                    >
                        {/* The default menu ends with links to the library's own sites. */}
                        <MainMenu>
                            <MainMenu.DefaultItems.Export />
                            <MainMenu.DefaultItems.SaveAsImage />
                            <MainMenu.DefaultItems.SearchMenu />
                            <MainMenu.DefaultItems.Help />
                            <MainMenu.DefaultItems.ClearCanvas />
                            <MainMenu.Separator />
                            <MainMenu.DefaultItems.ChangeCanvasBackground />
                        </MainMenu>
                    </Excalidraw>
                </div>
                <BoardReactions state={state} />
                {!me.isGuest && (
                    <HistoryPanel
                        state={state}
                        open={historyOpen}
                        onOpenChange={setHistoryOpen}
                        onRestored={() => {
                            void sync.current?.resync();
                            void state.refetch();
                        }}
                    />
                )}
            </div>
        </div>
    );
}
