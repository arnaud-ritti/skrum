import { Head, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useHideMyCursor } from '@/components/session/cursor-preference';
import { SessionShell } from '@/components/session/session-shell';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import { useWhiteboard } from '@/hooks/use-whiteboard';
import { useWhiteboardCursors } from '@/hooks/use-whiteboard-cursors';
import { useWhiteboardFollow } from '@/hooks/use-whiteboard-follow';
import { useWhiteboardToolbarSlot } from '@/hooks/use-whiteboard-toolbar-slot';
import { realtimeState } from '@/lib/realtime/realtime-state';
import {
    CanvasLocales,
    isDark,
    subscribeToTheme,
} from '@/lib/whiteboard/appearance';
import {
    HiddenColorBar,
    colorBarState,
    strokeForTool,
    type ColorBarState,
} from '@/lib/whiteboard/canvas-colors';
import {
    CaptureUpdateAction,
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
import { BoardFacilitation } from './board-facilitation';
import { BoardGone } from './board-gone';
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
import { CanvasColors } from './canvas-colors';
import { ReadModeLayer } from './read-mode-toggle';
import { SceneExport } from './scene-export';
import { StickyTool } from './sticky-tool';
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
    const [colors, setColors] = useState<ColorBarState>(HiddenColorBar);
    const [stickyOpen, setStickyOpen] = useState(false);
    const [hideMyCursor, setHideMyCursor] = useHideMyCursor();
    const facilitationInHeader = useFacilitationInHeader();
    const sync = useRef<SceneSync | null>(null);
    const appliedStroke = useRef<string>(DEFAULT_STROKE);
    const canvas = useRef<HTMLDivElement | null>(null);
    const toolbarSlot = useWhiteboardToolbarSlot(canvas, api !== null);
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
            self={boardSelf(state.snapshot, state.online)}
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
                    hideMyCursor={hideMyCursor}
                    onHideMyCursorChange={setHideMyCursor}
                    sticky={
                        api &&
                        !toolbarSlot &&
                        !viewMode && (
                            <StickyTool
                                api={api}
                                onOpenChange={setStickyOpen}
                            />
                        )
                    }
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
                {api &&
                    toolbarSlot &&
                    createPortal(
                        <StickyTool
                            api={api}
                            inToolbar
                            onOpenChange={setStickyOpen}
                        />,
                        toolbarSlot,
                    )}
                <div
                    ref={canvas}
                    className="whiteboard-canvas skrum-whiteboard--fallback-colors relative min-h-0 flex-1"
                    data-facilitator={me.isFacilitator}
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

                            const bar = colorBarState(elements, appState);

                            setColors((shown) =>
                                shown.visible === bar.visible &&
                                shown.value === bar.value
                                    ? shown
                                    : bar,
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
                    {api && !viewMode && !stickyOpen && (
                        <CanvasColors api={api} state={colors} />
                    )}
                    {api && canSwitchReadMode(isPhone, viewOnly) && (
                        <ReadModeLayer
                            reading={reading}
                            onChange={setReading}
                        />
                    )}
                </div>
                <BoardReactions state={state} />
            </div>
        </SessionShell>
    );
}
