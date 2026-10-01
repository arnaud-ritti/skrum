import { ChevronDown, ChevronRight, ThumbsUp, Unlink } from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { RetroCard } from '@/components/skrum/retro-card';
import type {
    ColumnColor,
    RetroCardProps,
} from '@/components/skrum/retro-card';
import { PersonAvatar } from '@/components/ui/avatar';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type CardGroupProps = {
    id: string;
    title: string;
    color: ColumnColor;
    cards: RetroCardProps[];
    collapsed?: boolean;
    editingTitle?: boolean;
    votes?: { total: number | null; mine: number };
    canEdit?: boolean;
    dropTarget?: boolean;
    onToggle?: (collapsed: boolean) => void;
    onRename?: (title: string) => void;
    onUngroup?: (cardId: string) => void;
    className?: string;
};

const columnClasses: Record<ColumnColor, string> = {
    sun: '[--c:var(--skrum-col-sun)] [--c-b:var(--skrum-col-sun-border)] [--c-t:var(--skrum-col-sun-text)]',
    apricot:
        '[--c:var(--skrum-col-apricot)] [--c-b:var(--skrum-col-apricot-border)] [--c-t:var(--skrum-col-apricot-text)]',
    coral: '[--c:var(--skrum-col-coral)] [--c-b:var(--skrum-col-coral-border)] [--c-t:var(--skrum-col-coral-text)]',
    plum: '[--c:var(--skrum-col-plum)] [--c-b:var(--skrum-col-plum-border)] [--c-t:var(--skrum-col-plum-text)]',
    iris: '[--c:var(--skrum-col-iris)] [--c-b:var(--skrum-col-iris-border)] [--c-t:var(--skrum-col-iris-text)]',
    sky: '[--c:var(--skrum-col-sky)] [--c-b:var(--skrum-col-sky-border)] [--c-t:var(--skrum-col-sky-text)]',
    lagoon: '[--c:var(--skrum-col-lagoon)] [--c-b:var(--skrum-col-lagoon-border)] [--c-t:var(--skrum-col-lagoon-text)]',
    moss: '[--c:var(--skrum-col-moss)] [--c-b:var(--skrum-col-moss-border)] [--c-t:var(--skrum-col-moss-text)]',
};

const defaultTitleLength = 40;
const maxStackedAvatars = 3;

function truncate(text: string, length: number): string {
    const clean = text.trim();

    return clean.length > length
        ? `${clean.slice(0, length).trimEnd()}…`
        : clean;
}

export function CardGroup({
    id,
    title,
    color,
    cards,
    collapsed,
    editingTitle = false,
    votes,
    canEdit = false,
    dropTarget = false,
    onToggle,
    onRename,
    onUngroup,
    className,
}: CardGroupProps) {
    const { t } = useTrans();
    const [isCollapsed, setIsCollapsed] = useState(collapsed ?? false);
    const [seenCollapsed, setSeenCollapsed] = useState(collapsed);
    const [isEditing, setIsEditing] = useState(editingTitle);
    const [seenEditing, setSeenEditing] = useState(editingTitle);
    const [draft, setDraft] = useState(title);

    if (collapsed !== seenCollapsed) {
        setSeenCollapsed(collapsed);

        if (collapsed !== undefined) {
            setIsCollapsed(collapsed);
        }
    }

    if (editingTitle !== seenEditing) {
        setSeenEditing(editingTitle);
        setIsEditing(editingTitle);

        if (editingTitle) {
            setDraft(title);
        }
    }

    const firstCard = cards[0];
    const displayTitle =
        title.trim() !== ''
            ? title.trim()
            : truncate(firstCard?.text ?? '', defaultTitleLength) ||
              t('Untitled group');
    const editing = canEdit && isEditing;
    const hiddenCards = cards.slice(1);
    const sliceCount = Math.min(hiddenCards.length, 2);
    const authors = cards
        .map((card) => card.author)
        .filter((author) => author != null)
        .filter(
            (author, index, all) =>
                all.findIndex((other) => other.id === author.id) === index,
        );
    const showTotal = votes !== undefined && votes.total !== null;

    function toggle(): void {
        const next = !isCollapsed;

        setIsCollapsed(next);
        onToggle?.(next);
    }

    function startEditing(): void {
        if (!canEdit) {
            return;
        }

        setDraft(title.trim() !== '' ? title : displayTitle);
        setIsEditing(true);
    }

    function commit(): void {
        const next = draft.trim();

        setIsEditing(false);

        if (next === '' || next === title.trim()) {
            return;
        }

        onRename?.(next);
    }

    function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setIsEditing(false);

            return;
        }

        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            commit();
        }
    }

    const toggleLabel = isCollapsed ? t('Expand group') : t('Collapse group');
    const Chevron = isCollapsed ? ChevronRight : ChevronDown;

    const footer = isCollapsed ? (
        <div
            data-slot="card-group-footer"
            className="flex min-w-0 items-center gap-2 px-0.5 text-xs text-muted-foreground"
        >
            {authors.length > 0 && (
                <span className="flex shrink-0 items-center">
                    {authors.slice(0, maxStackedAvatars).map((author) => (
                        <span
                            key={author.id}
                            className="-ml-1 rounded-full ring-2 ring-card first:ml-0"
                        >
                            <PersonAvatar
                                name={author.name}
                                presence={author.presence}
                                size="xs"
                                decorative
                            />
                        </span>
                    ))}
                </span>
            )}
            <span className="truncate">
                {[
                    hiddenCards.length > 0
                        ? t('+ :count cards', { count: hiddenCards.length })
                        : null,
                    showTotal
                        ? t(':count votes', { count: votes?.total ?? 0 })
                        : null,
                ]
                    .filter(Boolean)
                    .join(' · ')}
            </span>
        </div>
    ) : (
        showTotal && (
            <div
                data-slot="card-group-footer"
                className="flex min-w-0 items-center gap-2 px-0.5 text-xs text-muted-foreground"
            >
                <ThumbsUp className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                    {t(':count votes in total', { count: votes?.total ?? 0 })}
                    {votes.mine > 0 &&
                        ` · ${t(':count of them yours', { count: votes.mine })}`}
                </span>
            </div>
        )
    );

    return (
        <section
            data-slot="card-group"
            data-group-id={id}
            data-color={color}
            data-collapsed={isCollapsed || undefined}
            data-editing={editing || undefined}
            data-drop-target={dropTarget || undefined}
            aria-label={t('Group: :title, :count cards', {
                title: displayTitle,
                count: cards.length,
            })}
            className={cn(
                columnClasses[color],
                '@container/card relative flex w-full min-w-0 flex-col gap-2 rounded-xl border-[1.5px] border-(--c-b) bg-[color-mix(in_oklab,var(--c)_55%,var(--card))] p-3 text-foreground shadow-card transition-shadow duration-140 ease-standard motion-reduce:transition-none',
                dropTarget &&
                    'outline-2 outline-offset-2 outline-(--c-t) outline-dashed',
                className,
            )}
        >
            <header className="flex min-w-0 items-center gap-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            data-slot="card-group-toggle"
                            aria-expanded={!isCollapsed}
                            aria-label={toggleLabel}
                            onClick={toggle}
                            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-(--c-t) transition-colors duration-140 ease-standard outline-none hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
                        >
                            <Chevron className="size-4" aria-hidden />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>{toggleLabel}</TooltipContent>
                </Tooltip>

                {editing ? (
                    <input
                        data-slot="card-group-title-input"
                        aria-label={t('Group title')}
                        autoFocus
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={handleTitleKeyDown}
                        onBlur={commit}
                        className="h-7 min-w-0 flex-1 rounded-sm bg-card px-1.5 text-sm font-semibold text-foreground ring-2 ring-ring outline-none"
                    />
                ) : canEdit ? (
                    <button
                        type="button"
                        data-slot="card-group-title"
                        title={t('Click to rename')}
                        onClick={startEditing}
                        className="-mx-1.5 h-7 min-w-0 flex-1 cursor-text truncate rounded-sm px-1.5 text-left text-sm font-semibold transition-colors duration-140 ease-standard outline-none hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                    >
                        {displayTitle}
                    </button>
                ) : (
                    <span
                        data-slot="card-group-title"
                        className="min-w-0 flex-1 truncate text-sm font-semibold"
                    >
                        {displayTitle}
                    </span>
                )}

                <span
                    data-slot="card-group-count"
                    aria-hidden
                    className="shrink-0 rounded-full border border-(--c-b) bg-card px-2 text-xs/5 font-bold text-(--c-t)"
                >
                    {cards.length}
                </span>
            </header>

            {isCollapsed ? (
                firstCard && (
                    <div
                        data-slot="card-group-stack"
                        className="relative isolate mb-3"
                    >
                        <RetroCard {...firstCard} className="shadow-none" />
                        {sliceCount > 0 && (
                            <div
                                aria-hidden
                                data-slot="card-group-slice"
                                className="absolute inset-0 -z-10 translate-x-1 translate-y-1.5 rotate-1 rounded-lg border border-(--c-b) bg-(--c)"
                            />
                        )}
                        {sliceCount > 1 && (
                            <div
                                aria-hidden
                                data-slot="card-group-slice"
                                className="absolute inset-0 -z-20 translate-x-2 translate-y-3 rotate-2 rounded-lg border border-(--c-b) bg-(--c)"
                            />
                        )}
                        {hiddenCards.length > 0 && (
                            <ul
                                data-slot="card-group-hidden-cards"
                                className="sr-only"
                            >
                                {hiddenCards.map((card) => (
                                    <li key={card.id}>
                                        {card.masked
                                            ? t('Card hidden until the reveal')
                                            : card.text}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )
            ) : (
                <ul
                    data-slot="card-group-stack"
                    className="flex min-w-0 flex-col gap-2"
                >
                    {cards.map((card) => (
                        <li
                            key={card.id}
                            className="group/item relative min-w-0"
                        >
                            <RetroCard {...card} className="shadow-none" />
                            {canEdit && onUngroup && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            data-slot="card-group-ungroup"
                                            aria-label={t(
                                                'Remove from group: :text',
                                                {
                                                    text: truncate(
                                                        card.text,
                                                        40,
                                                    ),
                                                },
                                            )}
                                            onClick={() => onUngroup(card.id)}
                                            className="absolute right-1.5 bottom-1.5 inline-flex size-7 items-center justify-center rounded-md bg-card text-muted-foreground opacity-0 transition-opacity duration-140 ease-standard outline-none group-focus-within/item:opacity-100 group-hover/item:opacity-100 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                                        >
                                            <Unlink
                                                className="size-4"
                                                aria-hidden
                                            />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {t('Remove from group')}
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {footer}
        </section>
    );
}
