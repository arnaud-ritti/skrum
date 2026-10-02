import { describe, expect, it } from 'vitest';
import type { Deck } from '@/components/skrum/deck-picker';
import {
    CustomDeckId,
    customDeckToPayload,
    deckToPayload,
    initialDeckId,
    serverErrorsToDeckErrors,
    toCustomDeck,
    toDeck,
    toDecks,
    toSavedDeck,
} from '@/lib/poker/deck-adapter';

const fibonacci = toDeck({
    value: 'fibonacci',
    label: 'Fibonacci',
    cards: ['0', '1', '2', '3', '?', '☕'],
});
const tshirt = toDeck({
    value: 'tshirt',
    label: 'T-shirt sizes',
    cards: ['S', 'M', 'L', '?'],
});
const teamScale = toSavedDeck({
    id: 'deck-1',
    name: 'Team scale',
    cards: ['1', '2', '3', '☕'],
    scope: 'team',
    canManage: true,
});
const hours = toSavedDeck({
    id: 'deck-2',
    name: 'Hours',
    cards: ['1', '2', '4'],
    scope: 'workspace',
});
const decks: Deck[] = [fibonacci, tshirt, teamScale, hours];

describe('deck adapter', () => {
    it('turns a built-in option into a deck of the picker', () => {
        expect(fibonacci).toEqual({
            id: 'fibonacci',
            name: 'Fibonacci',
            values: ['0', '1', '2', '3'],
            unknownCard: true,
            breakCard: true,
            source: 'builtin',
        });
        expect(tshirt.breakCard).toBe(false);
    });

    it('turns a saved deck into a deck of the picker, with its scope', () => {
        expect(teamScale).toEqual({
            id: 'deck-1',
            name: 'Team scale',
            values: ['1', '2', '3'],
            unknownCard: false,
            breakCard: true,
            source: 'saved',
            scope: 'team',
            canManage: true,
        });
        expect(hours.scope).toBe('workspace');
        expect(hours.canManage).toBe(false);
    });

    it('lists the built-in decks then the saved ones, without the server "custom" option', () => {
        const all = toDecks(
            [
                { value: 'fibonacci', label: 'Fibonacci', cards: ['1', '2'] },
                { value: 'custom', label: 'Custom', cards: [] },
            ],
            [{ id: 'deck-1', name: 'Team scale', cards: ['1'], scope: 'team' }],
        );

        expect(all.map((deck) => deck.id)).toEqual(['fibonacci', 'deck-1']);
    });

    it('shows the deck typed for the game under a name of its own', () => {
        const draft = {
            name: '  ',
            values: ['1', '2'],
            unknownCard: true,
            breakCard: false,
        };

        expect(toCustomDeck(draft, 'Custom deck')).toEqual({
            id: CustomDeckId,
            name: 'Custom deck',
            values: ['1', '2'],
            unknownCard: true,
            breakCard: false,
            source: 'custom',
            canManage: true,
        });
        expect(
            toCustomDeck({ ...draft, name: ' Halves ' }, 'Custom deck').name,
        ).toBe('Halves');
    });

    it('sends the key of a built-in deck', () => {
        expect(deckToPayload(fibonacci, null)).toEqual({ deck: 'fibonacci' });
    });

    it('sends the id of a saved deck', () => {
        expect(deckToPayload(teamScale, null)).toEqual({
            deck: 'custom',
            saved_deck_id: 'deck-1',
        });
    });

    it('sends the cards of a one-off deck, and its name only when it has one', () => {
        const draft = {
            name: ' ',
            values: ['1', '2', '3'],
            unknownCard: false,
            breakCard: true,
        };

        expect(customDeckToPayload(draft)).toEqual({
            deck: 'custom',
            custom_cards: ['1', '2', '3'],
            include_unknown: false,
            include_coffee: true,
        });
        expect(customDeckToPayload({ ...draft, name: ' Halves ' })).toEqual({
            deck: 'custom',
            custom_cards: ['1', '2', '3'],
            include_unknown: false,
            include_coffee: true,
            save_deck_as: 'Halves',
        });
        expect(
            deckToPayload(toCustomDeck(draft, 'Custom deck'), draft),
        ).toEqual(customDeckToPayload(draft));
    });

    it('maps the server errors of the cards to the values and of the name to the name', () => {
        expect(
            serverErrorsToDeckErrors({
                'custom_cards.1': 'The card is too long.',
                save_deck_as: 'A deck with this name already exists.',
                title: 'The title is required.',
            }),
        ).toEqual({
            values: 'The card is too long.',
            name: 'A deck with this name already exists.',
        });
        expect(
            serverErrorsToDeckErrors({
                custom_cards: 'Give between 2 and 20 cards.',
                'custom_cards.0': 'The card is too long.',
            }),
        ).toEqual({ values: 'Give between 2 and 20 cards.' });
        expect(serverErrorsToDeckErrors({ title: 'Required.' })).toEqual({});
    });

    it('opens on the deck of the link, then the default saved deck, then the default built-in deck, then the first built-in deck', () => {
        const none = { deck: null, savedDeckId: null };

        expect(
            initialDeckId(
                decks,
                { deck: 'tshirt', savedDeckId: 'deck-1' },
                'deck-2',
            ),
        ).toBe('deck-2');
        expect(
            initialDeckId(decks, { deck: 'tshirt', savedDeckId: 'deck-1' }),
        ).toBe('deck-1');
        expect(
            initialDeckId(
                decks,
                { deck: 'tshirt', savedDeckId: 'gone' },
                'unknown',
            ),
        ).toBe('tshirt');
        expect(
            initialDeckId(decks, { deck: 'tshirt', savedDeckId: null }),
        ).toBe('tshirt');
        expect(initialDeckId(decks, none)).toBe('fibonacci');
        expect(initialDeckId([teamScale, tshirt], none)).toBe('tshirt');
        expect(initialDeckId([teamScale], none)).toBe('deck-1');
        expect(initialDeckId([], none)).toBe('');
    });
});
