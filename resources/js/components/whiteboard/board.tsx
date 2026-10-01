import { usePage } from '@inertiajs/react';
import { EyeOff, Lock } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import WhiteboardVotesController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVotesController';
import { ConnectionBanner } from '@/components/retro/connection-banner';
import { SessionExpiredBanner } from '@/components/retro/session-expired-banner';
import { TimerDisplay } from '@/components/retro/timer-display';
import { Button } from '@/components/ui/button';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { useTrans } from '@/hooks/use-trans';
import { useWhiteboard } from '@/hooks/use-whiteboard';
import { useWhiteboardCursors } from '@/hooks/use-whiteboard-cursors';
import { useWhiteboardFollow } from '@/hooks/use-whiteboard-follow';
import { useWhiteboardRequest } from '@/hooks/use-whiteboard-request';
import { useWhiteboardToolbarSlot } from '@/hooks/use-whiteboard-toolbar-slot';
import { retroRequest } from '@/lib/retro/api';
import {
    Excalidraw,
    MainMenu,
    closeTextEditor,
    type ExcalidrawImperativeAPI,
} from '@/lib/whiteboard/excalidraw';
import { restoreScene } from '@/lib/whiteboard/restore';
import { createSceneSync, type SceneSync } from '@/lib/whiteboard/scene-sync';
import type {
    RejectReason,
    SceneElement,
    VoteTally,
    WhiteboardSnapshot,
} from '@/lib/whiteboard/types';
import { BoardGone } from './board-gone';
import { BoardMenu } from './board-menu';
import { BoardReactions } from './board-reactions';
import { FacilitatorBar } from './facilitator-bar';
import { MaskedNotes } from './masked-notes';
import { ResultsPanel } from './results-panel';
import { StatusBar } from './status-bar';
import { StickyTool } from './sticky-tool';
import { TopBar } from './top-bar';
import { VoteOverlay } from './vote-overlay';

const HideMyCursorKey = 'skrum.hideMyCursor';
const PollMs = 5000;

const ExcalidrawLocales: Record<string, string> = {
    en: 'en',
    fr: 'fr-FR',
    de: 'de-DE',
    es: 'es-ES',
};

function subscribeToTheme(onChange: () => void) {
    const observer = new MutationObserver(onChange);

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
    });

    return () => observer.disconnect();
}

const isDark = () => document.documentElement.classList.contains('dark');

export default function Board({ snapshot }: { snapshot: WhiteboardSnapshot }) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const state = useWhiteboard(snapshot);
    const request = useWhiteboardRequest();
    const { board, me, voting } = state.snapshot;
    const viewOnly = board.locked && !me.isFacilitator;
    const votingOpen = voting?.open ?? false;
    /** A person's own choice; null follows the vote (open once it closes). */
    const [panel, setPanel] = useState<{
        votingId: string | null;
        open: boolean;
    } | null>(null);
    const showsPanel =
        panel !== null && panel.votingId === (voting?.id ?? null)
            ? panel.open
            : voting !== null && !voting.open;
    const choosePanel = (open: boolean) =>
        setPanel({ votingId: voting?.id ?? null, open });
    const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
    const [offline, setOffline] = useState(false);
    const [hideMyCursor, setHideMyCursor] = useLocalPreference(
        HideMyCursorKey,
        false,
    );
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
        // A named pointer over a note would disclose a vote (spec §11.4).
        enabled: board.cursorsEnabled && !votingOpen,
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
        voting: '',
        private: '',
    });
    const lockedMessage = useRef('');

    lockedMessage.current = t('This board is locked.');

    rejectionMessages.current = {
        invalid: t('This element could not be saved.'),
        stale: '',
        locked: t('Only the facilitator can change a locked element.'),
        file: t('This image could not be added.'),
        full: t('This board is full.'),
        voting: t('Notes cannot be edited while a vote is open.'),
        private: t('Only its author can change a hidden note.'),
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
            onRejected: (reason, elementId) => {
                const editing = api.getAppState().editingTextElement;

                // Typing into someone's hidden note: the editor would keep
                // writing a text the server refuses at every key. A refusal
                // about any other element leaves the editor alone: the
                // member may be typing their own note.
                if (
                    reason === 'private' &&
                    editing &&
                    elementId !== null &&
                    (editing.id === elementId ||
                        ('containerId' in editing &&
                            editing.containerId === elementId))
                ) {
                    queueMicrotask(closeTextEditor);
                }

                toast.error(rejectionMessages.current[reason], { id: reason });
            },
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

    const privateWriting = board.privateWriting;

    // The reveal reaches the other tabs as an `elements.changed` without
    // elements; the tab that asked for it, and a tab that missed the event,
    // learn it from the snapshot and fetch the notes here.
    useEffect(() => {
        void sync.current?.resync();
    }, [privateWriting]);

    const vote = async (elementId: string, count: number) => {
        if (!voting) {
            return;
        }

        const tally = await request(
            retroRequest<VoteTally>(
                WhiteboardVotesController.update({
                    board: board.id,
                    voteSession: voting.id,
                    elementId,
                }),
                { count },
            ),
        );

        if (tally === undefined) {
            void state.refetch();

            return;
        }

        state.applyTally(voting.id, tally);
    };

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
                    {me.isFacilitator && (
                        <FacilitatorBar state={state} api={api} />
                    )}
                    {api && !toolbarSlot && !viewOnly && (
                        <StickyTool api={api} />
                    )}
                    <BoardMenu
                        state={state}
                        hideMyCursor={hideMyCursor}
                        onHideMyCursorChange={setHideMyCursor}
                        onShowResults={() => choosePanel(true)}
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
                    {privateWriting && (
                        <span className="flex flex-wrap items-center gap-x-2">
                            <EyeOff className="size-4" aria-hidden="true" />
                            {t(
                                'Notes are hidden until the facilitator reveals them. Other elements stay visible.',
                            )}
                            <span className="text-xs text-muted-foreground">
                                {t(
                                    'The size of a note hints at the length of its text.',
                                )}
                            </span>
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
                    {voting?.open && (
                        <span>
                            {t('Votes left: :count', {
                                count: voting.remaining,
                            })}
                            {' · '}
                            {t(':count of :total finished voting', {
                                count: voting.finishedCount ?? 0,
                                total: state.online.length,
                            })}
                            {board.cursorsEnabled &&
                                ` · ${t('Cursors are hidden while the vote is open.')}`}
                        </span>
                    )}
                    {voting && !voting.open && !showsPanel && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => choosePanel(true)}
                        >
                            {t('Vote results')}
                        </Button>
                    )}
                </StatusBar>
                {api &&
                    toolbarSlot &&
                    createPortal(
                        <StickyTool api={api} inToolbar />,
                        toolbarSlot,
                    )}
                <div
                    className="whiteboard-canvas relative flex min-h-0 flex-1"
                    data-facilitator={me.isFacilitator}
                >
                    <div
                        ref={canvas}
                        className="relative min-h-0 min-w-0 flex-1"
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
                            langCode={
                                ExcalidrawLocales[locale as string] ?? 'en'
                            }
                            theme={dark ? 'dark' : 'light'}
                            aiEnabled={false}
                            UIOptions={{
                                canvasActions: {
                                    loadScene: false,
                                    saveToActiveFile: false,
                                    toggleTheme: false,
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
                        {api && privateWriting && <MaskedNotes api={api} />}
                        {api && voting && (
                            <VoteOverlay
                                api={api}
                                voting={voting}
                                onVote={(elementId, count) =>
                                    void vote(elementId, count)
                                }
                            />
                        )}
                    </div>
                    {api && showsPanel && (
                        <ResultsPanel
                            state={state}
                            api={api}
                            onClose={() => choosePanel(false)}
                        />
                    )}
                </div>
                <BoardReactions state={state} />
            </div>
        </div>
    );
}
