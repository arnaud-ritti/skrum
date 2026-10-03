import {
    Eraser,
    PaintBucket,
    Pencil,
    Redo2,
    Trash2,
    Undo2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { DrawingColors, DrawingSizes } from '@/lib/games/drawing';
import type { DrawingColor, DrawingSize } from '@/lib/games/types';
import { cn } from '@/lib/utils';
import type { CanvasTool } from './drawing-canvas';

const ConfirmClearMs = 3000;

export type DrawingToolbarProps = {
    tool: CanvasTool;
    color: DrawingColor;
    size: DrawingSize;
    canUndo: boolean;
    /** The drawer undid something since their last stroke (spec §6.15). */
    canRedo: boolean;
    /** On a phone: larger keys, and the colours in a popover. */
    compact?: boolean;
    onTool: (tool: CanvasTool) => void;
    onColor: (color: DrawingColor) => void;
    onSize: (size: DrawingSize) => void;
    onUndo: () => void;
    onRedo: () => void;
    onClear: () => void;
    className?: string;
};

/**
 * The stroke is the canvas literal of `lib/games/drawing.ts`, on a sheet that
 * is white in both themes. The swatches stand in a `.light` scope, on a chip
 * in the colour of the sheet, so each shows the ink it draws in a dark theme too.
 */
const swatchClasses: Partial<Record<DrawingColor, string>> = {
    black: 'bg-foreground',
    sun: 'bg-skrum-col-sun-text',
    apricot: 'bg-skrum-col-apricot-text',
    coral: 'bg-skrum-col-coral-text',
    plum: 'bg-skrum-col-plum-text',
    iris: 'bg-skrum-col-iris-text',
    sky: 'bg-skrum-col-sky-text',
    lagoon: 'bg-skrum-col-lagoon-text',
    moss: 'bg-skrum-col-moss-text',
};

const dotClasses: Record<DrawingSize, string> = {
    4: 'size-1',
    10: 'size-2',
    24: 'size-3',
};

const focusClass =
    'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const activeClass =
    'bg-skrum-primary-soft text-skrum-primary-text ring-1 ring-primary ring-inset';

function isApple(): boolean {
    if (typeof navigator === 'undefined') {
        return false;
    }

    return /mac|iphone|ipad/i.test(navigator.userAgent);
}

function modifierKey(): string {
    return isApple() ? '⌘' : 'Ctrl';
}

/** ⌘⇧Z on a Mac, Ctrl+Y elsewhere: the redo key each system teaches. */
function redoShortcut(): string[] {
    return isApple() ? ['⌘', '⇧', 'Z'] : ['Ctrl', 'Y'];
}

function Separator() {
    return <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />;
}

type ToolKeyProps = {
    label: string;
    pressed?: boolean;
    disabled?: boolean;
    compact: boolean;
    /** Shown in the tooltip, and in the corner of the key when it is one letter. */
    shortcut?: string[];
    keyShortcuts?: string;
    onClick: () => void;
    children: ReactNode;
};

function ToolKey({
    label,
    pressed,
    disabled = false,
    compact,
    shortcut,
    keyShortcuts,
    onClick,
    children,
}: ToolKeyProps) {
    const corner = shortcut?.length === 1 ? shortcut[0] : null;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label={label}
                    aria-pressed={pressed}
                    aria-keyshortcuts={keyShortcuts}
                    disabled={disabled}
                    onClick={onClick}
                    className={cn(
                        'relative grid shrink-0 place-items-center rounded-md text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
                        compact ? 'size-11' : 'size-9',
                        focusClass,
                        pressed && activeClass,
                        pressed && 'hover:bg-skrum-primary-soft',
                    )}
                >
                    {children}
                    {corner !== null && (
                        <span
                            aria-hidden
                            className="absolute right-0.5 bottom-px font-mono text-overline leading-none tracking-normal text-muted-foreground"
                        >
                            {corner}
                        </span>
                    )}
                </button>
            </TooltipTrigger>
            <TooltipContent shortcut={shortcut}>{label}</TooltipContent>
        </Tooltip>
    );
}

export function DrawingToolbar({
    tool,
    color,
    size,
    canUndo,
    canRedo,
    compact = false,
    onTool,
    onColor,
    onSize,
    onUndo,
    onRedo,
    onClear,
    className,
}: DrawingToolbarProps) {
    const { t } = useTrans();
    const [confirmingClear, setConfirmingClear] = useState(false);
    const [colorsOpen, setColorsOpen] = useState(false);
    const sizeRefs = useRef<
        Partial<Record<DrawingSize, HTMLButtonElement | null>>
    >({});

    useEffect(() => {
        if (!confirmingClear) {
            return;
        }

        const timeout = window.setTimeout(
            () => setConfirmingClear(false),
            ConfirmClearMs,
        );

        return () => window.clearTimeout(timeout);
    }, [confirmingClear]);

    const colorNames: Record<DrawingColor, string> = {
        black: t('Ink'),
        red: t('Red'),
        orange: t('Orange'),
        green: t('Green'),
        blue: t('Blue'),
        purple: t('Purple'),
        sun: t('Sun'),
        apricot: t('Apricot'),
        coral: t('Coral'),
        plum: t('Plum'),
        iris: t('Iris'),
        sky: t('Sky'),
        lagoon: t('Lagoon'),
        moss: t('Moss'),
        white: t('White'),
    };

    const sizeNames: Record<DrawingSize, string> = {
        4: t('Stroke: Thin'),
        10: t('Stroke: Medium'),
        24: t('Stroke: Thick'),
    };

    const pickColor = (next: DrawingColor) => {
        onColor(next);
        setColorsOpen(false);

        if (tool === 'eraser') {
            onTool('pen');
        }
    };

    const moveSize = (event: KeyboardEvent<HTMLButtonElement>) => {
        const index = DrawingSizes.indexOf(size);
        const last = DrawingSizes.length - 1;
        let next: number | null = null;

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            next = index >= last ? 0 : index + 1;
        }

        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            next = index <= 0 ? last : index - 1;
        }

        if (next === null) {
            return;
        }

        event.preventDefault();
        onSize(DrawingSizes[next]);
        sizeRefs.current[DrawingSizes[next]]?.focus();
    };

    const swatches = DrawingColors.map((option) => (
        <button
            key={option}
            type="button"
            data-color={option}
            aria-label={colorNames[option]}
            aria-pressed={color === option}
            title={colorNames[option]}
            onClick={() => pickColor(option)}
            className={cn(
                'grid shrink-0 place-items-center rounded-full',
                compact ? 'size-11' : 'size-7',
                focusClass,
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'size-5 rounded-full ring-1 ring-foreground/15 ring-inset',
                    swatchClasses[option],
                    color === option &&
                        'outline-2 outline-offset-2 outline-ring',
                )}
            />
        </button>
    ));

    return (
        <div
            role="toolbar"
            aria-label={t('Drawing tools')}
            data-slot="drawing-toolbar"
            className={cn(
                'inline-flex max-w-full shrink-0 flex-wrap items-center justify-center gap-0.5 rounded-xl border bg-popover p-1 shadow-raised',
                className,
            )}
        >
            <ToolKey
                label={t('Pencil')}
                pressed={tool === 'pen'}
                compact={compact}
                shortcut={['P']}
                keyShortcuts="P"
                onClick={() => onTool('pen')}
            >
                <Pencil aria-hidden />
            </ToolKey>
            <ToolKey
                label={t('Eraser')}
                pressed={tool === 'eraser'}
                compact={compact}
                shortcut={['E']}
                keyShortcuts="E"
                onClick={() => onTool('eraser')}
            >
                <Eraser aria-hidden />
            </ToolKey>
            <ToolKey
                label={t('Fill')}
                pressed={tool === 'fill'}
                compact={compact}
                onClick={() => onTool('fill')}
            >
                <PaintBucket aria-hidden />
            </ToolKey>
            <Separator />
            <div
                role="radiogroup"
                aria-label={t('Stroke')}
                className="flex items-center gap-0.5"
            >
                {DrawingSizes.map((option) => (
                    <button
                        key={option}
                        ref={(node) => {
                            sizeRefs.current[option] = node;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={size === option}
                        aria-label={sizeNames[option]}
                        title={sizeNames[option]}
                        tabIndex={size === option ? 0 : -1}
                        onClick={() => onSize(option)}
                        onKeyDown={moveSize}
                        className={cn(
                            'grid shrink-0 place-items-center rounded-md hover:bg-muted',
                            compact ? 'size-11' : 'h-9 w-8',
                            focusClass,
                            size === option && activeClass,
                            size === option && 'hover:bg-skrum-primary-soft',
                        )}
                    >
                        <span
                            aria-hidden
                            className={cn(
                                'rounded-full bg-foreground',
                                dotClasses[option],
                            )}
                        />
                    </button>
                ))}
            </div>
            <Separator />
            {compact ? (
                <Popover open={colorsOpen} onOpenChange={setColorsOpen}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            data-color={color}
                            aria-label={t('Ink colour: :color', {
                                color: colorNames[color],
                            })}
                            className={cn(
                                'light grid size-11 shrink-0 place-items-center rounded-full',
                                focusClass,
                            )}
                        >
                            <span
                                aria-hidden
                                className="grid size-9 place-items-center rounded-full bg-card"
                            >
                                <span
                                    className={cn(
                                        'size-6 rounded-full ring-1 ring-foreground/15 ring-inset',
                                        swatchClasses[color],
                                    )}
                                />
                            </span>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        side="top"
                        aria-label={t('Ink colour')}
                        className="light grid grid-cols-[repeat(3,auto)] gap-1 bg-card p-2"
                    >
                        {swatches}
                    </PopoverContent>
                </Popover>
            ) : (
                <div
                    data-slot="drawing-swatches"
                    className="light flex items-center rounded-full bg-card px-0.5"
                >
                    {swatches}
                </div>
            )}
            <Separator />
            <ToolKey
                label={t('Undo')}
                disabled={!canUndo}
                compact={compact}
                shortcut={[modifierKey(), 'Z']}
                keyShortcuts="Meta+Z Control+Z"
                onClick={onUndo}
            >
                <Undo2 aria-hidden />
            </ToolKey>
            <ToolKey
                label={t('Redo')}
                disabled={!canRedo}
                compact={compact}
                shortcut={redoShortcut()}
                keyShortcuts="Meta+Shift+Z Control+Y"
                onClick={onRedo}
            >
                <Redo2 aria-hidden />
            </ToolKey>
            <Button
                type="button"
                size="sm"
                variant={confirmingClear ? 'destructive' : 'ghost'}
                disabled={!canUndo}
                className={cn('min-w-0', compact && 'h-11')}
                onClick={() => {
                    if (!confirmingClear) {
                        setConfirmingClear(true);

                        return;
                    }

                    setConfirmingClear(false);
                    onClear();
                }}
            >
                <Trash2 aria-hidden />
                <span className="truncate">
                    {confirmingClear ? t('Click again to clear') : t('Clear')}
                </span>
            </Button>
        </div>
    );
}
