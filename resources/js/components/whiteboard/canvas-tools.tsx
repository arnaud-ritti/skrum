import type { LucideIcon } from 'lucide-react';
import {
    Circle,
    Diamond,
    Ellipsis,
    Minus,
    MoveUpRight,
    Square,
} from 'lucide-react';
import { useId, useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode, RefObject } from 'react';
import {
    WhiteboardColorBar,
    WhiteboardSubBar,
    WhiteboardToolbar,
} from '@/components/skrum/whiteboard-toolbar';
import type { ToolbarItem } from '@/components/skrum/whiteboard-toolbar';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    ToolIcons,
    useCanvasTools,
    useToolLabels,
} from '@/components/whiteboard/use-canvas-tools';
import type { CanvasToolsState } from '@/components/whiteboard/use-canvas-tools';
import type { CanvasSnapshot } from '@/hooks/use-canvas-snapshot';
import { isEditableTarget, useShortcut } from '@/hooks/use-shortcut';
import { useTrans } from '@/hooks/use-trans';
import { singleKeyShortcutsEnabled } from '@/lib/shortcuts/preference';
import { colorBarState } from '@/lib/whiteboard/canvas-colors';
import type {
    ColorAppState,
    ColorElement,
} from '@/lib/whiteboard/canvas-colors';
import {
    CaptureUpdateAction,
    type ExcalidrawImperativeAPI,
} from '@/lib/whiteboard/excalidraw';
import { postItAppState } from '@/lib/whiteboard/palette';
import type { PostItColor } from '@/lib/whiteboard/palette';
import { BoardToolKeys, ToolGroups, ToolKeys } from '@/lib/whiteboard/tools';
import type { ConnectorKind, ShapeKind, WbTool } from '@/lib/whiteboard/tools';
import { cn } from '@/lib/utils';

type Props = {
    api: ExcalidrawImperativeAPI;
    snapshot: CanvasSnapshot;
    /** The board's canvas wrapper: scope of the N and C keys. */
    canvas: RefObject<HTMLElement | null>;
    /** Owner decision 4: laser, keep the tool, pen mode. */
    moreTools?: boolean;
};

/** The letters the library answers on the canvas; the bar answers them while it has the focus. */
const LibraryKeyTools: readonly WbTool[] = ToolGroups.flat().filter(
    (tool) => ToolKeys[tool] !== null && !BoardToolKeys.includes(tool),
);

/** 10.625rem: the bar's place under the board's header in ScreenWhiteboard. */
const BarTopRem = 10.625;

/**
 * The band kept free under the bar, in the same column: the history bar's
 * 1rem inset and 2.875rem height, and a 0.5rem gap. Below it the bar is
 * centred between the top and that band.
 */
const HistoryBandRem = 1 + 2.875 + 0.5;

function rootFontSize(): number {
    return (
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    );
}

/**
 * The board's tool bar over the canvas (ScreenWhiteboard): the tools, the
 * sub-bar of the active one, "More tools", sticky placement and the keys the
 * library does not have (N, C).
 */
export function CanvasTools({
    api,
    snapshot,
    canvas,
    moreTools = true,
}: Props): ReactElement | null {
    const { t } = useTrans();
    const labels = useToolLabels();
    const tools = useCanvasTools(api, snapshot, canvas);
    const { active, choose, viewMode } = tools;
    const rootRef = useRef<HTMLDivElement>(null);
    const subBarRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const root = rootRef.current;
        const bar = root?.querySelector<HTMLElement>(
            '[data-slot="whiteboard-toolbar"]',
        );

        if (!root || !bar) {
            return;
        }

        const remToPx = rootFontSize();
        const barHeight = bar.offsetHeight;
        const canvasHeight = snapshot.view.height;
        const historyBand = HistoryBandRem * remToPx;
        const fits =
            canvasHeight >= BarTopRem * remToPx + barHeight + historyBand;

        root.style.top = fits
            ? ''
            : `${Math.max(0, (canvasHeight - historyBand - barHeight) / 2)}px`;

        const subBar = subBarRef.current;
        const activeButton = bar.querySelector<HTMLElement>(
            `[data-toolbar-item="${active}"]`,
        );

        if (subBar && activeButton) {
            subBar.style.marginTop = `${activeButton.offsetTop}px`;
        }
    });

    const isInsideBoard = (target: EventTarget | null): boolean =>
        target instanceof Node &&
        (canvas.current?.contains(target) === true ||
            rootRef.current?.contains(target) === true);

    useShortcut(
        ['n', 'c'],
        (event) => {
            if (!isInsideBoard(event.target)) {
                return;
            }

            event.preventDefault();
            choose(event.key.toLowerCase() === 'n' ? 'sticky' : 'connector');
        },
        { enabled: !viewMode, scope: canvas, preventDefault: false },
    );

    if (viewMode) {
        return null;
    }

    const answerLetter = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
            return;
        }

        if (!rootRef.current?.contains(event.target as Node)) {
            return;
        }

        if (isEditableTarget(event.target) || !singleKeyShortcutsEnabled()) {
            return;
        }

        const tool = LibraryKeyTools.find(
            (candidate) =>
                ToolKeys[candidate]?.toLowerCase() === event.key.toLowerCase(),
        );

        if (tool === undefined) {
            return;
        }

        event.preventDefault();
        choose(tool);
    };

    const addFromColour = (color: PostItColor): void => {
        if (!tools.addStickyInView(color)) {
            return;
        }

        rootRef.current
            ?.querySelector<HTMLElement>('[data-toolbar-item="sticky"]')
            ?.focus();
    };

    const groups: ToolbarItem[][] = ToolGroups.map((group) =>
        group.map((tool) => ({
            id: tool,
            label: labels[tool],
            icon: ToolIcons[tool],
            shortcut: ToolKeys[tool] ?? undefined,
            pressed: active === tool,
            onPress: () => choose(tool),
        })),
    );

    const shownSubBar = (
        <CanvasToolSubBar
            api={api}
            snapshot={snapshot}
            tools={tools}
            onAddSticky={addFromColour}
        />
    );
    const hasSubBar =
        active === 'sticky' || active === 'shape' || active === 'connector';

    return (
        <div
            ref={rootRef}
            data-slot="canvas-tools"
            onKeyDown={answerLetter}
            className="pointer-events-none absolute top-42.5 left-4 z-10 flex items-start gap-2"
        >
            <WhiteboardToolbar
                label={t('Tools')}
                groups={groups}
                className="pointer-events-auto"
                trailing={
                    moreTools ? (
                        <MoreTools
                            api={api}
                            snapshot={snapshot}
                            setTool={tools.setTool}
                        />
                    ) : undefined
                }
            />
            {hasSubBar && (
                <div ref={subBarRef} className="pointer-events-auto">
                    {shownSubBar}
                </div>
            )}
        </div>
    );
}

/**
 * The sub-bar of the active tool: the sticky colours (a press adds a note in
 * the middle of the view), the kinds of shape with the eight fills, the kinds
 * of connector. Nothing for the other tools.
 */
export function CanvasToolSubBar({
    api,
    snapshot,
    tools,
    onAddSticky,
    className,
}: {
    api: ExcalidrawImperativeAPI;
    snapshot: CanvasSnapshot;
    tools: CanvasToolsState;
    onAddSticky: (color: PostItColor) => void;
    className?: string;
}): ReactNode {
    const { t } = useTrans();
    const { active, choices, hold, setTool } = tools;

    const applyFill = (color: PostItColor): void => {
        api.updateScene({
            appState: postItAppState(color) as never,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
    };

    if (active === 'sticky') {
        return (
            <WhiteboardSubBar
                label={t('Sticky note colours')}
                className={className}
            >
                <WhiteboardColorBar
                    value={choices.sticky}
                    onChange={(color) => hold({ ...choices, sticky: color })}
                    onActivate={onAddSticky}
                    className="border-0 bg-transparent p-0 shadow-none"
                />
            </WhiteboardSubBar>
        );
    }

    if (active === 'shape') {
        return (
            <WhiteboardSubBar label={t('Shapes')} className={className}>
                <KindRadios<ShapeKind>
                    label={t('Shape')}
                    value={choices.shape}
                    kinds={[
                        {
                            id: 'rectangle',
                            label: t('Rectangle'),
                            icon: Square,
                        },
                        {
                            id: 'diamond',
                            label: t('Diamond'),
                            icon: Diamond,
                        },
                        {
                            id: 'ellipse',
                            label: t('Ellipse'),
                            icon: Circle,
                        },
                    ]}
                    onChoose={(shape) => {
                        hold({ ...choices, shape });
                        setTool({ type: shape });
                    }}
                />
                <Separator
                    orientation="vertical"
                    className="mx-1 self-stretch data-[orientation=vertical]:h-auto"
                />
                <WhiteboardColorBar
                    value={
                        colorBarState(
                            snapshot.elements as unknown as ColorElement[],
                            snapshot.appState as ColorAppState,
                        ).value
                    }
                    onChange={applyFill}
                    className="border-0 bg-transparent p-0 shadow-none"
                />
            </WhiteboardSubBar>
        );
    }

    if (active === 'connector') {
        return (
            <WhiteboardSubBar label={t('Connectors')} className={className}>
                <KindRadios<ConnectorKind>
                    label={t('Connector')}
                    value={choices.connector}
                    kinds={[
                        {
                            id: 'arrow',
                            label: t('Arrow'),
                            icon: MoveUpRight,
                        },
                        { id: 'line', label: t('Line'), icon: Minus },
                    ]}
                    onChoose={(connector) => {
                        hold({ ...choices, connector });
                        setTool({ type: connector });
                    }}
                />
            </WhiteboardSubBar>
        );
    }

    return null;
}

type Kind<T extends string> = { id: T; label: string; icon: LucideIcon };

/** The kinds of a tool (shapes, connectors) as radios: the arrow keys move the choice. */
function KindRadios<T extends string>({
    label,
    value,
    kinds,
    onChoose,
}: {
    label: string;
    value: T;
    kinds: readonly Kind<T>[];
    onChoose: (kind: T) => void;
}) {
    const refs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});

    const move = (event: KeyboardEvent<HTMLButtonElement>): void => {
        const index = kinds.findIndex((kind) => kind.id === value);
        const last = kinds.length - 1;
        let next: number | null = null;

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            next = index >= last ? 0 : index + 1;
        }

        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            next = index <= 0 ? last : index - 1;
        }

        if (event.key === 'Home') {
            next = 0;
        }

        if (event.key === 'End') {
            next = last;
        }

        if (next === null) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        const kind = kinds[next].id;
        onChoose(kind);
        refs.current[kind]?.focus();
    };

    return (
        <div
            role="radiogroup"
            aria-label={label}
            className="inline-flex items-center gap-0.5"
        >
            {kinds.map((kind) => {
                const Icon = kind.icon;
                const isChecked = kind.id === value;

                return (
                    <Tooltip key={kind.id}>
                        <TooltipTrigger asChild>
                            <button
                                ref={(node) => {
                                    refs.current[kind.id] = node;
                                }}
                                type="button"
                                role="radio"
                                aria-checked={isChecked}
                                aria-label={kind.label}
                                tabIndex={isChecked ? 0 : -1}
                                onClick={() => onChoose(kind.id)}
                                onKeyDown={move}
                                className={cn(
                                    'grid size-9 shrink-0 place-items-center rounded-md text-foreground outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                                    isChecked &&
                                        'bg-skrum-primary-soft text-skrum-primary-text ring-1 ring-primary ring-inset hover:bg-skrum-primary-soft',
                                )}
                            >
                                <Icon aria-hidden className="size-4.5" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            {kind.label}
                        </TooltipContent>
                    </Tooltip>
                );
            })}
        </div>
    );
}

/** Owner decision 4: what the library's tool bar offers and ScreenWhiteboard has no place for. */
function MoreTools({
    api,
    snapshot,
    setTool,
}: {
    api: ExcalidrawImperativeAPI;
    snapshot: CanvasSnapshot;
    setTool: CanvasToolsState['setTool'];
}) {
    const { t } = useTrans();
    const label = t('More tools');
    const currentToolId = useId();
    const libraryTool = snapshot.appState.activeTool;
    const isLaser = libraryTool.type === 'laser';
    const isKept = libraryTool.locked;
    const { penDetected, penMode } = snapshot.appState;

    /** Only `locked` changes: setActiveTool would re-open the image picker and clear the selection. */
    const keepTool = (): void => {
        api.updateScene({
            appState: { activeTool: { ...libraryTool, locked: !isKept } },
        });
    };

    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            data-slot="whiteboard-tool"
                            data-roving-item=""
                            aria-label={label}
                            aria-describedby={
                                isLaser ? currentToolId : undefined
                            }
                            className={cn(
                                'grid size-9 shrink-0 place-items-center rounded-md text-foreground outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:bg-accent',
                                isLaser &&
                                    'bg-skrum-primary-soft text-skrum-primary-text ring-1 ring-primary ring-inset hover:bg-skrum-primary-soft',
                            )}
                        >
                            <Ellipsis aria-hidden className="size-4.5" />
                        </button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
            {isLaser && (
                <span id={currentToolId} className="sr-only">
                    {t('Current tool: :tool', { tool: t('Laser pointer') })}
                </span>
            )}
            <DropdownMenuContent side="right" align="end">
                <DropdownMenuCheckboxItem
                    checked={isLaser}
                    aria-keyshortcuts="K"
                    onCheckedChange={() =>
                        setTool(
                            isLaser ? { type: 'selection' } : { type: 'laser' },
                        )
                    }
                >
                    {t('Laser pointer')}
                    <DropdownMenuShortcut aria-hidden="true">
                        K
                    </DropdownMenuShortcut>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={isKept}
                    aria-keyshortcuts="Q"
                    onCheckedChange={keepTool}
                >
                    {t('Keep the tool')}
                    <DropdownMenuShortcut aria-hidden="true">
                        Q
                    </DropdownMenuShortcut>
                </DropdownMenuCheckboxItem>
                {penDetected && (
                    <DropdownMenuCheckboxItem
                        checked={penMode}
                        onCheckedChange={() =>
                            api.updateScene({
                                appState: { penMode: !penMode },
                            })
                        }
                    >
                        {t('Pen mode')}
                    </DropdownMenuCheckboxItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
