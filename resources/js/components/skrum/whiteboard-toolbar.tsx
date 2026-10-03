import type { LucideIcon } from 'lucide-react';
import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';
import { Separator } from '@/components/ui/separator';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { PostItColors } from '@/lib/whiteboard/palette';
import type { PostItColor } from '@/lib/whiteboard/palette';
import { cn } from '@/lib/utils';

export type WhiteboardColorBarProps = {
    /** Null when the current fill is none of the eight: no radio is checked. */
    value: PostItColor | null;
    onChange: (color: PostItColor) => void;
    /** A press on a colour (pointer, Enter or Space), not a move with the arrow keys. */
    onActivate?: (color: PostItColor) => void;
    orientation?: 'horizontal' | 'vertical';
    disabled?: boolean;
    /** The id of what says why the colours are disabled. */
    describedBy?: string;
    className?: string;
};

const swatchClasses: Record<PostItColor, string> = {
    sun: 'bg-skrum-col-sun border-skrum-col-sun-border',
    apricot: 'bg-skrum-col-apricot border-skrum-col-apricot-border',
    coral: 'bg-skrum-col-coral border-skrum-col-coral-border',
    plum: 'bg-skrum-col-plum border-skrum-col-plum-border',
    iris: 'bg-skrum-col-iris border-skrum-col-iris-border',
    sky: 'bg-skrum-col-sky border-skrum-col-sky-border',
    lagoon: 'bg-skrum-col-lagoon border-skrum-col-lagoon-border',
    moss: 'bg-skrum-col-moss border-skrum-col-moss-border',
};

export function useColorNames(): Record<PostItColor, string> {
    const { t } = useTrans();

    return {
        sun: t('Sun'),
        apricot: t('Apricot'),
        coral: t('Coral'),
        plum: t('Plum'),
        iris: t('Iris'),
        sky: t('Sky'),
        lagoon: t('Lagoon'),
        moss: t('Moss'),
    };
}

export function WhiteboardColorBar({
    value,
    onChange,
    onActivate,
    orientation = 'horizontal',
    disabled = false,
    describedBy,
    className,
}: WhiteboardColorBarProps) {
    const { t } = useTrans();
    const names = useColorNames();
    const refs = useRef<Partial<Record<PostItColor, HTMLButtonElement | null>>>(
        {},
    );
    const isVertical = orientation === 'vertical';

    const move = (event: KeyboardEvent<HTMLButtonElement>): void => {
        const forwardKey = isVertical ? 'ArrowDown' : 'ArrowRight';
        const backwardKey = isVertical ? 'ArrowUp' : 'ArrowLeft';
        const last = PostItColors.length - 1;
        const index = value === null ? 0 : PostItColors.indexOf(value);
        let next: number | null = null;

        if (event.key === forwardKey || event.key === 'ArrowDown') {
            next = index >= last ? 0 : index + 1;
        }

        if (event.key === backwardKey || event.key === 'ArrowUp') {
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
        const color = PostItColors[next];
        onChange(color);
        refs.current[color]?.focus();
    };

    return (
        <div
            data-slot="whiteboard-color-bar"
            role="radiogroup"
            aria-label={t('Fill colour')}
            aria-orientation={orientation}
            aria-describedby={describedBy}
            className={cn(
                'inline-flex max-w-full items-center gap-1 rounded-xl border border-border bg-popover p-1 shadow-raised',
                isVertical ? 'flex-col' : 'flex-wrap',
                disabled && 'opacity-50',
                className,
            )}
        >
            {PostItColors.map((color) => {
                const isActive = color === value;
                const isTabStop = color === (value ?? PostItColors[0]);

                return (
                    <button
                        key={color}
                        ref={(node) => {
                            refs.current[color] = node;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-label={names[color]}
                        title={names[color]}
                        disabled={disabled}
                        tabIndex={isTabStop ? 0 : -1}
                        data-color={color}
                        onClick={() => {
                            onChange(color);
                            onActivate?.(color);
                        }}
                        onKeyDown={move}
                        className="flex size-8 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover disabled:pointer-events-none"
                    >
                        <span
                            aria-hidden
                            className={cn(
                                'size-6 rounded-full border-2',
                                swatchClasses[color],
                                isActive &&
                                    'ring-2 ring-primary ring-offset-2 ring-offset-popover',
                            )}
                        />
                    </button>
                );
            })}
        </div>
    );
}

export type ToolbarItem = {
    id: string;
    /** The tool's name: its accessible name and the text of its tooltip. */
    label: string;
    icon: LucideIcon;
    /** Shown in the corner (hidden from assistive technology), in the tooltip and as aria-keyshortcuts. */
    shortcut?: string;
    /** aria-pressed; left undefined for a plain button (Undo, "More tools"). */
    pressed?: boolean;
    disabled?: boolean;
    onPress: () => void;
};

export type WhiteboardToolbarProps = {
    /** Accessible name of the toolbar. */
    label: string;
    /** A separator is drawn between two groups. */
    groups: readonly (readonly ToolbarItem[])[];
    orientation?: 'vertical' | 'horizontal';
    /** 2.25rem tools; 2.75rem on a phone (MobileRituals). */
    size?: 'default' | 'touch';
    /** Content after the items, inside the roving order when it carries data-roving-item. */
    trailing?: ReactNode;
    className?: string;
};

const trailingKey = 'trailing';

const rovingKeys = {
    vertical: { forward: 'ArrowDown', backward: 'ArrowUp' },
    horizontal: { forward: 'ArrowRight', backward: 'ArrowLeft' },
} as const;

/**
 * Roving focus of a whiteboard bar: the arrows of its orientation move between its [data-roving-item]
 * elements, wrapping and skipping disabled ones; Home and End go to the ends.
 */
export function moveToolbarFocus(
    event: KeyboardEvent<HTMLElement>,
    orientation: 'vertical' | 'horizontal',
): void {
    const root = event.currentTarget;
    const target = event.target as HTMLElement;

    if (!target.hasAttribute('data-roving-item')) {
        return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
    }

    const reachable = Array.from(
        root.querySelectorAll<HTMLElement>('[data-roving-item]'),
    ).filter(
        (element) =>
            !element.hasAttribute('disabled') &&
            element.getAttribute('aria-disabled') !== 'true',
    );
    const index = reachable.indexOf(target);
    const last = reachable.length - 1;
    const { forward, backward } = rovingKeys[orientation];
    let next: number | null = null;

    if (event.key === forward) {
        next = index >= last ? 0 : index + 1;
    }

    if (event.key === backward) {
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
    reachable[next]?.focus();
}

function defaultTabStop(items: readonly ToolbarItem[]): string | null {
    const pressed = items.find((item) => item.pressed && !item.disabled);

    if (pressed) {
        return pressed.id;
    }

    return items.find((item) => !item.disabled)?.id ?? null;
}

export function WhiteboardToolbar({
    label,
    groups,
    orientation = 'vertical',
    size = 'default',
    trailing,
    className,
}: WhiteboardToolbarProps): ReactElement {
    const rootRef = useRef<HTMLDivElement>(null);
    const [focusedKey, setFocusedKey] = useState<string | null>(null);
    const isVertical = orientation === 'vertical';
    const items = groups.flat();
    const focusedItemIsUsable =
        focusedKey === trailingKey ||
        items.some((item) => item.id === focusedKey && !item.disabled);
    const tabStop = focusedItemIsUsable
        ? focusedKey
        : (defaultTabStop(items) ?? trailingKey);

    useLayoutEffect(() => {
        rootRef.current
            ?.querySelectorAll<HTMLElement>(
                '[data-roving-item]:not([data-toolbar-item])',
            )
            .forEach((element) => {
                element.tabIndex = tabStop === trailingKey ? 0 : -1;
            });
    });

    const rememberFocus = (target: EventTarget): void => {
        if (!(target instanceof HTMLElement)) {
            return;
        }

        if (!target.hasAttribute('data-roving-item')) {
            return;
        }

        setFocusedKey(target.dataset.toolbarItem ?? trailingKey);
    };

    return (
        <div
            ref={rootRef}
            data-slot="whiteboard-toolbar"
            role="toolbar"
            aria-label={label}
            aria-orientation={orientation}
            onKeyDown={(event) => moveToolbarFocus(event, orientation)}
            onFocus={(event) => rememberFocus(event.target)}
            className={cn(
                'inline-flex items-center gap-0.5 rounded-xl border border-border bg-popover p-1 shadow-raised',
                isVertical && 'flex-col',
                className,
            )}
        >
            {groups.map((group, groupIndex) => (
                <Fragment key={group[0]?.id ?? groupIndex}>
                    {groupIndex > 0 && (
                        <Separator
                            data-slot="whiteboard-toolbar-separator"
                            orientation={isVertical ? 'horizontal' : 'vertical'}
                            className={cn(
                                isVertical
                                    ? 'mx-auto my-1 data-[orientation=horizontal]:w-6'
                                    : 'mx-1 self-stretch data-[orientation=vertical]:h-auto',
                            )}
                        />
                    )}
                    {group.map((item) => (
                        <WhiteboardToolButton
                            key={item.id}
                            item={item}
                            size={size}
                            tooltipSide={isVertical ? 'right' : 'top'}
                            tabIndex={item.id === tabStop ? 0 : -1}
                        />
                    ))}
                </Fragment>
            ))}
            {trailing}
        </div>
    );
}

/** One tool of a whiteboard bar (sk-tool): the icon, the key in the corner, the tooltip with the label and the key. */
export function WhiteboardToolButton({
    item,
    size,
    tooltipSide,
    tabIndex,
}: {
    item: ToolbarItem;
    size: 'default' | 'touch';
    tooltipSide: 'right' | 'top';
    tabIndex: number;
}): ReactElement {
    const Icon = item.icon;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    data-slot="whiteboard-tool"
                    data-roving-item=""
                    data-toolbar-item={item.id}
                    aria-label={item.label}
                    aria-pressed={item.pressed}
                    aria-keyshortcuts={item.shortcut}
                    disabled={item.disabled}
                    tabIndex={tabIndex}
                    onClick={item.onPress}
                    className={cn(
                        'relative grid shrink-0 place-items-center rounded-md text-foreground outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
                        size === 'touch' ? 'size-11' : 'size-9',
                        item.pressed &&
                            'bg-skrum-primary-soft text-skrum-primary-text ring-1 ring-primary ring-inset hover:bg-skrum-primary-soft',
                    )}
                >
                    <Icon aria-hidden className="size-4.5" />
                    {item.shortcut && (
                        <span
                            data-slot="whiteboard-tool-key"
                            aria-hidden="true"
                            className="absolute right-0.75 bottom-px font-mono text-3xs font-bold text-muted-foreground"
                        >
                            {item.shortcut}
                        </span>
                    )}
                </button>
            </TooltipTrigger>
            <TooltipContent
                side={tooltipSide}
                shortcut={item.shortcut ? [item.shortcut] : undefined}
            >
                {item.label}
            </TooltipContent>
        </Tooltip>
    );
}

/**
 * The sub-bar of a tool, beside it: a labelled toolbar holding radios (shapes, connectors) and/or a WhiteboardColorBar.
 * It is the pill of the mockup (sk-wbbar wb-sub): a colour bar inside it drops its own pill through its className.
 */
export function WhiteboardSubBar({
    label,
    children,
    className,
}: {
    label: string;
    children: ReactNode;
    className?: string;
}): ReactElement {
    return (
        <div
            data-slot="whiteboard-sub-bar"
            role="toolbar"
            aria-label={label}
            className={cn(
                'inline-flex items-center gap-0.5 rounded-xl border border-border bg-popover p-1 shadow-raised',
                className,
            )}
        >
            {children}
        </div>
    );
}
