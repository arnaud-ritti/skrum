import InputError from '@/components/input-error';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { isSpecialCard, SpecialCards } from '@/lib/poker/types';
import { cn } from '@/lib/utils';
import type { PokerDeckOption } from '@/types';

export type DeckChoice = {
    deck: string;
    customCards: string;
    includeUnknown: boolean;
    includeCoffee: boolean;
};

const [UnknownCard, CoffeeCard] = SpecialCards;

export function emptyDeckChoice(): DeckChoice {
    return {
        deck: 'fibonacci',
        customCards: '',
        includeUnknown: true,
        includeCoffee: true,
    };
}

export function deckChoiceFromGame(game: {
    deck: string;
    cards: string[];
}): DeckChoice {
    if (game.deck !== 'custom') {
        return { ...emptyDeckChoice(), deck: game.deck };
    }

    return {
        deck: 'custom',
        customCards: game.cards
            .filter((card) => !isSpecialCard(card))
            .join(', '),
        includeUnknown: game.cards.includes(UnknownCard),
        includeCoffee: game.cards.includes(CoffeeCard),
    };
}

export function splitCustomCards(value: string): string[] {
    return value
        .split(',')
        .map((card) => card.trim())
        .filter((card) => card !== '');
}

export function deckPayload(choice: DeckChoice): Record<string, unknown> {
    if (choice.deck !== 'custom') {
        return { deck: choice.deck };
    }

    return {
        deck: 'custom',
        custom_cards: splitCustomCards(choice.customCards),
        include_unknown: choice.includeUnknown,
        include_coffee: choice.includeCoffee,
    };
}

type Props = {
    deckOptions: PokerDeckOption[];
    value: DeckChoice;
    onChange: (value: DeckChoice) => void;
    disabled?: boolean;
    errors?: Record<string, string | undefined>;
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
                {deckOptions.map((option) => {
                    const checked = value.deck === option.value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            disabled={disabled}
                            className={cn(
                                'rounded-md border p-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60',
                                checked && 'border-primary bg-muted',
                            )}
                            onClick={() => update({ deck: option.value })}
                        >
                            <span className="block text-sm font-medium">
                                {option.label}
                            </span>
                            {option.cards.length > 0 && (
                                <span className="mt-1 flex flex-wrap gap-1">
                                    {option.cards.map((card) => (
                                        <span
                                            key={card}
                                            className="min-w-6 rounded border bg-background px-1 text-center font-mono text-xs"
                                        >
                                            {card}
                                        </span>
                                    ))}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            <InputError message={errors.deck} />

            {value.deck === 'custom' && (
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
                </div>
            )}
        </fieldset>
    );
}
