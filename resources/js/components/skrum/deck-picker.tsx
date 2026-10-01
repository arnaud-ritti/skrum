import * as RadioGroup from '@radix-ui/react-radio-group';
import { Bookmark, CircleCheck, Pencil, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export const DeckMinValues = 2;
export const DeckMaxValues = 20;
export const DeckMaxValueLength = 4;
export const UnknownCard = '?';
export const BreakCard = '☕';

export interface Deck {
    id: string;
    name: string;
    values: string[];
    unknownCard: boolean;
    breakCard: boolean;
    source: 'builtin' | 'saved';
    createdBy?: { name: string };
}

export interface DeckPickerProps {
    value: string;
    onValueChange: (id: string) => void;
    decks: Deck[];
    onCreate: () => void;
    onEdit?: (id: string) => void;
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
                'grid h-14 min-w-10 shrink-0 place-items-center rounded-lg border px-1.5 font-display text-lg font-bold shadow-card',
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
    className,
}: DeckPickerProps) {
    const { t } = useTrans();
    const selected = decks.find((deck) => deck.id === value);

    return (
        <div
            data-slot="deck-picker"
            className={cn(
                '@container/deck flex min-w-0 flex-col gap-4',
                className,
            )}
        >
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(48)),1fr))] gap-2">
                <RadioGroup.Root
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
                        const canEdit =
                            deck.source === 'saved' && onEdit !== undefined;

                        return (
                            <div key={deck.id} className="relative flex">
                                <RadioGroup.Item
                                    value={deck.id}
                                    aria-label={accessibleName}
                                    data-slot="deck-option"
                                    className={cn(
                                        'group/deck-option flex w-full min-w-0 cursor-pointer flex-col gap-2 rounded-lg border bg-card p-3 text-left shadow-card transition-[background-color,border-color,box-shadow] duration-140 ease-standard outline-none',
                                        'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
                                        'data-[state=checked]:border-primary data-[state=checked]:bg-skrum-primary-soft data-[state=checked]:ring-2 data-[state=checked]:ring-primary',
                                        canEdit && 'pr-10',
                                    )}
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
                                        <RadioGroup.Indicator forceMount>
                                            <CircleCheck
                                                aria-hidden="true"
                                                className="size-4 shrink-0 text-primary opacity-0 group-data-[state=checked]/deck-option:opacity-100"
                                            />
                                        </RadioGroup.Indicator>
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
                                </RadioGroup.Item>
                                {canEdit ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                aria-label={t('Edit :name', {
                                                    name: deck.name,
                                                })}
                                                onClick={() => onEdit(deck.id)}
                                                className="absolute top-2 right-2 grid size-7 place-items-center rounded-sm text-muted-foreground transition-colors duration-140 outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                <Pencil
                                                    aria-hidden="true"
                                                    className="size-3.5"
                                                />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {t('Edit')}
                                        </TooltipContent>
                                    </Tooltip>
                                ) : null}
                            </div>
                        );
                    })}
                </RadioGroup.Root>
                <button
                    type="button"
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
                    className="flex flex-col gap-2 rounded-lg border bg-skrum-canvas p-3"
                >
                    <span className="text-xs font-semibold text-muted-foreground">
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
        </div>
    );
}
