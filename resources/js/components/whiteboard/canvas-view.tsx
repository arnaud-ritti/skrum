import {
    useCallback,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import type { ReactElement, RefObject } from 'react';
import {
    WhiteboardHistoryBar,
    WhiteboardMinimap,
    WhiteboardZoomBar,
} from '@/components/skrum/whiteboard-view-controls';
import type { CanvasSnapshot } from '@/hooks/use-canvas-snapshot';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { useMinWidth } from '@/hooks/use-min-width';
import { useShortcut } from '@/hooks/use-shortcut';
import {
    nativeControlEnabled,
    pressNativeControl,
} from '@/lib/whiteboard/canvas-commands';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
import {
    fromMinimap,
    minimapFrame,
    minimapItems,
    toMinimap,
} from '@/lib/whiteboard/minimap';
import type {
    MinimapElement,
    MinimapFrame,
    MinimapItem,
} from '@/lib/whiteboard/minimap';
import {
    canZoom,
    centredOn,
    pannedBy,
    steppedZoom,
    visibleArea,
    zoomAroundCentre,
    zoomPercent,
} from '@/lib/whiteboard/viewport';
import type { CanvasView as View, ViewPatch } from '@/lib/whiteboard/viewport';

type Props = {
    api: ExcalidrawImperativeAPI;
    snapshot: CanvasSnapshot;
    /** The board's canvas wrapper: scope of the M key, and home of the library's hidden undo and redo buttons. */
    canvas: RefObject<HTMLElement | null>;
    editing: boolean;
};

/** Owner decision 6: open by default, remembered per browser. */
const MinimapPreferenceKey = 'skrum.whiteboardMinimap';

/** `lg` (64rem): the minimap would cover the canvas below it (P20-10). */
const MinimapFromPx = 1024;

/** 11.25rem × 7rem, the size of the minimap in ScreenWhiteboard. */
const MinimapSizeRem = { width: 11.25, height: 7 };

const FitZoomFactor = 0.9;

function rootFontSize(): number {
    return (
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    );
}

/** The library's view now: two presses inside one frame both see the first one's result. */
function liveView(api: ExcalidrawImperativeAPI): View {
    const state = api.getAppState();

    return {
        scrollX: state.scrollX,
        scrollY: state.scrollY,
        zoom: state.zoom.value,
        width: state.width,
        height: state.height,
    };
}

function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Every live element in the view, without animation when motion is reduced; nothing on an empty board. */
export function fitToScreen(api: ExcalidrawImperativeAPI): void {
    const elements = api.getSceneElements();

    if (elements.length === 0) {
        return;
    }

    api.scrollToContent(elements, {
        fitToViewport: true,
        viewportZoomFactor: FitZoomFactor,
        animate: !prefersReducedMotion(),
    });
}

/** The library's own undo and redo buttons know whether their history is empty; they change without a scene change. */
export function useNativeHistory(canvas: RefObject<HTMLElement | null>): {
    canUndo: boolean;
    canRedo: boolean;
} {
    const subscribe = useCallback(
        (onChange: () => void) => {
            const root = canvas.current;

            if (!root) {
                return () => {};
            }

            const observer = new MutationObserver(onChange);

            observer.observe(root, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ['disabled'],
            });

            return () => observer.disconnect();
        },
        [canvas],
    );
    const state = useSyncExternalStore(
        subscribe,
        () =>
            `${nativeControlEnabled(canvas.current, 'undo')}:${nativeControlEnabled(canvas.current, 'redo')}`,
        () => 'false:false',
    );
    const [canUndo, canRedo] = state.split(':');

    return { canUndo: canUndo === 'true', canRedo: canRedo === 'true' };
}

/**
 * The view of the board over the canvas (ScreenWhiteboard): the zoom bar and
 * the minimap at the bottom right, the history at the bottom left.
 */
export function CanvasView({
    api,
    snapshot,
    canvas,
    editing,
}: Props): ReactElement {
    const [minimapOpen, setMinimapOpen] = useLocalPreference(
        MinimapPreferenceKey,
        true,
    );
    const isWide = useMinWidth(MinimapFromPx);
    const history = useNativeHistory(canvas);
    const historyRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<HTMLDivElement>(null);
    const view = snapshot.view;

    const applyView = (patch: ViewPatch): void => {
        api.updateScene({
            appState: {
                scrollX: patch.scrollX,
                scrollY: patch.scrollY,
                zoom: { value: patch.zoom },
            } as never,
        });
    };

    const isInsideBoard = (target: EventTarget | null): boolean =>
        target instanceof Node &&
        [canvas, historyRef, viewRef].some(
            (ref) => ref.current?.contains(target) === true,
        );

    useShortcut(
        'm',
        (event) => {
            if (!isInsideBoard(event.target)) {
                return;
            }

            event.preventDefault();
            setMinimapOpen(!minimapOpen);
        },
        { enabled: isWide, scope: canvas, preventDefault: false },
    );

    return (
        <>
            {editing && (
                <div
                    ref={historyRef}
                    data-slot="canvas-history"
                    className="absolute bottom-4 left-4 z-10"
                >
                    <WhiteboardHistoryBar
                        canUndo={history.canUndo}
                        canRedo={history.canRedo}
                        onUndo={() =>
                            pressNativeControl(canvas.current, 'undo')
                        }
                        onRedo={() =>
                            pressNativeControl(canvas.current, 'redo')
                        }
                    />
                </div>
            )}
            <div
                ref={viewRef}
                data-slot="canvas-view"
                className="absolute right-4 bottom-4 z-10 flex flex-col items-end gap-2"
            >
                {isWide && minimapOpen && (
                    <CanvasMinimap
                        elements={snapshot.elements}
                        stamp={snapshot.stamp}
                        view={view}
                        liveView={() => liveView(api)}
                        onView={applyView}
                    />
                )}
                <WhiteboardZoomBar
                    percent={zoomPercent(view.zoom)}
                    canZoomIn={canZoom(view.zoom, 1)}
                    canZoomOut={canZoom(view.zoom, -1)}
                    minimapOpen={isWide ? minimapOpen : undefined}
                    onZoomIn={() => {
                        const current = liveView(api);

                        applyView(
                            zoomAroundCentre(
                                current,
                                steppedZoom(current.zoom, 1),
                            ),
                        );
                    }}
                    onZoomOut={() => {
                        const current = liveView(api);

                        applyView(
                            zoomAroundCentre(
                                current,
                                steppedZoom(current.zoom, -1),
                            ),
                        );
                    }}
                    onReset={() =>
                        applyView(zoomAroundCentre(liveView(api), 1))
                    }
                    onFit={() => fitToScreen(api)}
                    onMinimapToggle={
                        isWide ? () => setMinimapOpen(!minimapOpen) : undefined
                    }
                />
            </div>
        </>
    );
}

type HeldItems = { stamp: string; items: MinimapItem[] };

function CanvasMinimap({
    elements,
    stamp,
    view,
    liveView,
    onView,
}: {
    elements: CanvasSnapshot['elements'];
    stamp: string;
    view: View;
    liveView: () => View;
    onView: (patch: ViewPatch) => void;
}): ReactElement {
    /** Held from the press to the release: the frame grows with the view, so a drag through a live one runs away. */
    const [dragFrame, setDragFrame] = useState<MinimapFrame | null>(null);

    const [held, setHeld] = useState<HeldItems>(() => ({
        stamp,
        items: minimapItems(elements as unknown as MinimapElement[]),
    }));
    let items = held.items;

    if (held.stamp !== stamp) {
        items = minimapItems(elements as unknown as MinimapElement[]);
        setHeld({ stamp, items });
    }

    const remToPx = rootFontSize();
    const visible = visibleArea(view);
    const frame =
        dragFrame ??
        minimapFrame(items, visible, {
            width: MinimapSizeRem.width * remToPx,
            height: MinimapSizeRem.height * remToPx,
        });

    useEffect(() => {
        if (dragFrame === null) {
            return;
        }

        const release = (): void => setDragFrame(null);

        window.addEventListener('pointerup', release);
        window.addEventListener('pointercancel', release);

        return () => {
            window.removeEventListener('pointerup', release);
            window.removeEventListener('pointercancel', release);
        };
    }, [dragFrame]);

    return (
        <WhiteboardMinimap
            shapes={items.map((item) => ({
                id: item.id,
                ...toMinimap(item.rect, frame),
                color: item.color,
            }))}
            view={toMinimap(visible, frame)}
            onMoveTo={(point) => {
                if (dragFrame === null) {
                    setDragFrame(frame);
                }

                onView(centredOn(liveView(), fromMinimap(point, frame)));
            }}
            onPan={(fractionX, fractionY) =>
                onView(pannedBy(liveView(), fractionX, fractionY))
            }
        />
    );
}
