import { Ellipsis } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export type FacilitatorActionTone = 'default' | 'primary' | 'destructive';

export type FacilitatorAction = {
    id: string;
    label: string;
    icon: LucideIcon;
    onSelect: () => void;
    pressed?: boolean;
    disabled?: boolean;
    disabledReason?: string;
    shortcut?: string;
    /** The same key as `aria-keyshortcuts` writes it ("Meta+ArrowRight"), when `shortcut` is a glyph. */
    ariaKeyShortcuts?: string;
    tone?: FacilitatorActionTone;
    kind?: 'button' | 'toggle';
    /** `end` puts the icon after the label, as the arrow of "next phase". */
    iconPosition?: 'start' | 'end';
};

export type FacilitatorBarProps = {
    actions: FacilitatorAction[];
    start?: ReactNode;
    primary?: FacilitatorAction;
    /** Actions after the main button, such as moving on to the next item. */
    trailing?: FacilitatorAction[];
    end?: ReactNode;
    compact?: boolean;
    /** Accessible name of the toolbar; "Facilitation tools" by default. */
    label?: string;
    className?: string;
};

const compactInlineCount = 2;
const moreKey = 'more';

function toneClasses(action: FacilitatorAction): string {
    if (action.tone === 'destructive') {
        return 'text-skrum-destructive-text hover:bg-skrum-destructive-soft hover:text-skrum-destructive-text';
    }

    if (action.pressed) {
        return 'bg-skrum-primary-soft text-skrum-primary-text hover:bg-skrum-primary-soft';
    }

    if (action.tone === 'primary') {
        return 'text-skrum-primary-text';
    }

    return '';
}

function tooltipText(action: FacilitatorAction): string {
    const base = action.shortcut
        ? `${action.label} (${action.shortcut})`
        : action.label;

    return action.disabled && action.disabledReason
        ? `${base}: ${action.disabledReason}`
        : base;
}

type ActionButtonProps = {
    action: FacilitatorAction;
    iconOnly: boolean;
    isPrimary?: boolean;
    tabIndex: number;
    rovingKey: string;
    onRovingFocus: (key: string) => void;
};

function ActionButton({
    action,
    iconOnly,
    isPrimary = false,
    tabIndex,
    rovingKey,
    onRovingFocus,
}: ActionButtonProps) {
    const Icon = action.icon;
    const reasonId = useId();
    const hasReason = action.disabled && Boolean(action.disabledReason);
    const showLabel = !iconOnly || isPrimary;
    const iconAfter = showLabel && action.iconPosition === 'end';

    const select = (): void => {
        if (action.disabled) {
            return;
        }

        action.onSelect();
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    data-slot="facilitator-action"
                    data-roving-item=""
                    data-action-id={action.id}
                    variant={isPrimary ? 'default' : 'ghost'}
                    size={showLabel ? 'sm' : 'icon-sm'}
                    tabIndex={tabIndex}
                    aria-label={action.label}
                    aria-pressed={
                        action.kind === 'toggle'
                            ? Boolean(action.pressed)
                            : undefined
                    }
                    aria-disabled={action.disabled || undefined}
                    aria-describedby={hasReason ? reasonId : undefined}
                    aria-keyshortcuts={
                        action.ariaKeyShortcuts ?? action.shortcut
                    }
                    onFocus={() => onRovingFocus(rovingKey)}
                    onClick={select}
                    className={cn(
                        'min-w-0 shrink',
                        showLabel && 'max-w-48',
                        !isPrimary && toneClasses(action),
                        action.disabled && 'cursor-not-allowed opacity-50',
                    )}
                >
                    {!iconAfter && <Icon aria-hidden />}
                    {showLabel && (
                        <span className="truncate">{action.label}</span>
                    )}
                    {iconAfter && <Icon aria-hidden />}
                    {hasReason && (
                        <span id={reasonId} className="sr-only">
                            {action.disabledReason}
                        </span>
                    )}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{tooltipText(action)}</TooltipContent>
        </Tooltip>
    );
}

function MoreMenu({
    actions,
    tabIndex,
    onRovingFocus,
}: {
    actions: FacilitatorAction[];
    tabIndex: number;
    onRovingFocus: (key: string) => void;
}) {
    const { t } = useTrans();
    const label = t('More');
    const destructive = actions.filter(
        (action) => action.tone === 'destructive',
    );
    const regular = actions.filter((action) => action.tone !== 'destructive');

    const renderItem = (action: FacilitatorAction) => {
        const Icon = action.icon;
        const content = (
            <>
                <Icon aria-hidden />
                <span className="truncate">{action.label}</span>
                {action.disabled && action.disabledReason && (
                    <span className="truncate text-xs text-muted-foreground">
                        {action.disabledReason}
                    </span>
                )}
                {action.shortcut && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {action.shortcut}
                    </span>
                )}
            </>
        );

        if (action.kind === 'toggle') {
            return (
                <DropdownMenuCheckboxItem
                    key={action.id}
                    checked={Boolean(action.pressed)}
                    disabled={action.disabled}
                    onCheckedChange={() => action.onSelect()}
                >
                    {content}
                </DropdownMenuCheckboxItem>
            );
        }

        return (
            <DropdownMenuItem
                key={action.id}
                variant={
                    action.tone === 'destructive' ? 'destructive' : 'default'
                }
                disabled={action.disabled}
                onSelect={() => action.onSelect()}
            >
                {content}
            </DropdownMenuItem>
        );
    };

    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            data-slot="facilitator-more"
                            data-roving-item=""
                            variant="ghost"
                            size="icon-sm"
                            aria-label={label}
                            tabIndex={tabIndex}
                            onFocus={() => onRovingFocus(moreKey)}
                        >
                            <Ellipsis aria-hidden />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" side="top" size="wide">
                {regular.map(renderItem)}
                {regular.length > 0 && destructive.length > 0 && (
                    <DropdownMenuSeparator />
                )}
                {destructive.map(renderItem)}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function FacilitatorBar({
    actions,
    start,
    primary,
    trailing = [],
    end,
    compact = false,
    label,
    className,
}: FacilitatorBarProps) {
    const { t } = useTrans();
    const rootRef = useRef<HTMLDivElement>(null);
    const [activeKey, setActiveKey] = useState<string | null>(null);

    // Compact buttons are icon-only, and a destructive action always shows
    // its label: in compact mode it lives in the More menu.
    const compactInline = actions
        .filter((action) => action.tone !== 'destructive')
        .slice(0, compactInlineCount);
    const inlineActions = compact ? compactInline : actions;
    const overflowActions = compact
        ? actions.filter((action) => !compactInline.includes(action))
        : [];

    const keys = [
        ...inlineActions.map((action) => action.id),
        ...(overflowActions.length > 0 ? [moreKey] : []),
        ...(primary ? [primary.id] : []),
        ...trailing.map((action) => action.id),
    ];
    const currentKey =
        activeKey !== null && keys.includes(activeKey) ? activeKey : keys[0];
    const tabIndexFor = (key: string): number => (key === currentKey ? 0 : -1);

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
        const root = rootRef.current;
        const target = event.target as HTMLElement;

        if (!root || !root.contains(target)) {
            return;
        }

        if (!target.hasAttribute('data-roving-item')) {
            return;
        }

        // An arrow with a modifier is a shortcut of the page (mod+ArrowRight
        // is the next phase), not a move inside the toolbar.
        if (event.metaKey || event.ctrlKey || event.altKey) {
            return;
        }

        const items = Array.from(
            root.querySelectorAll<HTMLElement>('[data-roving-item]'),
        );
        const index = items.indexOf(target);
        let next: number | null = null;

        if (event.key === 'ArrowRight') {
            next = index >= items.length - 1 ? 0 : index + 1;
        }

        if (event.key === 'ArrowLeft') {
            next = index <= 0 ? items.length - 1 : index - 1;
        }

        if (event.key === 'Home') {
            next = 0;
        }

        if (event.key === 'End') {
            next = items.length - 1;
        }

        if (next === null) {
            return;
        }

        event.preventDefault();
        items[next]?.focus();
    }

    return (
        <div
            ref={rootRef}
            data-slot="facilitator-bar"
            data-compact={compact || undefined}
            role="toolbar"
            aria-label={label ?? t('Facilitation tools')}
            aria-orientation="horizontal"
            onKeyDown={handleKeyDown}
            className={cn(
                'inline-flex max-w-full min-w-0 flex-wrap items-center justify-center gap-1 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-raised',
                className,
            )}
        >
            {start && (
                <div
                    data-slot="facilitator-bar-start"
                    className="flex min-w-0 shrink-0 items-center gap-1"
                >
                    {start}
                </div>
            )}
            {start && actions.length > 0 && <BarSeparator />}
            {inlineActions.map((action) => (
                <ActionButton
                    key={action.id}
                    action={action}
                    iconOnly={compact}
                    tabIndex={tabIndexFor(action.id)}
                    rovingKey={action.id}
                    onRovingFocus={setActiveKey}
                />
            ))}
            {overflowActions.length > 0 && (
                <MoreMenu
                    actions={overflowActions}
                    tabIndex={tabIndexFor(moreKey)}
                    onRovingFocus={setActiveKey}
                />
            )}
            {end && (
                <div
                    data-slot="facilitator-bar-end"
                    className="flex min-w-0 shrink-0 items-center gap-1"
                >
                    {end}
                </div>
            )}
            {primary && (
                <>
                    <BarSeparator />
                    <ActionButton
                        action={primary}
                        iconOnly={compact}
                        isPrimary
                        tabIndex={tabIndexFor(primary.id)}
                        rovingKey={primary.id}
                        onRovingFocus={setActiveKey}
                    />
                </>
            )}
            {trailing.map((action) => (
                <ActionButton
                    key={action.id}
                    action={action}
                    iconOnly={compact}
                    tabIndex={tabIndexFor(action.id)}
                    rovingKey={action.id}
                    onRovingFocus={setActiveKey}
                />
            ))}
        </div>
    );
}

function BarSeparator() {
    return (
        <span
            aria-hidden
            data-slot="facilitator-bar-separator"
            className="mx-0.5 h-5 w-px shrink-0 bg-border"
        />
    );
}
