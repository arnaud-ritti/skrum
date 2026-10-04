import type { DeckDraft } from '@/components/skrum/deck-editor';
import {
    DeckMaxNameLength,
    deckShapeFromCards,
} from '@/components/skrum/deck-picker';
import type { Deck } from '@/components/skrum/deck-picker';
import type { PokerDeckOption, SavedPokerDeck } from '@/types';

/** Server key of a deck typed for one game, and id of that deck in the picker. */
export const CustomDeckId = 'custom';

export type DefaultPokerDeck = {
    deck: string | null;
    savedDeckId: string | null;
};

export function toDeck(option: PokerDeckOption): Deck {
    return {
        id: option.value,
        name: option.label,
        source: 'builtin',
        ...deckShapeFromCards(option.cards),
    };
}

export function toSavedDeck(saved: SavedPokerDeck): Deck {
    return {
        id: saved.id,
        name: saved.name,
        source: 'saved',
        scope: saved.scope,
        canManage: saved.canManage === true,
        ...deckShapeFromCards(saved.cards),
    };
}

/** Built-in decks, then saved ones. The server's "custom" option is the picker's "Create a deck". */
export function toDecks(
    options: PokerDeckOption[],
    saved: SavedPokerDeck[],
): Deck[] {
    return [
        ...options
            .filter((option) => option.value !== CustomDeckId)
            .map(toDeck),
        ...saved.map(toSavedDeck),
    ];
}

export function toCustomDeck(draft: DeckDraft, fallbackName: string): Deck {
    const name = draft.name.trim();

    return {
        id: CustomDeckId,
        name: name === '' ? fallbackName : name,
        values: draft.values,
        unknownCard: draft.unknownCard,
        breakCard: draft.breakCard,
        source: 'custom',
        canManage: true,
    };
}

export function customDeckToPayload(draft: DeckDraft): Record<string, unknown> {
    const name = draft.name.trim();

    return {
        deck: CustomDeckId,
        custom_cards: draft.values,
        include_unknown: draft.unknownCard,
        include_coffee: draft.breakCard,
        ...(name === '' ? {} : { save_deck_as: name }),
    };
}

export function deckToPayload(
    deck: Deck,
    customDraft: DeckDraft | null,
): Record<string, unknown> {
    if (deck.source === 'builtin') {
        return { deck: deck.id };
    }

    if (deck.source === 'saved') {
        return { deck: CustomDeckId, saved_deck_id: deck.id };
    }

    return customDeckToPayload(customDraft ?? deck);
}

export function serverErrorsToDeckErrors(
    errors: Record<string, string | undefined>,
): { name?: string; values?: string } {
    const cardKey = Object.keys(errors).find((key) =>
        key.startsWith('custom_cards.'),
    );
    const values =
        errors.custom_cards ??
        (cardKey === undefined ? undefined : errors[cardKey]);
    const name = errors.save_deck_as;

    return {
        ...(values === undefined ? {} : { values }),
        ...(name === undefined ? {} : { name }),
    };
}

/** The deck of the link wins, then the team's default saved deck, its default built-in deck, the first built-in deck. */
export function initialDeckId(
    decks: Deck[],
    defaultPokerDeck: DefaultPokerDeck,
    intentDeck?: string,
): string {
    const has = (id: string | null | undefined): id is string =>
        id !== null && id !== undefined && decks.some((deck) => deck.id === id);

    if (has(intentDeck)) {
        return intentDeck;
    }

    if (has(defaultPokerDeck.savedDeckId)) {
        return defaultPokerDeck.savedDeckId;
    }

    if (has(defaultPokerDeck.deck)) {
        return defaultPokerDeck.deck;
    }

    return (
        decks.find((deck) => deck.source === 'builtin')?.id ??
        decks[0]?.id ??
        ''
    );
}

/** What `teams.pokerDecks.store`, its `update` and the workspace routes take. */
export function savedDeckPayload(draft: DeckDraft): {
    name: string;
    cards: string[];
    include_unknown: boolean;
    include_coffee: boolean;
} {
    return {
        name: draft.name.trim(),
        cards: draft.values,
        include_unknown: draft.unknownCard,
        include_coffee: draft.breakCard,
    };
}

export function serverErrorsToSavedDeckErrors(
    errors: Record<string, string | undefined>,
): { name?: string; values?: string } {
    const cardKey = Object.keys(errors).find((key) => key.startsWith('cards.'));
    const values =
        errors.cards ?? (cardKey === undefined ? undefined : errors[cardKey]);

    return {
        ...(values === undefined ? {} : { values }),
        ...(errors.name === undefined ? {} : { name: errors.name }),
    };
}

/**
 * The name of a copy, as the server names one: cut to the longest deck name
 * and trimmed, then numbered from 2 while a deck of the team has it.
 */
export function copyDeckName(copyName: string, takenNames: string[]): string {
    const taken = new Set(takenNames.map((name) => name.trim().toLowerCase()));
    const cut = (text: string, length: number): string =>
        Array.from(text).slice(0, length).join('').trimEnd();

    let name = cut(copyName, DeckMaxNameLength);
    let number = 2;

    while (taken.has(name.toLowerCase())) {
        const suffix = ` ${number}`;

        name = cut(copyName, DeckMaxNameLength - suffix.length) + suffix;
        number++;
    }

    return name;
}
