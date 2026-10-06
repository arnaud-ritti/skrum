import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement, RefObject } from 'react';
import {
    WhiteboardLockMark,
    WhiteboardLockedBar,
    WhiteboardSelectionBar,
    WhiteboardSelectionCount,
} from '@/components/skrum/whiteboard-selection-bar';
import type { CanvasSnapshot } from '@/hooks/use-canvas-snapshot';
import { useTrans } from '@/hooks/use-trans';
import { colorBarState, filledSelection } from '@/lib/whiteboard/canvas-colors';
import type {
    ColorAppState,
    ColorElement,
} from '@/lib/whiteboard/canvas-colors';
import { runCanvasCommand } from '@/lib/whiteboard/canvas-commands';
import type { CanvasCommand } from '@/lib/whiteboard/canvas-commands';
import {
    CaptureUpdateAction,
    getCommonBounds,
} from '@/lib/whiteboard/excalidraw';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
import {
    elementBounds,
    lockedElements,
    lockedUnitAt,
    unlockElements,
} from '@/lib/whiteboard/locked';
import type { LockableElement } from '@/lib/whiteboard/locked';
import { postItAppState, recolorElements } from '@/lib/whiteboard/palette';
import type { PostItColor } from '@/lib/whiteboard/palette';
import {
    EdgeMargin,
    selectionBarPlacement,
    selectionBarShown,
    selectionCountPlacement,
    selectionSummary,
} from '@/lib/whiteboard/selection';
import type {
    SelectableElement,
    SelectionState,
    SelectionSummary,
} from '@/lib/whiteboard/selection';
import type { Rect } from '@/lib/whiteboard/viewport';

type Props = {
    api: ExcalidrawImperativeAPI;
    snapshot: CanvasSnapshot;
    /** The board's canvas wrapper, home of the library's container that hears its own shortcuts. */
    canvas: RefObject<HTMLElement | null>;
    isFacilitator: boolean;
    editing: boolean;
    /** Lifted to the board, which shows the library's property panel (owner decision 2). */
    stylesShown: boolean;
    onStylesChange: (shown: boolean) => void;
    /** Pixels kept free at the bottom of the canvas for the bars docked there. */
    bottomInset?: number;
    /** Pixels kept free at the top of the canvas for the facilitator's pill. */
    topInset?: number;
};

type BarSize = { width: number; height: number };

/** The right edge of the library's Styles panel, from the left of the canvas; laid out even while closed. */
function stylesPanelEdge(canvas: HTMLElement | null): number {
    const panel = canvas?.querySelector('.App-menu__left');

    if (!canvas || !panel) {
        return 0;
    }

    return (
        panel.getBoundingClientRect().right -
        canvas.getBoundingClientRect().left
    );
}

function boundsOf(snapshot: CanvasSnapshot, ids: readonly string[]): Rect {
    const selected = snapshot.elements.filter((element) =>
        ids.includes(element.id),
    );
    const [minX, minY, maxX, maxY] = getCommonBounds(selected as never);

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function groupControl(summary: SelectionSummary): 'group' | 'ungroup' | null {
    if (summary.canUngroup && summary.units === 1) {
        return 'ungroup';
    }

    if (summary.canGroup) {
        return 'group';
    }

    return null;
}

/** Screen pixels: the mark's own size (1.125rem), under which a shape is too small to carry it. */
const LockMarkSize = 18;

/** Screen pixels a pointer may travel between its press and its release and still be a click. */
const ClickSlop = 5;

/**
 * The locked element a click landed on, which the library leaves unselected:
 * its ids (a group goes whole) until the next press on the canvas or Escape.
 * A press that travels is a selection box, not a click; the library marks a
 * drag only when it moves an element.
 */
function useLockedTarget(
    api: ExcalidrawImperativeAPI,
    enabled: boolean,
): [readonly string[] | null, () => void] {
    const [target, setTarget] = useState<readonly string[] | null>(null);
    const clear = useCallback(() => setTarget(null), []);
    const isSet = target !== null;

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const forget = api.onPointerDown((tool, pointerDown, down) => {
            const { clientX, clientY } = down;

            setTarget(null);

            if (tool.type !== 'selection') {
                return;
            }

            const unit = lockedUnitAt(
                api.getSceneElements() as unknown as LockableElement[],
                pointerDown.origin,
            );

            if (unit === null) {
                return;
            }

            const release = (up: PointerEvent): void => {
                window.removeEventListener('pointerup', release);
                window.removeEventListener('pointercancel', release);

                const travelled = Math.hypot(
                    up.clientX - clientX,
                    up.clientY - clientY,
                );

                // A click that selected something lying on the locked element is not a click on it.
                const selectedSomething =
                    Object.keys(api.getAppState().selectedElementIds).length >
                    0;

                if (
                    up.type === 'pointerup' &&
                    travelled <= ClickSlop &&
                    !selectedSomething
                ) {
                    setTarget(unit);
                }
            };

            window.addEventListener('pointerup', release);
            window.addEventListener('pointercancel', release);
        });

        return () => {
            forget();
            setTarget(null);
        };
    }, [api, enabled]);

    useEffect(() => {
        if (!isSet) {
            return;
        }

        const leave = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                setTarget(null);
            }
        };

        document.addEventListener('keydown', leave);

        return () => document.removeEventListener('keydown', leave);
    }, [isSet]);

    return [target, clear];
}

/**
 * A lock on the top right corner of every locked element whose corner is in
 * view, so a shape that does not answer says why. None on a shape drawn
 * smaller than the mark.
 */
function LockedMarks({
    locked,
    view,
}: {
    locked: readonly { id: string; bounds: Rect }[];
    view: CanvasSnapshot['view'];
}): ReactElement {
    return (
        <>
            {locked.map(({ id, bounds }) => {
                const left =
                    (bounds.x + bounds.width + view.scrollX) * view.zoom;
                const top = (bounds.y + view.scrollY) * view.zoom;
                const width = bounds.width * view.zoom;
                const height = bounds.height * view.zoom;

                if (width < LockMarkSize || height < LockMarkSize) {
                    return null;
                }

                if (
                    left < 0 ||
                    left > view.width ||
                    top < 0 ||
                    top > view.height
                ) {
                    return null;
                }

                return <WhiteboardLockMark key={id} style={{ left, top }} />;
            })}
        </>
    );
}

/**
 * The selection bar of ScreenWhiteboard under the selection, clear of the
 * open Styles panel, and its count chip on the selection's corner. Every command but the colours is the
 * library's own, reached through its shortcut (`runCanvasCommand`).
 */
export function CanvasSelection({
    api,
    snapshot,
    canvas,
    isFacilitator,
    editing,
    stylesShown,
    onStylesChange,
    bottomInset = 0,
    topInset = 0,
}: Props): ReactElement | null {
    const { t } = useTrans();
    const [barSize, setBarSize] = useState<BarSize>({ width: 0, height: 0 });
    const [panelEdge, setPanelEdge] = useState(0);
    const state = snapshot.appState as unknown as SelectionState;
    const summary = editing
        ? selectionSummary(
              snapshot.elements as unknown as SelectableElement[],
              state,
          )
        : null;
    const hasSelection = summary !== null;
    const [lockedTarget, clearLockedTarget] = useLockedTarget(api, editing);
    const locked = useMemo(
        () =>
            lockedElements(
                snapshot.elements as unknown as LockableElement[],
            ).map((element) => ({
                id: element.id,
                bounds: elementBounds(element),
            })),
        [snapshot.elements],
    );

    useEffect(() => {
        if (hasSelection || !stylesShown) {
            return;
        }

        onStylesChange(false);
    }, [hasSelection, stylesShown, onStylesChange]);

    useEffect(() => {
        if (hasSelection) {
            clearLockedTarget();
        }
    }, [hasSelection, clearLockedTarget]);

    /** However the panel was shown (the bar's toggle, an earlier selection, the library's own menu), and again on a resize. */
    useEffect(() => {
        if (!stylesShown) {
            return;
        }

        const measure = (): void =>
            setPanelEdge(stylesPanelEdge(canvas.current));

        measure();
        window.addEventListener('resize', measure);

        return () => window.removeEventListener('resize', measure);
    }, [stylesShown, canvas]);

    const lockedReason = t('Only the facilitator can change a locked element.');
    const marks = editing ? (
        <LockedMarks locked={locked} view={snapshot.view} />
    ) : null;

    if (!selectionBarShown(state)) {
        return marks;
    }

    if (summary === null) {
        const targetIds = (editing ? (lockedTarget ?? []) : []).filter((id) =>
            locked.some((element) => element.id === id),
        );

        if (targetIds.length === 0) {
            return marks;
        }

        const place = selectionBarPlacement(
            boundsOf(snapshot, targetIds),
            snapshot.view,
            barSize,
            bottomInset,
            0,
            topInset,
        );

        return (
            <>
                {marks}
                <WhiteboardLockedBar
                    onUnlock={() => unlockElements(api, targetIds)}
                    disabled={!isFacilitator}
                    reason={isFacilitator ? undefined : lockedReason}
                    style={{
                        left: place.left,
                        top: place.top,
                        maxWidth: snapshot.view.width - 2 * EdgeMargin,
                    }}
                    onSize={setBarSize}
                />
            </>
        );
    }

    const run = (command: CanvasCommand): void => {
        runCanvasCommand(canvas.current, command);
    };

    const recolour = (color: PostItColor): void => {
        const elements = api.getSceneElementsIncludingDeleted();
        const selected = filledSelection(
            elements as unknown as ColorElement[],
            api.getAppState().selectedElementIds,
        ).map((element) => element.id);

        api.updateScene({
            ...(selected.length > 0 && {
                elements: recolorElements(elements, selected, color),
            }),
            appState: postItAppState(color) as never,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
    };

    const lockedForMe = summary.hasLocked && !isFacilitator;
    const group = groupControl(summary);
    const bounds = boundsOf(snapshot, summary.ids);
    const place = selectionBarPlacement(
        bounds,
        snapshot.view,
        barSize,
        bottomInset,
        stylesShown ? panelEdge : 0,
        topInset,
    );
    const corner = selectionCountPlacement(bounds, snapshot.view);

    return (
        <>
            {marks}
            {corner && (
                <WhiteboardSelectionCount
                    count={summary.count}
                    style={{
                        left: corner.x,
                        top: corner.y,
                        maxWidth: corner.maxWidth,
                    }}
                />
            )}
            <WhiteboardSelectionBar
                colour={
                    summary.hasFill
                        ? {
                              value: colorBarState(
                                  snapshot.elements as unknown as ColorElement[],
                                  snapshot.appState as unknown as ColorAppState,
                              ).value,
                              onChange: recolour,
                              disabled: lockedForMe,
                              reason: lockedForMe ? lockedReason : undefined,
                          }
                        : undefined
                }
                group={
                    group === null
                        ? null
                        : {
                              kind: group,
                              onPress: () => run(group),
                              disabled: lockedForMe,
                          }
                }
                align={{
                    enabled: summary.units >= 2 && !lockedForMe,
                    distribute: summary.units >= 3,
                    onCommand: run,
                }}
                lock={
                    isFacilitator
                        ? {
                              locked: summary.allLocked,
                              onPress: () => run('toggleLock'),
                          }
                        : undefined
                }
                styles={{
                    shown: stylesShown,
                    onToggle: () => onStylesChange(!stylesShown),
                    disabled: lockedForMe,
                }}
                remove={{
                    onPress: () => run('delete'),
                    disabled: lockedForMe,
                    reason: lockedForMe ? lockedReason : undefined,
                }}
                style={{
                    left: place.left,
                    top: place.top,
                    maxWidth: snapshot.view.width - 2 * EdgeMargin,
                }}
                onSize={setBarSize}
            />
        </>
    );
}
