import { Head, usePage } from '@inertiajs/react';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import type { RefObject } from 'react';
import { toast } from 'sonner';
import { useHideMyCursor } from '@/components/session/cursor-preference';
import { SessionShell } from '@/components/session/session-shell';
import {
    SecondaryControlsFrom,
    useIsNarrowerThan,
} from '@/hooks/use-is-narrower-than';
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
import {
    finishDrawing,
    runCanvasCommand,
} from '@/lib/whiteboard/canvas-commands';
import { droppedDrawing } from '@/lib/whiteboard/dropped-drawing';
import {
    CaptureUpdateAction,
    CanvasSearchInput,
    CanvasSearchSidebar,
    Excalidraw,
    HiddenSaveToDiskAction,
    MainMenu,
    closeTextEditor,
    type ExcalidrawImperativeAPI,
} from '@/lib/whiteboard/excalidraw';
import { lockedElements, unlockElements } from '@/lib/whiteboard/locked';
import type { LockableElement } from '@/lib/whiteboard/locked';
import {
    CANVAS_LIGHT,
    DEFAULT_POSTIT_COLOR,
    DEFAULT_STROKE,
    POSTIT,
    opaqueBackground,
    seeThroughBackground,
} from '@/lib/whiteboard/palette';
import { restoreScene } from '@/lib/whiteboard/restore';
import type { BoardScene } from '@/lib/whiteboard/save-file';
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
} from './board-header';
import { BoardNotices } from './board-notices';
import { BoardReactions } from './board-reactions';
import { BoardTimer } from './board-timer';
import { ExportDialog } from './export-dialog';
import { isLockedForViewer, isObserving, useReadMode } from './use-read-mode';

const PollMs = 5000;

/**
 * Width of the window, in rem, from which the facilitator's pill names its
 * controls; below it they are icons. The board spans the window. With a
 * running timer a named pill is up to 42rem wide: from here it stays in the
 * right half of the board and clear of the Styles panel at its left.
 */
const PillWordsFrom = 64;

/**
 * Local to this browser, never synced: the paper is the light value of the
 * canvas token (the library inverts it in the dark theme), see-through over
 * the board's dot grid, and a new shape is a Sun note. The stroke is left to
 * `strokeForTool`.
 */
const InitialAppState = {
    viewBackgroundColor: seeThroughBackground(CANVAS_LIGHT),
    currentItemBackgroundColor: POSTIT[DEFAULT_POSTIT_COLOR].bg,
    currentItemFillStyle: 'solid',
    currentItemRoughness: 1,
} as const;

/**
 * The ways out of drawing the board offers itself end the connector being
 * drawn, as a tool change does: a dialog of the board that takes the focus
 * (Share, the templates, a confirmation), the lock of the board, and view
 * mode, which the canvas takes one render late so that the library still
 * answers when the connector is ended. Returns the view mode of the canvas.
 */
function useFinishedDrawingOnLeave(
    api: ExcalidrawImperativeAPI | null,
    root: RefObject<HTMLElement | null>,
    viewMode: boolean,
    locked: boolean,
): boolean {
    const [canvasViewMode, setCanvasViewMode] = useState(viewMode);

    useEffect(() => {
        if (api !== null && (viewMode || locked)) {
            finishDrawing(api, root.current);
        }

        setCanvasViewMode(viewMode);
    }, [api, root, viewMode, locked]);

    useEffect(() => {
        if (api === null) {
            return;
        }

        const onFocusIn = (event: FocusEvent): void => {
            if (
                event.target instanceof Element &&
                event.target.closest('[role="dialog"]') !== null
            ) {
                finishDrawing(api, root.current);
            }
        };

        document.addEventListener('focusin', onFocusIn);

        return () => document.removeEventListener('focusin', onFocusIn);
    }, [api, root]);

    return canvasViewMode;
}

export default function Board({ snapshot }: { snapshot: WhiteboardSnapshot }) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const state = useWhiteboard(snapshot);
    const { board, me } = state.snapshot;
    const viewOnly = isLockedForViewer(state.snapshot);
    const observing = isObserving(state.snapshot);
    const isPhone = useIsMobile();
    const { reading, setReading } = useReadMode(isPhone);
    const viewMode = viewOnly || reading;
    const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
    const [offline, setOffline] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [hideMyCursor, setHideMyCursor] = useHideMyCursor();
    const hasFoldedControls = useIsNarrowerThan(SecondaryControlsFrom);
    const hasCompactPill = useIsNarrowerThan(PillWordsFrom);
    const sync = useRef<SceneSync | null>(null);
    const appliedStroke = useRef<string>(DEFAULT_STROKE);
    const drawing = useRef<SceneElement | null>(null);
    const [background, setBackground] = useState<string | null>(null);
    const [lockedCount, setLockedCount] = useState(0);
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
    const canvasActions = useMemo<BoardCanvasActions | undefined>(() => {
        if (!api || background === null) {
            return undefined;
        }

        return {
            findOnCanvas: () => {
                api.toggleSidebar(CanvasSearchSidebar);
                window.setTimeout(() =>
                    root.current
                        ?.querySelector<HTMLInputElement>(CanvasSearchInput)
                        ?.focus(),
                );
            },
            canvasHelp: () =>
                api.updateScene({ appState: { openDialog: { name: 'help' } } }),
            clearCanvas: () => runCanvasCommand(root.current, 'clearCanvas'),
            editing: !viewMode,
            background,
            setBackground: (color) =>
                api.updateScene({
                    appState: {
                        viewBackgroundColor: seeThroughBackground(color),
                    },
                    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
                }),
            lockedCount,
            unlockAll: () =>
                unlockElements(
                    api,
                    lockedElements(
                        api.getSceneElements() as unknown as LockableElement[],
                    ).map((element) => element.id),
                ),
        };
    }, [api, background, viewMode, lockedCount]);

    const openExport = useCallback(() => {
        if (api) {
            finishDrawing(api, root.current);
        }

        setExporting(true);
    }, [api]);
    /** The canvas is see-through over the dot grid: what leaves the board takes the paper's opaque colour. */
    const exportedScene = useCallback((): BoardScene => {
        if (!api) {
            return { elements: [], appState: {}, files: {} };
        }

        const appState = api.getAppState();

        return {
            elements: api.getSceneElements(),
            appState: {
                ...appState,
                viewBackgroundColor: opaqueBackground(
                    appState.viewBackgroundColor,
                ),
            },
            files: api.getFiles(),
        };
    }, [api]);

    forgetCursor.current = cursors.forget;
    const canvasViewMode = useFinishedDrawingOnLeave(
        api,
        root,
        viewMode,
        board.locked,
    );
    const dark = useSyncExternalStore(subscribeToTheme, isDark, () => false);
    const boardId = snapshot.board.id;
    const { fail, listeners, refetch } = state;

    const currentRejectionMessages: Record<RejectReason, string> = {
        invalid: t('This element could not be saved.'),
        stale: '',
        locked: t('Only the facilitator can change a locked element.'),
        file: t('This image could not be added.'),
        full: t('This board is full.'),
    };
    const rejectionMessages = useRef(currentRejectionMessages);
    const lockedMessage = useRef('');

    lockedMessage.current = t('This board is locked.');
    rejectionMessages.current = currentRejectionMessages;

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
            observing={observing}
            chrome="logo"
            homeHref={state.snapshot.links.team}
            self={boardSelf(state.snapshot, state.online)}
            shortcutsInMenu={hasFoldedControls}
            title={<BoardTitle state={state} />}
            timer={!me.isFacilitator && <BoardTimer state={state} />}
            presence={<BoardPresence state={state} />}
            actions={
                <BoardActions
                    state={state}
                    onExport={api ? openExport : undefined}
                    canvasActions={canvasActions}
                    hideMyCursor={hideMyCursor}
                    onHideMyCursorChange={setHideMyCursor}
                    folded={hasFoldedControls}
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
                <BoardNotices
                    locked={board.locked && !me.isFacilitator}
                    leading={board.followEnabled && me.isFacilitator}
                    following={follow.following}
                    paused={follow.paused}
                    onResume={follow.resume}
                />
                <BoardChrome
                    api={api}
                    editing={!viewMode}
                    isPhone={isPhone}
                    isFacilitator={me.isFacilitator}
                    readMode={
                        isPhone && !viewOnly
                            ? { reading, onChange: setReading }
                            : undefined
                    }
                    onBackgroundChange={setBackground}
                    onLockedCountChange={setLockedCount}
                    onExport={openExport}
                    facilitation={
                        <BoardFacilitation
                            state={state}
                            compact={hasCompactPill}
                        />
                    }
                >
                    <Excalidraw
                        viewModeEnabled={canvasViewMode ? true : undefined}
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

                            const drawn = (appState.newElement ??
                                appState.multiElement) as unknown as SceneElement | null;
                            const dropped = droppedDrawing(
                                drawing.current,
                                drawn,
                                reported,
                            );

                            drawing.current = drawn;

                            if (dropped !== null) {
                                // Outside the library's own update, which reports this change.
                                queueMicrotask(() =>
                                    api?.updateScene({
                                        elements: [
                                            ...api.getSceneElementsIncludingDeleted(),
                                            dropped,
                                        ] as never,
                                        captureUpdate:
                                            CaptureUpdateAction.NEVER,
                                    }),
                                );
                            }

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
                                export: false,
                                saveAsImage: false,
                            },
                        }}
                    >
                        {/* The default menu ends with links to the library's own sites. */}
                        <MainMenu>
                            <MainMenu.DefaultItems.SearchMenu />
                            <MainMenu.DefaultItems.Help />
                            <MainMenu.DefaultItems.ClearCanvas />
                            <MainMenu.Separator />
                            <MainMenu.DefaultItems.ChangeCanvasBackground />
                        </MainMenu>
                    </Excalidraw>
                </BoardChrome>
                <BoardReactions state={state} />
                <ExportDialog
                    open={exporting}
                    onOpenChange={setExporting}
                    title={board.title}
                    getScene={exportedScene}
                    hasSelection={
                        exporting &&
                        api !== null &&
                        Object.keys(api.getAppState().selectedElementIds)
                            .length > 0
                    }
                />
            </div>
        </SessionShell>
    );
}
