import { ArrowDownToLine, Ellipsis, Lightbulb, Lock, Plus } from 'lucide-react';
import { Children, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useColumnColorName } from '@/components/skrum/column-color-picker';
import type { ColumnColor } from '@/components/skrum/column-color-picker';
import { Button } from '@/components/ui/button';
import { CardMenu } from '@/components/ui/dropdown-menu';
import type { MenuEntry } from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type { ColumnColor };

export type RetroColumnSort = 'votes' | 'date';

export type RetroColumnProps = {
    id: string;
    title: string;
    color: ColumnColor;
    description?: string;
    count: number;
    children?: ReactNode;
    canAdd?: boolean;
    isDropTarget?: boolean;
    emptyHint?: string;
    onAdd?: () => void;
    onRename?: (title: string) => void;
    onColorChange?: (color: ColumnColor) => void;
    onSort?: (by: RetroColumnSort) => void;
    className?: string;
};

const colorContext: Record<ColumnColor, string> = {
    sun: 'col-sun',
    apricot: 'col-apricot',
    coral: 'col-coral',
    plum: 'col-plum',
    iris: 'col-iris',
    sky: 'col-sky',
    lagoon: 'col-lagoon',
    moss: 'col-moss',
};

const columnColorOrder: ColumnColor[] = [
    'sun',
    'apricot',
    'coral',
    'plum',
    'iris',
    'sky',
    'lagoon',
    'moss',
];

function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return (
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
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
    onAdd,
    onRename,
    onColorChange,
    onSort,
    className,
}: RetroColumnProps) {
    const { t } = useTrans();
    const colorName = useColumnColorName();
    const titleId = useId();
    const descriptionId = useId();
    const sectionRef = useRef<HTMLElement>(null);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(title);
    const hasCards = Children.toArray(children).length > 0;
    const isLocked = !canAdd;
    const countLabel =
        count === 1
            ? t(':count card', { count })
            : t(':count cards', { count });
    const resolvedEmptyHint =
        emptyHint ??
        (canAdd ? t('No card yet. Be the first to write.') : t('No card yet.'));

    const startEditing = () => {
        setDraft(title);
        setEditing(true);
    };

    const commitTitle = () => {
        const next = draft.trim();

        setEditing(false);

        if (next === '' || next === title) {
            return;
        }

        onRename?.(next);
    };

    const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            commitTitle();

            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setEditing(false);
        }
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
        if (
            event.defaultPrevented ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey ||
            isTypingTarget(event.target)
        ) {
            return;
        }

        if ((event.key === 'n' || event.key === 'N') && canAdd && onAdd) {
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

    const menuEntries: MenuEntry[] = [];

    if (onRename) {
        menuEntries.push({
            type: 'item',
            label: t('Rename'),
            onSelect: startEditing,
        });
    }

    if (onColorChange) {
        menuEntries.push({
            type: 'sub',
            label: t('Color'),
            items: [
                {
                    type: 'radio',
                    value: color,
                    items: columnColorOrder.map((value) => ({
                        value,
                        label: colorName(value),
                    })),
                    onValueChange: (value) =>
                        onColorChange(value as ColumnColor),
                },
            ],
        });
    }

    if (onSort) {
        menuEntries.push({
            type: 'sub',
            label: t('Sort by'),
            items: [
                {
                    type: 'item',
                    label: t('Sort by votes'),
                    onSelect: () => onSort('votes'),
                },
                {
                    type: 'item',
                    label: t('Sort by date'),
                    onSelect: () => onSort('date'),
                },
            ],
        });
    }

    return (
        <section
            ref={sectionRef}
            id={id}
            data-slot="retro-column"
            data-color={color}
            data-drop-target={isDropTarget ? 'true' : undefined}
            aria-labelledby={titleId}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className={cn(
                colorContext[color],
                'relative flex w-column max-w-full shrink-0 snap-start flex-col gap-3 rounded-xl border p-3 outline-none',
                'border-[color-mix(in_oklch,var(--col-border)_45%,transparent)] bg-[color-mix(in_oklch,var(--col)_38%,var(--skrum-canvas))]',
                'transition-[box-shadow] duration-140 ease-standard focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                isDropTarget && 'ring-2 ring-(--col-text)',
                className,
            )}
        >
            <header className="flex items-center gap-2 px-0.5">
                <span
                    aria-hidden="true"
                    data-slot="retro-column-swatch"
                    className="size-3 shrink-0 rounded-full bg-(--col-border)"
                />
                <h3
                    id={titleId}
                    className="min-w-0 flex-1 truncate text-sm/snug font-semibold text-foreground"
                >
                    {editing ? (
                        <input
                            autoFocus
                            value={draft}
                            aria-label={t('Column title')}
                            data-slot="retro-column-title-input"
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={handleTitleKeyDown}
                            onBlur={commitTitle}
                            className="h-8 w-full rounded-md border border-input bg-card px-2 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                    ) : description ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span
                                    tabIndex={0}
                                    aria-describedby={descriptionId}
                                    className="cursor-help truncate rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {title}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>{description}</TooltipContent>
                        </Tooltip>
                    ) : (
                        title
                    )}
                </h3>
                {description ? (
                    <span id={descriptionId} className="sr-only">
                        {description}
                    </span>
                ) : null}
                {isLocked ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span
                                role="img"
                                tabIndex={0}
                                data-slot="retro-column-lock"
                                aria-label={t('Adding cards is locked')}
                                className="inline-flex shrink-0 rounded-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <Lock aria-hidden className="size-4" />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            {t('Adding cards is locked')}
                        </TooltipContent>
                    </Tooltip>
                ) : null}
                <span
                    data-slot="retro-column-count"
                    className="tabular inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-(--col-border) px-1.5 text-xs font-semibold text-(--col-text)"
                >
                    <span aria-hidden="true">{count}</span>
                    <span className="sr-only">{countLabel}</span>
                </span>
                {menuEntries.length > 0 ? (
                    <CardMenu
                        label={t('Column options')}
                        entries={menuEntries}
                        trigger={
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('Column options')}
                                data-slot="retro-column-menu"
                            >
                                <Ellipsis aria-hidden />
                            </Button>
                        }
                    />
                ) : null}
            </header>

            <div
                data-slot="retro-column-cards"
                className="flex min-w-0 flex-col gap-3"
            >
                {children}
                {isDropTarget ? (
                    <div
                        role="status"
                        data-slot="retro-column-drop"
                        className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-(--col-text) px-3 py-4 text-sm text-(--col-text)"
                    >
                        <ArrowDownToLine aria-hidden className="size-4" />
                        <span>{t('Drop here')}</span>
                    </div>
                ) : null}
                {!hasCards && !isDropTarget ? (
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
                ) : null}
            </div>

            {canAdd ? (
                <button
                    type="button"
                    data-slot="retro-column-add"
                    onClick={onAdd}
                    className="flex min-h-9 items-center justify-center gap-2 rounded-lg border border-dashed border-(--col-border) px-3 text-sm font-medium text-foreground transition-[background-color] duration-140 ease-standard outline-none hover:bg-card/60 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                >
                    <Plus aria-hidden className="size-4 shrink-0" />
                    <span className="truncate">{t('Add a card')}</span>
                </button>
            ) : null}
        </section>
    );
}
