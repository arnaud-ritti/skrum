import {
    AlignLeft,
    ArrowDownToLine,
    ArrowDownWideNarrow,
    ArrowLeft,
    ArrowRight,
    Ellipsis,
    Lightbulb,
    Palette,
    Pencil,
    Plus,
    Trash2,
} from 'lucide-react';
import { Children, useEffect, useId, useRef, useState } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode, Ref } from 'react';
import {
    columnColors,
    useColumnColorName,
} from '@/components/skrum/column-color-picker';
import { ConfirmDialog, FormDialog } from '@/components/skrum/confirm-dialog';
import { columnColorClass } from '@/components/skrum/retro-template-picker';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import type { ColumnColor } from '@/lib/retro/types';
import { singleKeyShortcutsEnabled } from '@/lib/shortcuts/preference';
import { cn } from '@/lib/utils';

export type { ColumnColor };

export type RetroColumnColorOption = { value: ColumnColor; label: string };

export type RetroColumnProps = Omit<
    ComponentProps<'section'>,
    'id' | 'title' | 'color'
> & {
    id: string;
    title: string;
    color: ColumnColor;
    description?: string | null;
    count: number;
    children?: ReactNode;
    canAdd?: boolean;
    isDropTarget?: boolean;
    emptyHint?: string;
    colorOptions?: RetroColumnColorOption[];
    editDisabledReason?: string;
    canMoveLeft?: boolean;
    canMoveRight?: boolean;
    sortedByVotes?: boolean;
    defaultMenuOpen?: boolean;
    titleMaxLength?: number;
    descriptionMaxLength?: number;
    headerAction?: ReactNode;
    notice?: ReactNode;
    footer?: ReactNode;
    /**
     * Takes the place of the "Add a card" button while the host has a card
     * in editing; `onAdd` (and N) then brings the focus to it.
     */
    composer?: ReactNode;
    onAdd?: () => void;
    onRename?: (title: string) => void;
    onColorChange?: (color: ColumnColor) => void;
    onDescriptionChange?: (description: string | null) => void | Promise<void>;
    onMove?: (direction: -1 | 1) => void;
    onDelete?: () => void | Promise<void>;
    onSortByVotesChange?: (sorted: boolean) => void;
};

type MenuAction = 'rename' | 'description' | 'delete';

function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return (
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    );
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
    if (typeof ref === 'function') {
        ref(value);

        return;
    }

    if (ref) {
        ref.current = value;
    }
}

function DescriptionField({
    initialValue,
    maxLength,
}: {
    initialValue: string;
    maxLength: number;
}) {
    const { t } = useTrans();
    const [value, setValue] = useState(initialValue);

    return (
        <div className="grid gap-1.5">
            <Textarea
                name="description"
                rows={3}
                value={value}
                maxLength={maxLength}
                aria-label={t('Column description')}
                onChange={(event) => setValue(event.target.value)}
            />
            <span
                data-slot="retro-column-description-counter"
                aria-live="polite"
                className={cn(
                    'justify-self-end text-xs tabular-nums',
                    value.length >= maxLength
                        ? 'font-semibold text-skrum-destructive-text'
                        : 'text-muted-foreground',
                )}
            >
                {`${value.length}/${maxLength}`}
            </span>
        </div>
    );
}

export function RetroColumn({
    id,
    title,
    color,
    description,
    count,
    children,
    canAdd = true,
    isDropTarget = false,
    emptyHint,
    colorOptions,
    editDisabledReason,
    canMoveLeft = true,
    canMoveRight = true,
    sortedByVotes = false,
    defaultMenuOpen = false,
    titleMaxLength = 100,
    descriptionMaxLength = 200,
    headerAction,
    notice,
    footer,
    composer,
    onAdd,
    onRename,
    onColorChange,
    onDescriptionChange,
    onMove,
    onDelete,
    onSortByVotesChange,
    className,
    ref,
    onKeyDown,
    ...rest
}: RetroColumnProps) {
    const { t } = useTrans();
    const colorName = useColumnColorName();
    const titleId = useId();
    const descriptionId = useId();
    const reasonId = useId();
    const sectionRef = useRef<HTMLElement | null>(null);
    const menuTriggerRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const pendingAction = useRef<MenuAction | null>(null);
    const settled = useRef(true);
    const restoreFocus = useRef(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(title);
    const [describing, setDescribing] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const hasCards = Children.toArray(children).length > 0;
    const hasDescription = description != null && description !== '';
    const isStructureLocked = editDisabledReason !== undefined;
    const countLabel =
        count === 1
            ? t(':count card', { count })
            : t(':count cards', { count });
    const resolvedEmptyHint =
        emptyHint ??
        (canAdd ? t('No card yet. Be the first to write.') : t('No card yet.'));
    const resolvedColorOptions =
        colorOptions ??
        columnColors.map((value) => ({
            value,
            label: colorName(value),
        }));
    const hasMenu =
        onRename !== undefined ||
        onColorChange !== undefined ||
        onDescriptionChange !== undefined ||
        onMove !== undefined ||
        onDelete !== undefined;

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
            inputRef.current?.select();

            return;
        }

        if (!restoreFocus.current) {
            return;
        }

        restoreFocus.current = false;
        (menuTriggerRef.current ?? sectionRef.current)?.focus();
    }, [editing]);

    const startEditing = () => {
        settled.current = false;
        setDraft(title);
        setEditing(true);
    };

    const finishEditing = (save: boolean, viaKeyboard: boolean) => {
        if (settled.current) {
            return;
        }

        settled.current = true;
        restoreFocus.current = viaKeyboard;
        setEditing(false);

        const next = draft.trim();

        if (!save || next === '' || next === title) {
            return;
        }

        onRename?.(next);
    };

    const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            finishEditing(true, true);

            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            finishEditing(false, true);
        }
    };

    const handleMenuCloseAutoFocus = (event: Event) => {
        const action = pendingAction.current;

        pendingAction.current = null;

        if (action === null) {
            return;
        }

        event.preventDefault();

        if (action === 'rename') {
            startEditing();

            return;
        }

        menuTriggerRef.current?.focus();

        if (action === 'description') {
            setDescribing(true);

            return;
        }

        setConfirmingDelete(true);
    };

    const focusSibling = (step: 1 | -1) => {
        const section = sectionRef.current;

        if (!section) {
            return;
        }

        const columns = Array.from(
            document.querySelectorAll<HTMLElement>(
                '[data-slot="retro-column"]',
            ),
        );
        const target = columns[columns.indexOf(section) + step];

        target?.focus();
    };

    const focusCard = (step: 1 | -1) => {
        const section = sectionRef.current;

        if (!section) {
            return;
        }

        const cards = Array.from(
            section.querySelectorAll<HTMLElement>('[data-slot="retro-card"]'),
        );

        if (cards.length === 0) {
            return;
        }

        const current = cards.findIndex((card) =>
            card.contains(document.activeElement),
        );
        const next =
            current === -1
                ? step === 1
                    ? 0
                    : cards.length - 1
                : current + step;

        cards[next]?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        onKeyDown?.(event);

        if (
            event.defaultPrevented ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey ||
            isTypingTarget(event.target) ||
            !(event.target instanceof Node) ||
            !event.currentTarget.contains(event.target)
        ) {
            return;
        }

        if (
            (event.key === 'n' || event.key === 'N') &&
            canAdd &&
            onAdd &&
            singleKeyShortcutsEnabled()
        ) {
            event.preventDefault();
            onAdd();

            return;
        }

        const onColumnItself = event.target === event.currentTarget;

        if (event.key === 'ArrowRight' && onColumnItself) {
            event.preventDefault();
            focusSibling(1);

            return;
        }

        if (event.key === 'ArrowLeft' && onColumnItself) {
            event.preventDefault();
            focusSibling(-1);

            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusCard(1);

            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            focusCard(-1);
        }
    };

    const lockedItemProps = isStructureLocked
        ? { disabled: true, 'aria-describedby': reasonId }
        : {};

    return (
        <section
            aria-labelledby={titleId}
            aria-describedby={hasDescription ? descriptionId : undefined}
            tabIndex={0}
            {...rest}
            ref={(node) => {
                sectionRef.current = node;
                assignRef(ref, node);
            }}
            id={id}
            data-slot="retro-column"
            data-color={color}
            data-drop-target={isDropTarget ? 'true' : undefined}
            onKeyDown={handleKeyDown}
            className={cn(
                columnColorClass(color),
                'relative flex max-h-full min-h-0 w-column max-w-full shrink-0 snap-start flex-col gap-3 rounded-xl border p-3 outline-none',
                'border-[color-mix(in_oklch,var(--col-border)_45%,transparent)] bg-[color-mix(in_oklch,var(--col)_38%,var(--skrum-canvas))]',
                'transition-[box-shadow] duration-140 ease-standard focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                isDropTarget && 'ring-2 ring-(--col-text)',
                className,
            )}
        >
            <header className="flex shrink-0 items-start gap-2 px-0.5">
                <span
                    aria-hidden="true"
                    data-slot="retro-column-swatch"
                    className="mt-2.5 size-3 shrink-0 rounded-full bg-(--col-border)"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h3
                        id={titleId}
                        className="flex min-h-8 min-w-0 items-center text-sm/snug font-semibold text-foreground"
                    >
                        {editing ? (
                            <input
                                ref={inputRef}
                                value={draft}
                                maxLength={titleMaxLength}
                                aria-label={t('Column title')}
                                data-slot="retro-column-title-input"
                                onChange={(event) =>
                                    setDraft(event.target.value)
                                }
                                onKeyDown={handleTitleKeyDown}
                                onBlur={() => finishEditing(true, false)}
                                className="h-8 w-full min-w-0 rounded-md border border-input bg-card px-2 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                        ) : (
                            <span className="truncate">{title}</span>
                        )}
                    </h3>
                    {hasDescription && (
                        <p
                            id={descriptionId}
                            data-slot="retro-column-description"
                            className="text-xs/snug break-words text-muted-foreground"
                        >
                            {description}
                        </p>
                    )}
                </div>
                <div className="flex h-8 shrink-0 items-center gap-2">
                    <span
                        data-slot="retro-column-count"
                        className="tabular inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-(--col-border) px-1.5 text-xs font-semibold text-(--col-text)"
                    >
                        <span aria-hidden="true">{count}</span>
                        <span className="sr-only">{countLabel}</span>
                    </span>
                    {headerAction}
                    {hasMenu && (
                        <DropdownMenu defaultOpen={defaultMenuOpen}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    ref={menuTriggerRef}
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={t('Column menu')}
                                    data-slot="retro-column-menu"
                                >
                                    <Ellipsis aria-hidden />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                size="wide"
                                aria-label={t('Column menu')}
                                onCloseAutoFocus={handleMenuCloseAutoFocus}
                            >
                                {onRename && (
                                    <DropdownMenuItem
                                        {...lockedItemProps}
                                        onSelect={() => {
                                            pendingAction.current = 'rename';
                                        }}
                                    >
                                        <Pencil aria-hidden />
                                        <span className="truncate">
                                            {t('Rename')}
                                        </span>
                                    </DropdownMenuItem>
                                )}
                                {onDescriptionChange && (
                                    <DropdownMenuItem
                                        onSelect={() => {
                                            pendingAction.current =
                                                'description';
                                        }}
                                    >
                                        <AlignLeft aria-hidden />
                                        <span className="truncate">
                                            {t('Edit description')}
                                        </span>
                                    </DropdownMenuItem>
                                )}
                                {onColorChange && (
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger
                                            {...lockedItemProps}
                                            className="data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                        >
                                            <Palette aria-hidden />
                                            <span className="truncate">
                                                {t('Colour')}
                                            </span>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent size="wide">
                                            <DropdownMenuRadioGroup
                                                value={color}
                                                onValueChange={(value) =>
                                                    onColorChange(
                                                        value as ColumnColor,
                                                    )
                                                }
                                            >
                                                {resolvedColorOptions.map(
                                                    (option) => (
                                                        <DropdownMenuRadioItem
                                                            key={option.value}
                                                            value={option.value}
                                                        >
                                                            <span
                                                                aria-hidden
                                                                className={cn(
                                                                    columnColorClass(
                                                                        option.value,
                                                                    ),
                                                                    'size-3 shrink-0 rounded-full bg-(--col-border)',
                                                                )}
                                                            />
                                                            <span className="truncate">
                                                                {option.label}
                                                            </span>
                                                        </DropdownMenuRadioItem>
                                                    ),
                                                )}
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                )}
                                {onMove && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            disabled={!canMoveLeft}
                                            onSelect={() => onMove(-1)}
                                        >
                                            <ArrowLeft aria-hidden />
                                            <span className="truncate">
                                                {t('Move left')}
                                            </span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            disabled={!canMoveRight}
                                            onSelect={() => onMove(1)}
                                        >
                                            <ArrowRight aria-hidden />
                                            <span className="truncate">
                                                {t('Move right')}
                                            </span>
                                        </DropdownMenuItem>
                                    </>
                                )}
                                {onDelete && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            {...lockedItemProps}
                                            variant="destructive"
                                            onSelect={() => {
                                                pendingAction.current =
                                                    'delete';
                                            }}
                                        >
                                            <Trash2 aria-hidden />
                                            <span className="truncate">
                                                {t('Delete column')}
                                            </span>
                                        </DropdownMenuItem>
                                    </>
                                )}
                                {isStructureLocked && (
                                    <p
                                        id={reasonId}
                                        data-slot="retro-column-menu-reason"
                                        className="max-w-56 px-2 py-1.5 text-xs/snug text-muted-foreground"
                                    >
                                        {editDisabledReason}
                                    </p>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </header>

            {onSortByVotesChange && (
                <Button
                    type="button"
                    size="sm"
                    variant={sortedByVotes ? 'secondary' : 'ghost'}
                    data-test="retro-sort-by-votes"
                    aria-pressed={sortedByVotes}
                    onClick={() => onSortByVotesChange(!sortedByVotes)}
                    className="max-w-full shrink-0 self-start"
                >
                    <ArrowDownWideNarrow aria-hidden />
                    <span className="truncate">{t('Sort by votes')}</span>
                </Button>
            )}

            {notice}

            <div
                data-slot="retro-column-cards"
                className="scrollbar-themed -m-1 flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-1"
            >
                {children}
                {isDropTarget && (
                    <div
                        role="status"
                        data-slot="retro-column-drop"
                        className="flex shrink-0 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-(--col-text) px-3 py-4 text-sm text-(--col-text)"
                    >
                        <ArrowDownToLine aria-hidden className="size-4" />
                        <span>{t('Drop here')}</span>
                    </div>
                )}
                {!hasCards && !isDropTarget && (
                    <div
                        data-slot="retro-column-empty"
                        className="flex flex-col items-center gap-2 px-3 py-6 text-center text-sm/snug text-muted-foreground"
                    >
                        <Lightbulb
                            aria-hidden
                            className="size-5 text-(--col-text)"
                        />
                        <p>{resolvedEmptyHint}</p>
                    </div>
                )}
            </div>

            {canAdd && composer}
            {canAdd && composer === undefined && (
                <button
                    type="button"
                    data-slot="retro-column-add"
                    onClick={onAdd}
                    className="flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-dashed border-(--col-border) px-3 text-sm font-medium text-foreground transition-[background-color] duration-140 ease-standard outline-none hover:bg-card/60 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                >
                    <Plus aria-hidden className="size-4 shrink-0" />
                    <span className="truncate">{t('Add a card')}</span>
                </button>
            )}

            {footer}

            {onDescriptionChange && (
                <FormDialog
                    open={describing}
                    onOpenChange={setDescribing}
                    title={t('Column description')}
                    description={t(
                        'Shown under the column title to guide what people write.',
                    )}
                    submitLabel={t('Save')}
                    onSubmit={async (data) => {
                        const value = data.get('description');
                        const next =
                            typeof value === 'string' ? value.trim() : '';

                        await onDescriptionChange(next === '' ? null : next);
                    }}
                >
                    <DescriptionField
                        initialValue={description ?? ''}
                        maxLength={descriptionMaxLength}
                    />
                </FormDialog>
            )}
            {onDelete && (
                <ConfirmDialog
                    open={confirmingDelete}
                    onOpenChange={setConfirmingDelete}
                    title={t('Delete column')}
                    description={t('Delete the column :title?', { title })}
                    confirmLabel={t('Delete')}
                    tone="destructive"
                    onConfirm={async () => {
                        await onDelete();
                    }}
                />
            )}
        </section>
    );
}
