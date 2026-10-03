import type { LucideIcon } from 'lucide-react';
import {
    Circle,
    Diamond,
    Ellipsis,
    Eraser,
    Frame,
    Hand,
    Image,
    Minus,
    MousePointer2,
    MoveUpRight,
    Pencil,
    Shapes,
    Spline,
    Square,
    StickyNote,
    Type,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { addSticky } from '@/components/whiteboard/sticky-tool';
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
import {
    BoardToolKeys,
    DefaultToolChoices,
    StickyToolType,
    ToolGroups,
    ToolKeys,
    canvasToolFor,
    choicesAfter,
    toolOf,
} from '@/lib/whiteboard/tools';
import type {
    ConnectorKind,
    ShapeKind,
    ToolChoices,
    WbTool,
} from '@/lib/whiteboard/tools';
import { cn } from '@/lib/utils';

type Props = {
    api: ExcalidrawImperativeAPI;
    snapshot: CanvasSnapshot;
    /** The board's canvas wrapper: scope of the N and C keys. */
    canvas: RefObject<HTMLElement | null>;
    /** Owner decision 4: laser, keep the tool, pen mode. */
    moreTools?: boolean;
};

const ToolIcons: Readonly<Record<WbTool, LucideIcon>> = {
    select: MousePointer2,
    hand: Hand,
    sticky: StickyNote,
    shape: Shapes,
    connector: Spline,
    text: Type,
    pen: Pencil,
    eraser: Eraser,
    frame: Frame,
    image: Image,
};

/** The letters the library answers on the canvas; the bar answers them while it has the focus. */
const LibraryKeyTools: readonly WbTool[] = ToolGroups.flat().filter(
    (tool) => ToolKeys[tool] !== null && !BoardToolKeys.includes(tool),
);

/** 10.625rem: the bar's place under the board's header in ScreenWhiteboard. */
const BarTopRem = 10.625;

/** 1rem kept free under the bar before it is centred on a short canvas. */
const BarMarginRem = 1;

function useToolLabels(): Record<WbTool, string> {
    const { t } = useTrans();

    return {
        select: t('Selection'),
        hand: t('Hand'),
        sticky: t('Sticky note'),
        shape: t('Shape'),
        connector: t('Connector'),
        text: t('Text'),
        pen: t('Pencil'),
        eraser: t('Eraser'),
        frame: t('Frame'),
        image: t('Image'),
    };
}

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
    const [held, setHeld] = useState<ToolChoices>(DefaultToolChoices);
    const libraryTool = snapshot.appState.activeTool;
    const choices = choicesAfter(libraryTool, held);
    const active = toolOf(libraryTool);
    const viewMode = snapshot.appState.viewModeEnabled;
    const rootRef = useRef<HTMLDivElement>(null);
    const subBarRef = useRef<HTMLDivElement>(null);
    const stickyColor = useRef<PostItColor>(choices.sticky);
    const isViewMode = useRef(viewMode);

    if (choices !== held) {
        setHeld(choices);
    }

    useEffect(() => {
        stickyColor.current = choices.sticky;
        isViewMode.current = viewMode;
    });

    useEffect(
        () =>
            api.onPointerDown((tool, pointerDownState) => {
                if (
                    tool.type !== 'custom' ||
                    tool.customType !== StickyToolType
                ) {
                    return;
                }

                if (isViewMode.current || api.getAppState().viewModeEnabled) {
                    return;
                }

                addSticky(api, stickyColor.current, pointerDownState.origin);

                if (tool.locked) {
                    return;
                }

                // After the library's own pointer-up, which reads the tool it started with.
                window.addEventListener(
                    'pointerup',
                    () => api.setActiveTool({ type: 'selection' }),
                    { once: true },
                );
            }),
        [api],
    );

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
        const fits =
            canvasHeight >= (BarTopRem + BarMarginRem) * remToPx + barHeight;

        root.style.top = fits
            ? ''
            : `${Math.max(0, (canvasHeight - barHeight) / 2)}px`;

        const subBar = subBarRef.current;
        const activeButton = bar.querySelector<HTMLElement>(
            `[data-toolbar-item="${active}"]`,
        );

        if (subBar && activeButton) {
            subBar.style.marginTop = `${activeButton.offsetTop}px`;
        }
    });

    const choose = (tool: WbTool): void => {
        api.setActiveTool(canvasToolFor(tool, choices));
    };

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
        addSticky(api, color);

        if (libraryTool.locked) {
            return;
        }

        api.setActiveTool({ type: 'selection' });
        rootRef.current
            ?.querySelector<HTMLElement>('[data-toolbar-item="sticky"]')
            ?.focus();
    };

    const applyFill = (color: PostItColor): void => {
        api.updateScene({
            appState: postItAppState(color) as never,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
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

    const subBar = (): ReactNode => {
        if (active === 'sticky') {
            return (
                <WhiteboardSubBar label={t('Sticky note colours')}>
                    <WhiteboardColorBar
                        value={choices.sticky}
                        onChange={(color) =>
                            setHeld({ ...choices, sticky: color })
                        }
                        onActivate={addFromColour}
                        className="border-0 bg-transparent p-0 shadow-none"
                    />
                </WhiteboardSubBar>
            );
        }

        if (active === 'shape') {
            return (
                <WhiteboardSubBar label={t('Shapes')}>
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
                            setHeld({ ...choices, shape });
                            api.setActiveTool({ type: shape });
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
                <WhiteboardSubBar label={t('Connectors')}>
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
                            setHeld({ ...choices, connector });
                            api.setActiveTool({ type: connector });
                        }}
                    />
                </WhiteboardSubBar>
            );
        }

        return null;
    };

    const shownSubBar = subBar();

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
                        <MoreTools api={api} snapshot={snapshot} />
                    ) : undefined
                }
            />
            {shownSubBar && (
                <div ref={subBarRef} className="pointer-events-auto">
                    {shownSubBar}
                </div>
            )}
        </div>
    );
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
}: {
    api: ExcalidrawImperativeAPI;
    snapshot: CanvasSnapshot;
}) {
    const { t } = useTrans();
    const label = t('More tools');
    const libraryTool = snapshot.appState.activeTool;
    const isLaser = libraryTool.type === 'laser';
    const isKept = libraryTool.locked;
    const { penDetected, penMode } = snapshot.appState;

    const keepTool = (): void => {
        if (libraryTool.type === 'custom') {
            api.setActiveTool({
                type: 'custom',
                customType: libraryTool.customType ?? StickyToolType,
                locked: !isKept,
            });

            return;
        }

        api.setActiveTool({ type: libraryTool.type, locked: !isKept } as never);
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
                            className="grid size-9 shrink-0 place-items-center rounded-md text-foreground outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:bg-accent"
                        >
                            <Ellipsis aria-hidden className="size-4.5" />
                        </button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right" align="end">
                <DropdownMenuCheckboxItem
                    checked={isLaser}
                    aria-keyshortcuts="K"
                    onCheckedChange={() =>
                        api.setActiveTool(
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
