import {
    AlignEndHorizontal,
    AlignEndVertical,
    AlignHorizontalDistributeCenter,
    AlignHorizontalSpaceAround,
    AlignStartHorizontal,
    AlignStartVertical,
    AlignVerticalSpaceAround,
    Group,
    Lock,
    LockOpen,
    Palette,
    Trash2,
    Ungroup,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import {
    WhiteboardColorBar,
    WhiteboardToolButton,
    moveToolbarFocus,
} from '@/components/skrum/whiteboard-toolbar';
import type { ToolbarItem } from '@/components/skrum/whiteboard-toolbar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import type { PostItColor } from '@/lib/whiteboard/palette';
import { cn } from '@/lib/utils';

export type AlignCommand =
    | 'alignLeft'
    | 'alignRight'
    | 'alignTop'
    | 'alignBottom'
    | 'distributeHorizontally'
    | 'distributeVertically';

export type WhiteboardSelectionBarProps = {
    /** Absent: nothing selected has a fill, so no colours. */
    colour?: {
        value: PostItColor | null;
        onChange: (color: PostItColor) => void;
        disabled?: boolean;
        /** Why the colours are disabled, told to a screen reader. */
        reason?: string;
    };
    /** Null: the selection is neither two ungrouped elements nor one group. */
    group: {
        kind: 'group' | 'ungroup';
        onPress: () => void;
        disabled?: boolean;
    } | null;
    /** Null: fewer than two elements, nothing to align. */
    align: {
        enabled: boolean;
        /** Three elements or more. */
        distribute: boolean;
        onCommand: (command: AlignCommand) => void;
    } | null;
    /** The facilitator only. */
    lock?: { locked: boolean; onPress: () => void };
    styles: { shown: boolean; onToggle: () => void; disabled?: boolean };
    remove: { onPress: () => void; disabled?: boolean; reason?: string };
    /** Left and top from selectionBarPlacement. */
    style?: CSSProperties;
    /** The measured box, once mounted and on every resize. */
    onSize?: (size: BarSize) => void;
};

export type WhiteboardLockedBarProps = {
    onUnlock: () => void;
    /** Who does not facilitate cannot unlock. */
    disabled?: boolean;
    /** Why Unlock is off, shown in the bar. */
    reason?: string;
    style?: CSSProperties;
    onSize?: (size: BarSize) => void;
};

const alignKey = 'align';
const removeKey = 'remove';

type BarSize = { width: number; height: number };

/** The measured box of a bar, once mounted and on every resize. */
function useReportedSize(
    root: RefObject<HTMLElement | null>,
    onSize?: (size: BarSize) => void,
): void {
    const reportSize = useRef(onSize);

    useLayoutEffect(() => {
        reportSize.current = onSize;
    });

    useLayoutEffect(() => {
        const bar = root.current;

        if (!bar) {
            return;
        }

        const measure = (): void => {
            const box = bar.getBoundingClientRect();

            reportSize.current?.({ width: box.width, height: box.height });
        };

        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(bar);

        return () => observer.disconnect();
    }, [root]);
}

const toolClasses =
    'relative grid size-9 shrink-0 place-items-center rounded-md outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50';

/**
 * The bar of a selection on the whiteboard (the "Sélection" bar of ScreenWhiteboard): the fill colours,
 * then Group or Ungroup, Align, Lock, Styles and Delete.
 */
export function WhiteboardSelectionBar({
    colour,
    group,
    align,
    lock,
    styles,
    remove,
    style,
    onSize,
}: WhiteboardSelectionBarProps): ReactElement {
    const { t } = useTrans();
    const rootRef = useRef<HTMLDivElement>(null);
    const [focusedKey, setFocusedKey] = useState<string | null>(null);
    const colourReasonId = useId();
    const blockedReasonsId = useId();
    const describesColourReason =
        colour?.disabled === true && colour.reason !== undefined;

    useReportedSize(rootRef, onSize);

    const groupItem: ToolbarItem | null =
        group === null
            ? null
            : {
                  id: group.kind,
                  label: group.kind === 'group' ? t('Group') : t('Ungroup'),
                  icon: group.kind === 'group' ? Group : Ungroup,
                  disabled: group.disabled,
                  onPress: group.onPress,
              };
    const lockItem: ToolbarItem | null = lock
        ? {
              id: 'lock',
              label: t('Lock'),
              icon: lock.locked ? LockOpen : Lock,
              pressed: lock.locked,
              onPress: lock.onPress,
          }
        : null;
    const stylesItem: ToolbarItem = {
        id: 'styles',
        label: t('Styles'),
        icon: Palette,
        pressed: styles.shown,
        disabled: styles.disabled,
        onPress: styles.onToggle,
    };

    const usableKeys = [
        groupItem?.disabled ? null : (groupItem?.id ?? null),
        align?.enabled ? alignKey : null,
        lockItem?.id ?? null,
        styles.disabled ? null : stylesItem.id,
        remove.disabled ? null : removeKey,
    ].filter((key): key is string => key !== null);
    const tabStop =
        focusedKey !== null && usableKeys.includes(focusedKey)
            ? focusedKey
            : usableKeys[0];
    const tabIndexOf = (key: string): number => (key === tabStop ? 0 : -1);
    const blockedReasons = [
        ...new Set(
            [
                colour?.disabled === true ? colour.reason : undefined,
                remove.disabled === true ? remove.reason : undefined,
            ].filter((reason): reason is string => reason !== undefined),
        ),
    ];

    return (
        <div
            ref={rootRef}
            data-slot="whiteboard-selection-bar"
            role="toolbar"
            aria-label={t('Selection')}
            aria-orientation="horizontal"
            aria-describedby={
                blockedReasons.length > 0 ? blockedReasonsId : undefined
            }
            style={style}
            onKeyDown={(event) => moveToolbarFocus(event, 'horizontal')}
            onFocus={(event) => {
                const key =
                    event.target.dataset.selectionItem ??
                    event.target.dataset.toolbarItem;

                if (key !== undefined) {
                    setFocusedKey(key);
                }
            }}
            className={cn(
                'inline-flex flex-wrap items-center justify-center gap-0.5 rounded-xl border border-border bg-popover p-1 text-foreground shadow-raised',
                style && 'absolute z-10',
            )}
        >
            {colour && (
                <>
                    <WhiteboardColorBar
                        value={colour.value}
                        onChange={colour.onChange}
                        disabled={colour.disabled}
                        describedBy={
                            describesColourReason ? colourReasonId : undefined
                        }
                        className="justify-center border-0 bg-transparent p-0 shadow-none"
                    />
                    {describesColourReason && (
                        <span id={colourReasonId} className="sr-only">
                            {colour.reason}
                        </span>
                    )}
                    <Separator
                        data-slot="whiteboard-toolbar-separator"
                        orientation="vertical"
                        className="mx-0.5 my-1 self-stretch data-[orientation=vertical]:h-auto"
                    />
                </>
            )}
            {groupItem && (
                <SelectionTool
                    item={groupItem}
                    tabIndex={tabIndexOf(groupItem.id)}
                />
            )}
            {align && (
                <AlignMenu align={align} tabIndex={tabIndexOf(alignKey)} />
            )}
            {lockItem && (
                <SelectionTool
                    item={lockItem}
                    tabIndex={tabIndexOf(lockItem.id)}
                />
            )}
            <SelectionTool
                item={stylesItem}
                tabIndex={tabIndexOf(stylesItem.id)}
            />
            <DeleteButton remove={remove} tabIndex={tabIndexOf(removeKey)} />
            {blockedReasons.length > 0 && (
                <span id={blockedReasonsId} className="sr-only">
                    {blockedReasons.join(' ')}
                </span>
            )}
        </div>
    );
}

function SelectionTool({
    item,
    tabIndex,
}: {
    item: ToolbarItem;
    tabIndex: number;
}): ReactElement {
    return (
        <WhiteboardToolButton
            item={item}
            size="default"
            tooltipSide="top"
            tabIndex={tabIndex}
        />
    );
}

function AlignMenu({
    align,
    tabIndex,
}: {
    align: NonNullable<WhiteboardSelectionBarProps['align']>;
    tabIndex: number;
}): ReactElement {
    const { t } = useTrans();
    const label = t('Align');
    const commands: readonly {
        command: AlignCommand;
        label: string;
        icon: LucideIcon;
        distributes: boolean;
    }[] = [
        {
            command: 'alignLeft',
            label: t('Align left'),
            icon: AlignStartVertical,
            distributes: false,
        },
        {
            command: 'alignRight',
            label: t('Align right'),
            icon: AlignEndVertical,
            distributes: false,
        },
        {
            command: 'alignTop',
            label: t('Align top'),
            icon: AlignStartHorizontal,
            distributes: false,
        },
        {
            command: 'alignBottom',
            label: t('Align bottom'),
            icon: AlignEndHorizontal,
            distributes: false,
        },
        {
            command: 'distributeHorizontally',
            label: t('Distribute horizontally'),
            icon: AlignHorizontalSpaceAround,
            distributes: true,
        },
        {
            command: 'distributeVertically',
            label: t('Distribute vertically'),
            icon: AlignVerticalSpaceAround,
            distributes: true,
        },
    ];

    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            data-slot="whiteboard-tool"
                            data-roving-item=""
                            data-selection-item={alignKey}
                            aria-label={label}
                            disabled={!align.enabled}
                            tabIndex={tabIndex}
                            className={cn(
                                toolClasses,
                                'text-foreground data-[state=open]:bg-accent',
                            )}
                        >
                            <AlignHorizontalDistributeCenter
                                aria-hidden
                                className="size-4.5"
                            />
                        </button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">{label}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="top" align="center">
                {commands.map(
                    ({
                        command,
                        label: commandLabel,
                        icon: Icon,
                        distributes,
                    }) => (
                        <DropdownMenuItem
                            key={command}
                            disabled={distributes && !align.distribute}
                            onSelect={() => align.onCommand(command)}
                        >
                            <Icon aria-hidden />
                            {commandLabel}
                        </DropdownMenuItem>
                    ),
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function DeleteButton({
    remove,
    tabIndex,
}: {
    remove: WhiteboardSelectionBarProps['remove'];
    tabIndex: number;
}): ReactElement {
    const { t } = useTrans();
    const reasonId = useId();
    const label = t('Delete');
    const describesReason =
        remove.disabled === true && remove.reason !== undefined;

    return (
        <>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        data-slot="whiteboard-tool"
                        data-roving-item=""
                        data-selection-item={removeKey}
                        aria-label={label}
                        aria-describedby={
                            describesReason ? reasonId : undefined
                        }
                        disabled={remove.disabled}
                        tabIndex={tabIndex}
                        onClick={remove.onPress}
                        className={cn(
                            toolClasses,
                            'text-skrum-destructive-text',
                        )}
                    >
                        <Trash2 aria-hidden className="size-4.5" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top">{label}</TooltipContent>
            </Tooltip>
            {describesReason && (
                <span id={reasonId} className="sr-only">
                    {remove.reason}
                </span>
            )}
        </>
    );
}

/**
 * The bar of a locked element that was clicked: it says "Locked" and offers
 * the one thing that can be done to it.
 */
export function WhiteboardLockedBar({
    onUnlock,
    disabled = false,
    reason,
    style,
    onSize,
}: WhiteboardLockedBarProps): ReactElement {
    const { t } = useTrans();
    const rootRef = useRef<HTMLDivElement>(null);
    const reasonId = useId();
    const describesReason = disabled && reason !== undefined;

    useReportedSize(rootRef, onSize);

    return (
        <div
            ref={rootRef}
            data-slot="whiteboard-selection-bar"
            data-locked=""
            role="toolbar"
            aria-label={t('Selection')}
            style={style}
            className={cn(
                'inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-border bg-popover py-1 pr-1 pl-3 text-foreground shadow-raised',
                style && 'absolute z-10',
            )}
        >
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                <Lock aria-hidden className="size-4 text-muted-foreground" />
                {t('Locked')}
            </span>
            {describesReason && (
                <span id={reasonId} className="text-xs text-muted-foreground">
                    {reason}
                </span>
            )}
            <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                aria-describedby={describesReason ? reasonId : undefined}
                onClick={onUnlock}
            >
                <LockOpen aria-hidden />
                {t('Unlock')}
            </Button>
        </div>
    );
}

/** The mark of a locked element, centred on the point its style gives (the element's top right corner). */
export function WhiteboardLockMark({
    style,
}: {
    style: CSSProperties;
}): ReactElement {
    return (
        <span
            data-slot="whiteboard-lock-mark"
            aria-hidden="true"
            style={style}
            className="pointer-events-none absolute z-1 grid size-4.5 -translate-1/2 place-items-center rounded-full border border-border bg-popover text-muted-foreground"
        >
            <Lock className="size-2.5" />
        </span>
    );
}

/** The chip on the top-left corner of the selection (wb-selcount): "1 element", ":count elements". */
export function WhiteboardSelectionCount({
    count,
    style,
}: {
    count: number;
    style?: CSSProperties;
}): ReactElement {
    const { t } = useTrans();

    return (
        <span
            data-slot="whiteboard-selection-count"
            style={style}
            className={cn(
                'pointer-events-none truncate rounded-xs bg-ring px-1.75 text-2xs leading-4.5 font-bold whitespace-nowrap text-primary-foreground',
                style && 'absolute z-10',
            )}
        >
            {count === 1 ? t('1 element') : t(':count elements', { count })}
        </span>
    );
}
