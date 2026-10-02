import { isSpecialCard, SpecialCards } from '@/lib/poker/types';

export type DeckChoice = {
    deck: string;
    customCards: string;
    includeUnknown: boolean;
    includeCoffee: boolean;
    savedDeckId: string | null;
    saveDeckAs: string;
};

const [UnknownCard, CoffeeCard] = SpecialCards;

export function emptyDeckChoice(): DeckChoice {
    return {
        deck: 'fibonacci',
        customCards: '',
        includeUnknown: true,
        includeCoffee: true,
        savedDeckId: null,
        saveDeckAs: '',
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
        ...emptyDeckChoice(),
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
    if (choice.savedDeckId !== null) {
        return { deck: 'custom', saved_deck_id: choice.savedDeckId };
    }

    if (choice.deck !== 'custom') {
        return { deck: choice.deck };
    }

    const payload: Record<string, unknown> = {
        deck: 'custom',
        custom_cards: splitCustomCards(choice.customCards),
        include_unknown: choice.includeUnknown,
        include_coffee: choice.includeCoffee,
    };
    const saveDeckAs = choice.saveDeckAs.trim();

    if (saveDeckAs !== '') {
        payload.save_deck_as = saveDeckAs;
    }

    return payload;
}
