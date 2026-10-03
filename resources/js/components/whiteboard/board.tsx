import { Head, usePage } from '@inertiajs/react';
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { toast } from 'sonner';
import { useHideMyCursor } from '@/components/session/cursor-preference';
import { SessionShell } from '@/components/session/session-shell';
import { useCanvasSnapshot } from '@/hooks/use-canvas-snapshot';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import { useWhiteboard } from '@/hooks/use-whiteboard';
import { useWhiteboardCursors } from '@/hooks/use-whiteboard-cursors';
import { useWhiteboardFollow } from '@/hooks/use-whiteboard-follow';
import { realtimeState } from '@/lib/realtime/realtime-state';
import {
    CanvasLocales,
    isDark,
    subscribeToTheme,
} from '@/lib/whiteboard/appearance';
import { strokeForTool } from '@/lib/whiteboard/canvas-colors';
import { runCanvasCommand } from '@/lib/whiteboard/canvas-commands';
import {
    CaptureUpdateAction,
    CanvasSearchSidebar,
    Excalidraw,
    HiddenSaveToDiskAction,
    MainMenu,
    closeTextEditor,
    type ExcalidrawImperativeAPI,
} from '@/lib/whiteboard/excalidraw';
import {
    CANVAS_LIGHT,
    DEFAULT_POSTIT_COLOR,
    DEFAULT_STROKE,
    POSTIT,
} from '@/lib/whiteboard/palette';
import { restoreScene } from '@/lib/whiteboard/restore';
import { sceneStamp } from '@/lib/whiteboard/scene-stamp';
import { createSceneSync, type SceneSync } from '@/lib/whiteboard/scene-sync';
import type {
    RejectReason,
    SceneElement,
    WhiteboardSnapshot,
} from '@/lib/whiteboard/types';
import { BoardChrome } from './board-chrome';
import { BoardFacilitation } from './board-facilitation';
import { BoardGone } from './board-gone';
import type { BoardCanvasActions } from './board-menu';
import {
    BoardActions,
    BoardPresence,
    BoardTitle,
    boardSelf,
    useFacilitationInHeader,
} from './board-header';
import { BoardNotices } from './board-notices';
import { BoardReactions } from './board-reactions';
import { BoardTimer } from './board-timer';
import { SceneExport } from './scene-export';
import { canSwitchReadMode, isViewMode, useReadMode } from './use-read-mode';

const PollMs = 5000;

/**
 * Local to this browser, never synced: the paper is the light value of the
 * canvas token (the library inverts it in the dark theme) and a new shape is
 * a Sun note. The stroke is left to `strokeForTool`.
 */
const InitialAppState = {
    viewBackgroundColor: CANVAS_LIGHT,
    currentItemBackgroundColor: POSTIT[DEFAULT_POSTIT_COLOR].bg,
    currentItemFillStyle: 'solid',
    currentItemRoughness: 1,
} as const;

export default function Board({ snapshot }: { snapshot: WhiteboardSnapshot }) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const state = useWhiteboard(snapshot);
    const { board, me } = state.snapshot;
    const viewOnly = board.locked && !me.isFacilitator;
    const isPhone = useIsMobile();
    const { reading, setReading } = useReadMode(isPhone);
    const viewMode = isViewMode(viewOnly, reading);
    const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
    const [offline, setOffline] = useState(false);
    const [hideMyCursor, setHideMyCursor] = useHideMyCursor();
    const facilitationInHeader = useFacilitationInHeader();
    const sync = useRef<SceneSync | null>(null);
    const appliedStroke = useRef<string>(DEFAULT_STROKE);
    const canvasSnapshot = useCanvasSnapshot(api);
    const initial = useRef(snapshot);
    const [initialElements] = useState(() =>
        restoreScene(initial.current.elements),
    );
    const [initialStamp] = useState(() => sceneStamp(initialElements));
    const root = useRef<HTMLDivElement | null>(null);
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
    const background = canvasSnapshot?.appState.viewBackgroundColor ?? null;
    const canvasActions = useMemo<BoardCanvasActions | undefined>(() => {
        if (!api || background === null) {
            return undefined;
        }

        return {
            saveAsImage: () =>
                api.updateScene({
                    appState: { openDialog: { name: 'imageExport' } },
                }),
            findOnCanvas: () => api.toggleSidebar(CanvasSearchSidebar),
            canvasHelp: () =>
                api.updateScene({ appState: { openDialog: { name: 'help' } } }),
            clearCanvas: () => runCanvasCommand(root.current, 'clearCanvas'),
            editing: !viewMode,
            background,
            setBackground: (color) =>
                api.updateScene({
                    appState: { viewBackgroundColor: color },
                    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
                }),
        };
    }, [api, background, viewMode]);

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
        if (!api || !viewMode) {
            return;
        }

        // Outside React's commit: closing the editor flushes canvas state.
        queueMicrotask(() => {
            closeTextEditor();
            api.updateScene({ appState: { selectedElementIds: {} } });
        });
    }, [api, viewMode]);

    useEffect(() => {
        if (state.connected || state.status !== 'active') {
            return;
        }

        const poll = setInterval(() => void sync.current?.resync(), PollMs);

        return () => clearInterval(poll);
    }, [state.connected, state.status]);

    if (state.status !== 'active') {
        return (
            <>
                <Head title={board.title} />
                <BoardGone
                    title={board.title}
                    reason={state.status}
                    teamUrl={state.snapshot.links.team}
                />
            </>
        );
    }

    return (
        <SessionShell
            kind="whiteboard"
            chrome="logo"
            homeHref={state.snapshot.links.team}
            self={boardSelf(state.snapshot)}
            title={<BoardTitle state={state} />}
            timer={!me.isFacilitator && <BoardTimer state={state} />}
            presence={<BoardPresence state={state} />}
            actions={
                <BoardActions
                    state={state}
                    onExport={
                        api
                            ? () =>
                                  api.updateScene({
                                      appState: {
                                          openDialog: { name: 'jsonExport' },
                                      },
                                  })
                            : undefined
                    }
                    canvasActions={canvasActions}
                    hideMyCursor={hideMyCursor}
                    onHideMyCursorChange={setHideMyCursor}
                />
            }
            realtime={realtimeState(
                state.connected && api !== null,
                state.online,
            )}
            connection={{
                reconnecting: state.reconnecting || offline,
                expired: state.sessionExpired,
            }}
            rootRef={root}
            rootProps={{ 'data-scene': initialStamp }}
        >
            <div className="flex h-full min-h-0 flex-col">
                <Head title={board.title} />
                {me.isFacilitator && !facilitationInHeader && (
                    <div className="flex shrink-0 justify-center border-b bg-background p-1.5">
                        <BoardFacilitation state={state} compact />
                    </div>
                )}
                <BoardNotices
                    locked={viewOnly}
                    leading={board.followEnabled && me.isFacilitator}
                    following={follow.following}
                    paused={follow.paused}
                    onResume={follow.resume}
                />
                <BoardChrome
                    api={api}
                    snapshot={canvasSnapshot}
                    editing={!viewMode}
                    isPhone={isPhone}
                    isFacilitator={me.isFacilitator}
                    readMode={
                        canSwitchReadMode(isPhone, viewOnly)
                            ? { reading, onChange: setReading }
                            : undefined
                    }
                >
                    <Excalidraw
                        viewModeEnabled={viewMode ? true : undefined}
                        excalidrawAPI={setApi}
                        initialData={{
                            elements: initialElements as never,
                            appState: InitialAppState,
                        }}
                        name={board.title}
                        onChange={(elements, appState) => {
                            const reported =
                                elements as unknown as SceneElement[];

                            root.current?.setAttribute(
                                'data-scene',
                                sceneStamp(reported),
                            );
                            sync.current?.handleChange(
                                reported,
                                appState.editingTextElement?.id ?? null,
                            );

                            const stroke = strokeForTool(
                                appState,
                                appliedStroke.current,
                            );

                            if (stroke !== null) {
                                appliedStroke.current = stroke;

                                // Outside the library's own update, which reports this change.
                                queueMicrotask(() =>
                                    api?.updateScene({
                                        appState: {
                                            currentItemStrokeColor: stroke,
                                        },
                                        captureUpdate:
                                            CaptureUpdateAction.NEVER,
                                    }),
                                );
                            }
                        }}
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
                </BoardChrome>
                <BoardReactions state={state} />
            </div>
        </SessionShell>
    );
}
