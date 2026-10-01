import { usePage } from '@inertiajs/react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { ConnectionBanner } from '@/components/retro/connection-banner';
import { SessionExpiredBanner } from '@/components/retro/session-expired-banner';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { useTrans } from '@/hooks/use-trans';
import { useWhiteboard } from '@/hooks/use-whiteboard';
import { useWhiteboardCursors } from '@/hooks/use-whiteboard-cursors';
import { useWhiteboardToolbarSlot } from '@/hooks/use-whiteboard-toolbar-slot';
import {
    Excalidraw,
    MainMenu,
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
import { StickyTool } from './sticky-tool';
import { TopBar } from './top-bar';

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
        enabled: state.snapshot.board.cursorsEnabled,
        hidden: hideMyCursor,
    });
    const forgetCursor = useRef(cursors.forget);

    forgetCursor.current = cursors.forget;
    const dark = useSyncExternalStore(subscribeToTheme, isDark, () => false);
    const boardId = snapshot.board.id;
    const { fail, listeners } = state;

    const rejectionMessages = useRef<Record<RejectReason, string>>({
        invalid: '',
        stale: '',
        locked: '',
        file: '',
        full: '',
    });

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
    }, [api, boardId, fail, listeners]);

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
                    {api && !toolbarSlot && <StickyTool api={api} />}
                    <BoardMenu
                        state={state}
                        hideMyCursor={hideMyCursor}
                        onHideMyCursorChange={setHideMyCursor}
                    />
                </TopBar>
                <ConnectionBanner
                    reconnecting={state.reconnecting || offline}
                />
                {api &&
                    toolbarSlot &&
                    createPortal(
                        <StickyTool api={api} inToolbar />,
                        toolbarSlot,
                    )}
                <div ref={canvas} className="min-h-0 flex-1">
                    <Excalidraw
                        excalidrawAPI={setApi}
                        initialData={{ elements: initialElements as never }}
                        onChange={(elements) =>
                            sync.current?.handleChange(
                                elements as unknown as SceneElement[],
                            )
                        }
                        onPointerUpdate={cursors.onPointerUpdate}
                        langCode={ExcalidrawLocales[locale as string] ?? 'en'}
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
                </div>
            </div>
        </div>
    );
}
