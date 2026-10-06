import {
    Bookmark,
    Building2,
    CircleCheck,
    Pencil,
    Plus,
    Trash2,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupCardItem } from '@/components/ui/radio-group';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export const DeckMinValues = 2;
export const DeckMaxValues = 20;
export const DeckMaxValueLength = 8;
export const DeckMaxNameLength = 40;
export const UnknownCard = '?';
export const BreakCard = '☕';

export interface Deck {
    id: string;
    name: string;
    values: string[];
    unknownCard: boolean;
    breakCard: boolean;
    /** `custom`: a deck typed for one game, saved nowhere. */
    source: 'builtin' | 'saved' | 'custom';
    /** Of a saved deck: `workspace` when every team of the workspace has it. */
    scope?: 'team' | 'workspace';
    canManage?: boolean;
    createdBy?: { name: string };
}

export interface DeckPickerProps {
    value: string;
    onValueChange: (id: string) => void;
    decks: Deck[];
    onCreate: () => void;
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void | Promise<void>;
    /**
     * `compact`: small tiles with the values in mono, under a section header
     * that holds the "New deck" button. For a form that has more below.
     */
    variant?: 'default' | 'compact';
    className?: string;
}

const PreviewValuesShown = 7;

type DeckShape = Pick<Deck, 'values' | 'unknownCard' | 'breakCard'>;

export function deckCards(deck: DeckShape): string[] {
    return [
        ...deck.values,
        ...(deck.unknownCard ? [UnknownCard] : []),
        ...(deck.breakCard ? [BreakCard] : []),
    ];
}

export function isSpecialCard(value: string): boolean {
    return value === UnknownCard || value === BreakCard;
}

/** Splits the flat card list the server stores into values and switches. */
export function deckShapeFromCards(cards: string[]): DeckShape {
    return {
        values: cards.filter((card) => !isSpecialCard(card)),
        unknownCard: cards.includes(UnknownCard),
        breakCard: cards.includes(BreakCard),
    };
}

export function DeckPreviewCard({
    value,
    size = 'default',
}: {
    value: string;
    size?: 'default' | 'sm';
}) {
    const { t } = useTrans();
    const special = isSpecialCard(value);
    const specialLabel =
        value === UnknownCard ? t("I don't know") : t('I need a break');

    return (
        <span
            data-slot="deck-preview-card"
            data-special={special || undefined}
            className={cn(
                'grid max-w-full shrink-0 place-items-center border font-display font-bold whitespace-nowrap shadow-card',
                size === 'sm'
                    ? 'h-8.5 min-w-6.5 rounded-sm px-1 text-body-sm'
                    : 'h-14 min-w-10 rounded-lg px-1.5 text-lg',
                special
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-card text-foreground',
            )}
        >
            <span aria-hidden="true">{value}</span>
            {special ? <span className="sr-only">{specialLabel}</span> : null}
        </span>
    );
}

export function DeckPreviewStrip({
    deck,
    label,
    size = 'default',
    className,
}: {
    deck: DeckShape;
    label: string;
    size?: 'default' | 'sm';
    className?: string;
}) {
    return (
        <div
            role="group"
            aria-label={label}
            data-slot="deck-strip"
            className={cn(
                'flex flex-wrap items-end',
                size === 'sm' ? 'gap-1' : 'gap-1.5',
                className,
            )}
        >
            {deckCards(deck).map((card) => (
                <DeckPreviewCard key={card} value={card} size={size} />
            ))}
        </div>
    );
}

/**
 * The first values, a "+n" for the values left out, then the special cards,
 * as the DeckPicker mockup draws them ("0 1 2 3 5 8 13 +4 ? ☕").
 */
function PreviewValues({ cards }: { cards: string[] }) {
    const values = cards.filter((card) => !isSpecialCard(card));
    const specials = cards.filter(isSpecialCard);
    const shown = values.slice(0, PreviewValuesShown);
    const hidden = values.length - shown.length;
    const tileClassName =
        'grid h-7 min-w-6 place-items-center rounded-sm border px-1 font-display text-xs font-bold shadow-card';

    return (
        <span
            aria-hidden="true"
            data-slot="deck-values"
            className="flex flex-wrap gap-1"
        >
            {shown.map((card) => (
                <span
                    key={card}
                    className={cn(tileClassName, 'bg-card text-foreground')}
                >
                    {card}
                </span>
            ))}
            {hidden > 0 ? (
                <span className="grid h-7 place-items-center px-1 text-xs font-semibold text-muted-foreground">
                    +{hidden}
                </span>
            ) : null}
            {specials.map((card) => (
                <span
                    key={card}
                    className={cn(
                        tileClassName,
                        'bg-muted text-muted-foreground',
                    )}
                >
                    {card}
                </span>
            ))}
        </span>
    );
}

function DeckSourceBadge({ deck }: { deck: Deck }) {
    const { t } = useTrans();

    if (deck.source === 'builtin') {
        return <Badge variant="outline">{t('Built-in')}</Badge>;
    }

    if (deck.source === 'custom') {
        return <Badge variant="outline">{t('This game only')}</Badge>;
    }

    if (deck.scope === 'workspace') {
        return (
            <Badge variant="muted">
                <Building2 aria-hidden="true" />
                {t('Workspace')}
            </Badge>
        );
    }

    return (
        <Badge variant="muted">
            <Bookmark aria-hidden="true" />
            {t('Saved')}
        </Badge>
    );
}

function DeckSourceLabel({ deck, id }: { deck: Deck; id?: string }) {
    const { t } = useTrans();
    const Icon =
        deck.source !== 'saved'
            ? null
            : deck.scope === 'workspace'
              ? Building2
              : Bookmark;
    const labels = {
        builtin: t('Built-in'),
        custom: t('This game only'),
        saved: deck.scope === 'workspace' ? t('Workspace') : t('Saved'),
    };

    return (
        <span
            id={id}
            data-slot="deck-source"
            className="flex min-w-0 items-center gap-1 text-overline font-normal tracking-normal text-muted-foreground"
        >
            {Icon === null ? null : (
                <Icon aria-hidden="true" className="size-3 shrink-0" />
            )}
            <span className="truncate">{labels[deck.source]}</span>
        </span>
    );
}

function DeckManageActions({
    deck,
    onEdit,
    onDelete,
    className,
}: {
    deck: Deck;
    onEdit?: () => void;
    onDelete?: () => void;
    className?: string;
}) {
    const { t } = useTrans();

    return (
        <div
            data-slot="deck-manage"
            className={cn('flex min-w-0 flex-wrap gap-1', className)}
        >
            {onEdit === undefined ? null : (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="max-w-full min-w-0"
                    aria-label={t('Edit :name', { name: deck.name })}
                    onClick={onEdit}
                >
                    <Pencil aria-hidden="true" />
                    <span className="truncate">{t('Edit')}</span>
                </Button>
            )}
            {onDelete === undefined ? null : (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="max-w-full min-w-0 text-skrum-destructive-text hover:text-skrum-destructive-text"
                    aria-label={t('Delete :name', { name: deck.name })}
                    onClick={onDelete}
                >
                    <Trash2 aria-hidden="true" />
                    <span className="truncate">{t('Delete')}</span>
                </Button>
            )}
        </div>
    );
}

export function DeckPicker({
    value,
    onValueChange,
    decks,
    onCreate,
    onEdit,
    onDelete,
    variant = 'default',
    className,
}: DeckPickerProps) {
    const { t } = useTrans();
    const createRef = useRef<HTMLButtonElement>(null);
    const createDescriptionId = useId();
    const optionIdPrefix = useId();
    const deletedIdRef = useRef<string | null>(null);
    const [deleting, setDeleting] = useState<Deck | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const selected = decks.find((deck) => deck.id === value);
    const compact = variant === 'compact';

    const askDelete = (deck: Deck): void => {
        setDeleting(deck);
        setConfirmOpen(true);
    };

    const manageable = (deck: Deck) => {
        const canManage = deck.source !== 'builtin' && deck.canManage === true;

        return {
            canEdit: canManage && onEdit !== undefined,
            canDelete: canManage && onDelete !== undefined,
        };
    };

    useEffect(() => {
        const deletedId = deletedIdRef.current;

        if (deletedId === null || confirmOpen) {
            return;
        }

        if (decks.some((deck) => deck.id === deletedId)) {
            return;
        }

        deletedIdRef.current = null;
        createRef.current?.focus();
    }, [decks, confirmOpen]);

    const selectedCards = selected === undefined ? [] : deckCards(selected);
    const selectedManage =
        selected === undefined || !compact
            ? { canEdit: false, canDelete: false }
            : manageable(selected);

    return (
        <div
            data-slot="deck-picker"
            data-variant={variant}
            className={cn(
                '@container/deck flex min-w-0 flex-col',
                compact ? 'gap-2' : 'gap-4',
                className,
            )}
        >
            {compact ? (
                <>
                    <div className="flex min-w-0 items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                            {t('Deck')}
                        </span>
                        <Button
                            type="button"
                            ref={createRef}
                            variant="ghost"
                            size="sm"
                            data-slot="deck-create"
                            className="-my-1 min-w-0 shrink-0"
                            onClick={onCreate}
                        >
                            <Plus aria-hidden="true" />
                            <span className="truncate">{t('New deck')}</span>
                        </Button>
                    </div>
                    <RadioGroup
                        value={value}
                        onValueChange={onValueChange}
                        aria-label={t('Deck')}
                        className="grid grid-cols-1 gap-2 @xs/deck:grid-cols-2 [&>input]:hidden"
                    >
                        {decks.map((deck, index) => {
                            const cards = deckCards(deck);
                            const sourceId = `${optionIdPrefix}-${index}-source`;

                            return (
                                <RadioGroupCardItem
                                    key={deck.id}
                                    value={deck.id}
                                    aria-label={t(':name, :count cards', {
                                        name: deck.name,
                                        count: cards.length,
                                    })}
                                    aria-describedby={sourceId}
                                    data-slot="deck-option"
                                    className="gap-1 rounded-md px-2.5 py-2 shadow-none data-[state=checked]:ring-1"
                                >
                                    <span className="truncate text-body-sm leading-4.5 font-semibold text-foreground">
                                        {deck.name}
                                    </span>
                                    <span
                                        aria-hidden="true"
                                        data-slot="deck-values"
                                        className="block truncate font-mono text-overline font-normal tracking-normal text-muted-foreground"
                                    >
                                        {cards.join(' ')}
                                    </span>
                                    <DeckSourceLabel
                                        deck={deck}
                                        id={sourceId}
                                    />
                                </RadioGroupCardItem>
                            );
                        })}
                    </RadioGroup>
                </>
            ) : (
                <div className="grid grid-cols-1 gap-2 @sm/deck:grid-cols-2">
                    <RadioGroup
                        value={value}
                        onValueChange={onValueChange}
                        aria-label={t('Deck')}
                        className="contents"
                    >
                        {decks.map((deck, index) => {
                            const cards = deckCards(deck);
                            const sourceId = `${optionIdPrefix}-${index}-source`;
                            const accessibleName = t(':name, :count cards', {
                                name: deck.name,
                                count: cards.length,
                            });
                            const { canEdit, canDelete } = manageable(deck);

                            return (
                                <div
                                    key={deck.id}
                                    data-slot="deck-option-wrapper"
                                    className="flex min-w-0 flex-col gap-1 [&>input]:hidden"
                                >
                                    <RadioGroupCardItem
                                        value={deck.id}
                                        aria-label={accessibleName}
                                        aria-describedby={sourceId}
                                        data-slot="deck-option"
                                        className="flex-1"
                                    >
                                        <span className="flex min-w-0 items-start justify-between gap-2">
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-semibold text-foreground">
                                                    {deck.name}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {t(':count cards', {
                                                        count: cards.length,
                                                    })}
                                                </span>
                                            </span>
                                            <CircleCheck
                                                aria-hidden="true"
                                                className="size-4 shrink-0 text-primary opacity-0 group-data-[state=checked]/radio-card:opacity-100"
                                            />
                                        </span>
                                        <PreviewValues cards={cards} />
                                        <span
                                            id={sourceId}
                                            className="flex min-w-0 items-center gap-1.5"
                                        >
                                            <DeckSourceBadge deck={deck} />
                                            {deck.createdBy ? (
                                                <span className="truncate text-xs text-muted-foreground">
                                                    {t('by :name', {
                                                        name: deck.createdBy
                                                            .name,
                                                    })}
                                                </span>
                                            ) : null}
                                        </span>
                                    </RadioGroupCardItem>
                                    {canEdit || canDelete ? (
                                        <DeckManageActions
                                            deck={deck}
                                            onEdit={
                                                canEdit
                                                    ? () => onEdit?.(deck.id)
                                                    : undefined
                                            }
                                            onDelete={
                                                canDelete
                                                    ? () => askDelete(deck)
                                                    : undefined
                                            }
                                        />
                                    ) : null}
                                </div>
                            );
                        })}
                    </RadioGroup>
                    <button
                        type="button"
                        ref={createRef}
                        onClick={onCreate}
                        data-slot="deck-create"
                        aria-label={t('Create a deck')}
                        aria-describedby={createDescriptionId}
                        className="flex min-h-20 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input p-3 text-sm font-semibold text-muted-foreground transition-colors duration-140 ease-standard outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
                    >
                        <span className="flex max-w-full min-w-0 items-center gap-2">
                            <Plus
                                aria-hidden="true"
                                className="size-4 shrink-0"
                            />
                            <span className="truncate">
                                {t('Create a deck')}
                            </span>
                        </span>
                        <span
                            id={createDescriptionId}
                            className="max-w-full text-center text-xs font-normal"
                        >
                            {t('Your values, ? and ☕ optional.')}
                        </span>
                    </button>
                </div>
            )}
            {selected ? (
                <section
                    data-slot="deck-selected"
                    aria-label={t('Cards of :deck', { deck: selected.name })}
                    className={cn(
                        'flex min-w-0 flex-col rounded-lg border bg-skrum-canvas',
                        compact ? 'gap-1.5 p-2.5' : 'gap-2 p-3',
                    )}
                >
                    <span className="text-overline break-words text-muted-foreground uppercase">
                        {t('Cards of :deck', { deck: selected.name })}
                        {' · '}
                        {selectedCards.length}
                    </span>
                    <DeckPreviewStrip
                        deck={selected}
                        size={compact ? 'sm' : 'default'}
                        label={t(':name, :count cards: :values', {
                            name: selected.name,
                            count: selectedCards.length,
                            values: selectedCards.join(', '),
                        })}
                    />
                </section>
            ) : null}
            {selected &&
            (selectedManage.canEdit || selectedManage.canDelete) ? (
                <DeckManageActions
                    deck={selected}
                    className="-ml-2"
                    onEdit={
                        selectedManage.canEdit
                            ? () => onEdit?.(selected.id)
                            : undefined
                    }
                    onDelete={
                        selectedManage.canDelete
                            ? () => askDelete(selected)
                            : undefined
                    }
                />
            ) : null}
            {deleting !== null && onDelete !== undefined ? (
                <ConfirmDialog
                    open={confirmOpen}
                    onOpenChange={setConfirmOpen}
                    title={t('Delete this deck?')}
                    description={t(
                        deleting.scope === 'workspace'
                            ? 'The saved deck “:name” is removed for every team of the workspace.'
                            : 'The saved deck “:name” is removed for the whole team.',
                        { name: deleting.name },
                    )}
                    confirmLabel={t('Delete deck')}
                    tone="destructive"
                    onConfirm={async () => {
                        deletedIdRef.current = deleting.id;

                        try {
                            await onDelete(deleting.id);
                        } catch (error) {
                            deletedIdRef.current = null;

                            throw error;
                        }
                    }}
                />
            ) : null}
        </div>
    );
}
