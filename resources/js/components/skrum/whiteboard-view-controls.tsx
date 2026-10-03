import { Map as MapIcon, Minus, Plus, Redo2, Scan, Undo2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactElement } from 'react';
import {
    WhiteboardToolbar,
    WhiteboardToolButton,
    moveToolbarFocus,
} from '@/components/skrum/whiteboard-toolbar';
import type { ToolbarItem } from '@/components/skrum/whiteboard-toolbar';
import { Separator } from '@/components/ui/separator';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import type { PostItColor } from '@/lib/whiteboard/palette';
import { cn } from '@/lib/utils';

export type WhiteboardZoomBarProps = {
    percent: number;
    canZoomIn: boolean;
    canZoomOut: boolean;
    /** Undefined: no minimap toggle (below lg, on a phone). */
    minimapOpen?: boolean;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
    onFit: () => void;
    onMinimapToggle?: () => void;
    className?: string;
};

const percentKey = 'percent';

const barClasses =
    'inline-flex items-center gap-0.5 rounded-xl border border-border bg-popover p-1 shadow-raised';

/** The zoom bar of the mockup (sk-wbbar with wb-zoom-v): −, the percentage, +, then Fit to screen and the Minimap toggle. */
export function WhiteboardZoomBar({
    percent,
    canZoomIn,
    canZoomOut,
    minimapOpen,
    onZoomIn,
    onZoomOut,
    onReset,
    onFit,
    onMinimapToggle,
    className,
}: WhiteboardZoomBarProps): ReactElement {
    const { t } = useTrans();
    const valueId = useId();
    const [focusedKey, setFocusedKey] = useState<string | null>(null);

    const zoomOut: ToolbarItem = {
        id: 'zoom-out',
        label: t('Zoom out'),
        icon: Minus,
        disabled: !canZoomOut,
        onPress: onZoomOut,
    };
    const zoomIn: ToolbarItem = {
        id: 'zoom-in',
        label: t('Zoom in'),
        icon: Plus,
        disabled: !canZoomIn,
        onPress: onZoomIn,
    };
    const fit: ToolbarItem = {
        id: 'fit',
        label: t('Fit to screen'),
        icon: Scan,
        onPress: onFit,
    };
    const minimap: ToolbarItem | null =
        minimapOpen === undefined || onMinimapToggle === undefined
            ? null
            : {
                  id: 'minimap',
                  label: t('Minimap'),
                  icon: MapIcon,
                  pressed: minimapOpen,
                  onPress: onMinimapToggle,
              };

    const usableKeys = [
        zoomOut.disabled ? null : zoomOut.id,
        percentKey,
        zoomIn.disabled ? null : zoomIn.id,
        fit.id,
        minimap?.id ?? null,
    ].filter((key): key is string => key !== null);
    const tabStop =
        focusedKey !== null && usableKeys.includes(focusedKey)
            ? focusedKey
            : usableKeys[0];
    const tabIndexOf = (key: string): number => (key === tabStop ? 0 : -1);
    const resetLabel = t('Reset zoom to 100 %');

    return (
        <div
            data-slot="whiteboard-zoom-bar"
            role="toolbar"
            aria-label={t('Zoom')}
            aria-orientation="horizontal"
            onKeyDown={(event) => moveToolbarFocus(event, 'horizontal')}
            onFocus={(event) => {
                const key =
                    event.target.dataset.toolbarItem ??
                    (event.target.hasAttribute('data-zoom-percent')
                        ? percentKey
                        : null);

                if (key !== null) {
                    setFocusedKey(key);
                }
            }}
            className={cn(barClasses, className)}
        >
            <WhiteboardToolButton
                item={zoomOut}
                size="default"
                tooltipSide="top"
                tabIndex={tabIndexOf(zoomOut.id)}
            />
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        data-roving-item=""
                        data-zoom-percent=""
                        aria-label={resetLabel}
                        aria-describedby={valueId}
                        tabIndex={tabIndexOf(percentKey)}
                        onClick={onReset}
                        className="h-9 min-w-13 shrink-0 rounded-md px-1 text-center text-body-sm font-bold text-foreground tabular-nums outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                        <span id={valueId}>{`${Math.round(percent)} %`}</span>
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top">{resetLabel}</TooltipContent>
            </Tooltip>
            <WhiteboardToolButton
                item={zoomIn}
                size="default"
                tooltipSide="top"
                tabIndex={tabIndexOf(zoomIn.id)}
            />
            <Separator
                data-slot="whiteboard-toolbar-separator"
                orientation="vertical"
                className="mx-0.5 my-1 self-stretch data-[orientation=vertical]:h-auto"
            />
            <WhiteboardToolButton
                item={fit}
                size="default"
                tooltipSide="top"
                tabIndex={tabIndexOf(fit.id)}
            />
            {minimap && (
                <WhiteboardToolButton
                    item={minimap}
                    size="default"
                    tooltipSide="top"
                    tabIndex={tabIndexOf(minimap.id)}
                />
            )}
        </div>
    );
}

/** A live element of the board, in minimap pixels. */
export type MinimapShape = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: PostItColor | null;
};

export type WhiteboardMinimapProps = {
    shapes: readonly MinimapShape[];
    /** The visible area, in minimap pixels. */
    view: { x: number; y: number; width: number; height: number };
    /** A press or a drag on the minimap, in minimap pixels: the container converts. */
    onMoveTo: (point: { x: number; y: number }) => void;
    /** The arrows on the frame: a tenth of the view. */
    onPan: (fractionX: number, fractionY: number) => void;
    className?: string;
};

const minimapSwatchClasses: Record<PostItColor, string> = {
    sun: 'bg-skrum-col-sun border-skrum-col-sun-border',
    apricot: 'bg-skrum-col-apricot border-skrum-col-apricot-border',
    coral: 'bg-skrum-col-coral border-skrum-col-coral-border',
    plum: 'bg-skrum-col-plum border-skrum-col-plum-border',
    iris: 'bg-skrum-col-iris border-skrum-col-iris-border',
    sky: 'bg-skrum-col-sky border-skrum-col-sky-border',
    lagoon: 'bg-skrum-col-lagoon border-skrum-col-lagoon-border',
    moss: 'bg-skrum-col-moss border-skrum-col-moss-border',
};

const panSteps: Record<string, readonly [number, number]> = {
    ArrowRight: [0.1, 0],
    ArrowLeft: [-0.1, 0],
    ArrowDown: [0, 0.1],
    ArrowUp: [0, -0.1],
};

/**
 * The minimap of the mockup (sk-minimap): the board's elements as rectangles and the visible area as a frame.
 * The picture is an image; the frame is a button beside it, since the content of an image is hidden from assistive technology.
 */
export function WhiteboardMinimap({
    shapes,
    view,
    onMoveTo,
    onPan,
    className,
}: WhiteboardMinimapProps): ReactElement {
    const { t } = useTrans();
    const descriptionId = useId();
    const draggedPointer = useRef<number | null>(null);

    const moveTo = (event: PointerEvent<HTMLDivElement>): void => {
        const box = event.currentTarget.getBoundingClientRect();

        onMoveTo({ x: event.clientX - box.left, y: event.clientY - box.top });
    };

    const pan = (event: KeyboardEvent<HTMLButtonElement>): void => {
        const step = panSteps[event.key];

        if (!step) {
            return;
        }

        event.preventDefault();
        onPan(step[0], step[1]);
    };

    return (
        <div
            data-slot="whiteboard-minimap"
            onPointerDown={(event) => {
                if (event.button !== 0) {
                    return;
                }

                draggedPointer.current = event.pointerId;
                event.currentTarget.setPointerCapture?.(event.pointerId);
                moveTo(event);
            }}
            onPointerMove={(event) => {
                if (draggedPointer.current !== event.pointerId) {
                    return;
                }

                moveTo(event);
            }}
            onPointerUp={() => {
                draggedPointer.current = null;
            }}
            onPointerCancel={() => {
                draggedPointer.current = null;
            }}
            className={cn(
                'relative h-28 w-45 touch-none overflow-hidden rounded-lg border border-border bg-card shadow-raised',
                className,
            )}
        >
            <div
                role="img"
                aria-label={t('Minimap')}
                aria-describedby={descriptionId}
                className="absolute inset-0"
            >
                {shapes.map((shape) => (
                    <span
                        key={shape.id}
                        data-slot="whiteboard-minimap-shape"
                        style={{
                            left: shape.x,
                            top: shape.y,
                            width: shape.width,
                            height: shape.height,
                        }}
                        className={cn(
                            'absolute rounded-xs',
                            shape.color === null
                                ? 'bg-muted-foreground/50'
                                : cn(
                                      'border',
                                      minimapSwatchClasses[shape.color],
                                  ),
                        )}
                    />
                ))}
            </div>
            <span id={descriptionId} className="sr-only">
                {t('Shows the whole board; the frame is the part you see.')}
            </span>
            <button
                type="button"
                data-slot="whiteboard-minimap-view"
                aria-label={t('Move the view')}
                onKeyDown={pan}
                style={{
                    left: view.x,
                    top: view.y,
                    width: view.width,
                    height: view.height,
                }}
                className="absolute rounded-sm border-[1.5px] border-primary bg-primary/10 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
        </div>
    );
}

export type WhiteboardHistoryBarProps = {
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    className?: string;
};

/** Undo and Redo, bottom left of the board. */
export function WhiteboardHistoryBar({
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    className,
}: WhiteboardHistoryBarProps): ReactElement {
    const { t } = useTrans();

    return (
        <WhiteboardToolbar
            label={t('History')}
            orientation="horizontal"
            className={className}
            groups={[
                [
                    {
                        id: 'undo',
                        label: t('Undo'),
                        icon: Undo2,
                        disabled: !canUndo,
                        onPress: onUndo,
                    },
                    {
                        id: 'redo',
                        label: t('Redo'),
                        icon: Redo2,
                        disabled: !canRedo,
                        onPress: onRedo,
                    },
                ],
            ]}
        />
    );
}
