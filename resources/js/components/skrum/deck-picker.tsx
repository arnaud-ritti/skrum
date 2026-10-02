import { Bookmark, CircleCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
    source: 'builtin' | 'saved';
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

export function DeckPreviewCard({ value }: { value: string }) {
    const { t } = useTrans();
    const special = isSpecialCard(value);
    const specialLabel =
        value === UnknownCard ? t("I don't know") : t('I need a break');

    return (
        <span
            data-slot="deck-preview-card"
            data-special={special || undefined}
            className={cn(
                'grid h-14 max-w-full min-w-10 shrink-0 place-items-center rounded-lg border px-1.5 font-display text-lg font-bold whitespace-nowrap shadow-card',
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
    className,
}: {
    deck: DeckShape;
    label: string;
    className?: string;
}) {
    return (
        <div
            role="group"
            aria-label={label}
            data-slot="deck-strip"
            className={cn('flex flex-wrap items-end gap-1.5', className)}
        >
            {deckCards(deck).map((card) => (
                <DeckPreviewCard key={card} value={card} />
            ))}
        </div>
    );
}

function PreviewValues({ cards }: { cards: string[] }) {
    const shown = cards.slice(0, PreviewValuesShown);
    const hidden = cards.length - shown.length;

    return (
        <span
            aria-hidden="true"
            data-slot="deck-values"
            className="flex flex-wrap gap-1"
        >
            {shown.map((card) => (
                <span
                    key={card}
                    className={cn(
                        'grid h-7 min-w-6 place-items-center rounded-sm border px-1 font-display text-xs font-bold shadow-card',
                        isSpecialCard(card)
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-card text-foreground',
                    )}
                >
                    {card}
                </span>
            ))}
            {hidden > 0 ? (
                <span className="grid h-7 place-items-center px-1 text-xs font-semibold text-muted-foreground">
                    +{hidden}
                </span>
            ) : null}
        </span>
    );
}

export function DeckPicker({
    value,
    onValueChange,
    decks,
    onCreate,
    onEdit,
    onDelete,
    className,
}: DeckPickerProps) {
    const { t } = useTrans();
    const createRef = useRef<HTMLButtonElement>(null);
    const deletedIdRef = useRef<string | null>(null);
    const [deleting, setDeleting] = useState<Deck | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const selected = decks.find((deck) => deck.id === value);

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

    return (
        <div
            data-slot="deck-picker"
            className={cn(
                '@container/deck flex min-w-0 flex-col gap-4',
                className,
            )}
        >
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(48)),1fr))] gap-2">
                <RadioGroup
                    value={value}
                    onValueChange={onValueChange}
                    aria-label={t('Deck')}
                    className="contents"
                >
                    {decks.map((deck) => {
                        const cards = deckCards(deck);
                        const accessibleName = t(':name, :count cards', {
                            name: deck.name,
                            count: cards.length,
                        });
                        const canManage =
                            deck.source === 'saved' && deck.canManage === true;
                        const canEdit = canManage && onEdit !== undefined;
                        const canDelete = canManage && onDelete !== undefined;

                        return (
                            <div
                                key={deck.id}
                                data-slot="deck-option-wrapper"
                                className="flex min-w-0 flex-col gap-1"
                            >
                                <RadioGroupCardItem
                                    value={deck.id}
                                    aria-label={accessibleName}
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
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        {deck.source === 'builtin' ? (
                                            <Badge variant="outline">
                                                {t('Built-in')}
                                            </Badge>
                                        ) : (
                                            <Badge variant="muted">
                                                <Bookmark aria-hidden="true" />
                                                {t('Saved')}
                                            </Badge>
                                        )}
                                        {deck.createdBy ? (
                                            <span className="truncate text-xs text-muted-foreground">
                                                {deck.createdBy.name}
                                            </span>
                                        ) : null}
                                    </span>
                                </RadioGroupCardItem>
                                {canEdit || canDelete ? (
                                    <div
                                        data-slot="deck-manage"
                                        className="flex min-w-0 flex-wrap gap-1"
                                    >
                                        {canEdit ? (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="max-w-full min-w-0"
                                                aria-label={t('Edit :name', {
                                                    name: deck.name,
                                                })}
                                                onClick={() => onEdit(deck.id)}
                                            >
                                                <Pencil aria-hidden="true" />
                                                <span className="truncate">
                                                    {t('Edit')}
                                                </span>
                                            </Button>
                                        ) : null}
                                        {canDelete ? (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="max-w-full min-w-0 text-skrum-destructive-text hover:text-skrum-destructive-text"
                                                aria-label={t('Delete :name', {
                                                    name: deck.name,
                                                })}
                                                onClick={() => {
                                                    setDeleting(deck);
                                                    setConfirmOpen(true);
                                                }}
                                            >
                                                <Trash2 aria-hidden="true" />
                                                <span className="truncate">
                                                    {t('Delete')}
                                                </span>
                                            </Button>
                                        ) : null}
                                    </div>
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
                    className="flex min-h-20 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input p-3 text-sm font-semibold text-muted-foreground transition-colors duration-140 ease-standard outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
                >
                    <Plus aria-hidden="true" className="size-4" />
                    <span className="truncate">{t('Create a deck')}</span>
                </button>
            </div>
            {selected ? (
                <div
                    data-slot="deck-selected"
                    className="flex min-w-0 flex-col gap-2 rounded-lg border bg-skrum-canvas p-3"
                >
                    <span className="truncate text-xs font-semibold text-muted-foreground">
                        {t(':name, :count cards', {
                            name: selected.name,
                            count: deckCards(selected).length,
                        })}
                    </span>
                    <DeckPreviewStrip
                        deck={selected}
                        label={t(':name, :count cards: :values', {
                            name: selected.name,
                            count: deckCards(selected).length,
                            values: deckCards(selected).join(', '),
                        })}
                    />
                </div>
            ) : null}
            {deleting !== null && onDelete !== undefined ? (
                <ConfirmDialog
                    open={confirmOpen}
                    onOpenChange={setConfirmOpen}
                    title={t('Delete this deck?')}
                    description={t(
                        'The saved deck “:name” is removed for the whole team.',
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
