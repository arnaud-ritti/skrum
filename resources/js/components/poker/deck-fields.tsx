import InputError from '@/components/input-error';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import type { DeckChoice } from '@/lib/poker/deck-payload';
import { SpecialCards } from '@/lib/poker/types';
import { cn } from '@/lib/utils';
import type { PokerDeckOption, SavedPokerDeck } from '@/types';

export {
    deckChoiceFromGame,
    deckPayload,
    emptyDeckChoice,
    splitCustomCards,
} from '@/lib/poker/deck-payload';
export type { DeckChoice } from '@/lib/poker/deck-payload';

const [UnknownCard, CoffeeCard] = SpecialCards;

function CardChips({ cards }: { cards: string[] }) {
    return (
        <span className="mt-1 flex flex-wrap gap-1">
            {cards.map((card) => (
                <span
                    key={card}
                    className="min-w-6 rounded border bg-background px-1 text-center font-mono text-xs"
                >
                    {card}
                </span>
            ))}
        </span>
    );
}

function DeckRadio({
    label,
    cards,
    checked,
    disabled,
    onSelect,
}: {
    label: string;
    cards: string[];
    checked: boolean;
    disabled: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            className={cn(
                'rounded-md border p-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60',
                checked && 'border-primary bg-muted',
            )}
            onClick={onSelect}
        >
            <span className="block text-sm font-medium">{label}</span>
            {cards.length > 0 && <CardChips cards={cards} />}
        </button>
    );
}

type Props = {
    deckOptions: PokerDeckOption[];
    value: DeckChoice;
    onChange: (value: DeckChoice) => void;
    disabled?: boolean;
    errors?: Record<string, string | undefined>;
    savedDecks?: SavedPokerDeck[];
    allowSaveAs?: boolean;
};

function customCardsError(
    errors: Record<string, string | undefined>,
): string | undefined {
    if (errors.custom_cards) {
        return errors.custom_cards;
    }

    const itemKey = Object.keys(errors).find((key) =>
        key.startsWith('custom_cards.'),
    );

    return itemKey ? errors[itemKey] : undefined;
}

export function DeckFields({
    deckOptions,
    value,
    onChange,
    disabled = false,
    errors = {},
    savedDecks = [],
    allowSaveAs = false,
}: Props) {
    const { t } = useTrans();
    const update = (changes: Partial<DeckChoice>) =>
        onChange({ ...value, ...changes });

    return (
        <fieldset className="space-y-2" disabled={disabled}>
            <legend className="text-sm font-medium">{t('Deck')}</legend>
            <div
                role="radiogroup"
                aria-label={t('Deck')}
                className="grid gap-1"
            >
                {deckOptions
                    .filter((option) => option.value !== 'custom')
                    .map((option) => (
                        <DeckRadio
                            key={option.value}
                            label={option.label}
                            cards={option.cards}
                            checked={
                                value.savedDeckId === null &&
                                value.deck === option.value
                            }
                            disabled={disabled}
                            onSelect={() =>
                                update({
                                    deck: option.value,
                                    savedDeckId: null,
                                })
                            }
                        />
                    ))}
                {savedDecks.length > 0 && (
                    <p className="pt-2 text-xs font-semibold text-muted-foreground uppercase">
                        {t("Your team's decks")}
                    </p>
                )}
                {savedDecks.map((saved) => (
                    <DeckRadio
                        key={saved.id}
                        label={saved.name}
                        cards={saved.cards}
                        checked={value.savedDeckId === saved.id}
                        disabled={disabled}
                        onSelect={() =>
                            update({ deck: 'custom', savedDeckId: saved.id })
                        }
                    />
                ))}
                {deckOptions
                    .filter((option) => option.value === 'custom')
                    .map((option) => (
                        <DeckRadio
                            key={option.value}
                            label={option.label}
                            cards={option.cards}
                            checked={
                                value.savedDeckId === null &&
                                value.deck === 'custom'
                            }
                            disabled={disabled}
                            onSelect={() =>
                                update({ deck: 'custom', savedDeckId: null })
                            }
                        />
                    ))}
            </div>
            <InputError message={errors.deck} />
            <InputError message={errors.saved_deck_id} />

            {value.deck === 'custom' && value.savedDeckId === null && (
                <div className="space-y-2 rounded-md border p-3">
                    <div className="grid gap-2">
                        <Label htmlFor="deck-custom-cards">
                            {t('Custom cards')}
                        </Label>
                        <Input
                            id="deck-custom-cards"
                            value={value.customCards}
                            placeholder="1, 2, 3, 5, 8"
                            onChange={(event) =>
                                update({ customCards: event.target.value })
                            }
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('Separate cards with commas.')}
                        </p>
                        <InputError message={customCardsError(errors)} />
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="deck-include-unknown"
                                checked={value.includeUnknown}
                                onCheckedChange={(checked) =>
                                    update({ includeUnknown: checked === true })
                                }
                            />
                            <Label htmlFor="deck-include-unknown">
                                {t('Add :card', { card: UnknownCard })}
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="deck-include-coffee"
                                checked={value.includeCoffee}
                                onCheckedChange={(checked) =>
                                    update({ includeCoffee: checked === true })
                                }
                            />
                            <Label htmlFor="deck-include-coffee">
                                {t('Add :card', { card: CoffeeCard })}
                            </Label>
                        </div>
                    </div>
                    {allowSaveAs && (
                        <div className="grid gap-2">
                            <Label htmlFor="deck-save-as">
                                {t('Save this deck for the team as…')}
                            </Label>
                            <Input
                                id="deck-save-as"
                                value={value.saveDeckAs}
                                maxLength={40}
                                placeholder={t('Deck name')}
                                onChange={(event) =>
                                    update({ saveDeckAs: event.target.value })
                                }
                            />
                            <InputError message={errors.save_deck_as} />
                        </div>
                    )}
                </div>
            )}
        </fieldset>
    );
}
