import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SavedDecksPage } from '@/components/poker/saved-decks-page';
import type { SavedDecksPageProps } from '@/components/poker/saved-decks-page';
import { renderWithProviders } from '@/test/render';
import type { SavedDeckSummary } from '@/types';

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    reload: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string | { url: string };
            children: React.ReactNode;
        }) => (
            <a href={typeof href === 'string' ? href : href.url} {...props}>
                {children}
            </a>
        ),
        router: {
            post: mocks.post,
            patch: mocks.patch,
            put: mocks.put,
            delete: mocks.delete,
            reload: mocks.reload,
        },
    };
});

vi.mock('sonner', () => ({
    toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

type VisitOptions = {
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onHttpException?: () => boolean;
    onFinish?: () => void;
};

const hours: SavedDeckSummary = {
    id: 'deck-1',
    name: 'Hours',
    cards: ['1 h', '2 h', '?'],
    scope: 'team',
    canManage: true,
    isDefault: false,
    usageCount: 4,
    createdBy: 'Malik K',
};

const notMine: SavedDeckSummary = {
    ...hours,
    id: 'deck-2',
    name: 'Not mine',
    canManage: false,
};

const house: SavedDeckSummary = {
    ...hours,
    id: 'deck-3',
    name: 'House scale',
    scope: 'workspace',
    cards: ['S', 'M', 'L', '☕'],
};

const base: SavedDecksPageProps = {
    workspace: { id: 'w', name: 'Nordlys', slug: 'nordlys' },
    team: { id: 'team-1', name: 'Atlas' },
    builtInDecks: [
        {
            key: 'fibonacci',
            name: 'Fibonacci',
            cards: ['0', '1', '2', '?', '☕'],
            isDefault: true,
            usageCount: 31,
        },
        {
            key: 'tshirt',
            name: 'T-shirt sizes',
            cards: ['S', 'M', 'L', '?'],
            isDefault: false,
            usageCount: 0,
        },
    ],
    savedDecks: [hours, notMine, house],
    canCreate: true,
    canSetDefault: true,
    deckLimit: 30,
};

function renderPage(props: Partial<SavedDecksPageProps> = {}) {
    return renderWithProviders(<SavedDecksPage {...base} {...props} />);
}

function card(name: string): HTMLElement {
    return screen.getByRole('article', { name });
}

function lastCall(mock: ReturnType<typeof vi.fn>): unknown[] {
    return mock.mock.calls[mock.mock.calls.length - 1];
}

beforeEach(() => {
    for (const mock of Object.values(mocks)) {
        mock.mockReset();
    }
});

describe('SavedDecksPage', () => {
    it('lists the built-in decks, then the saved decks, then the creation tile', () => {
        renderPage();

        expect(
            screen.getByRole('heading', { level: 1, name: 'Saved decks' }),
        ).toBeTruthy();
        expect(
            screen.getByText('Shared by every game of the team'),
        ).toBeTruthy();
        expect(
            screen
                .getAllByRole('article')
                .map(
                    (article) =>
                        within(article).getByRole('heading').textContent,
                ),
        ).toEqual([
            'Fibonacci',
            'T-shirt sizes',
            'Hours',
            'Not mine',
            'House scale',
        ]);
        expect(
            screen
                .getByRole('link', { name: 'Back to the team' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1');
        expect(
            screen.getByRole('button', { name: /Create a custom deck/ }),
        ).toBeTruthy();
    });

    it('offers Edit and Delete only on a deck the user manages', () => {
        renderPage();

        expect(
            within(card('Hours')).getByRole('button', { name: 'Edit Hours' }),
        ).toBeTruthy();
        expect(
            within(card('Hours')).getByRole('button', { name: 'Delete Hours' }),
        ).toBeTruthy();
        expect(
            within(card('Not mine')).queryByRole('button', { name: /^Edit/ }),
        ).toBeNull();
        expect(
            within(card('Not mine')).queryByRole('button', { name: /^Delete/ }),
        ).toBeNull();
        expect(
            within(card('Fibonacci')).queryByRole('button', { name: /^Edit/ }),
        ).toBeNull();
    });

    it('hides the creation controls and Duplicate from a user who cannot create', () => {
        renderPage({ canCreate: false, canSetDefault: false, savedDecks: [] });

        expect(screen.queryByRole('button', { name: 'New deck' })).toBeNull();
        expect(
            screen.queryByRole('button', { name: /Create a custom deck/ }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: /^Duplicate/ })).toBeNull();
        expect(
            screen.queryByRole('button', { name: /as default$/ }),
        ).toBeNull();
        expect(screen.getByText('No saved decks yet.')).toBeTruthy();
    });

    it('says the team has no saved deck in the creation tile', () => {
        renderPage({ savedDecks: [] });

        expect(
            within(
                screen.getByRole('button', { name: /Create a custom deck/ }),
            ).getByText('No saved decks yet.'),
        ).toBeTruthy();
    });

    it('stops creation and duplication at the deck limit of the team, with the reason', () => {
        renderPage({ deckLimit: 2 });

        expect(screen.getByRole('status').textContent).toBe(
            'This team already has 2 saved decks.',
        );
        expect(screen.queryByRole('button', { name: 'New deck' })).toBeNull();
        expect(screen.queryByRole('button', { name: /^Duplicate/ })).toBeNull();
    });

    it('creates a deck of the team from the editor and closes it', () => {
        renderPage();

        fireEvent.click(screen.getByRole('button', { name: 'New deck' }));

        const dialog = screen.getByRole('dialog', { name: 'Create a deck' });
        const name = dialog.querySelector('#deck-new-name') as HTMLInputElement;
        const cards = dialog.querySelector(
            '#deck-new-cards',
        ) as HTMLInputElement;

        expect(
            dialog
                .querySelector('#deck-new-unknown')
                ?.getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            dialog
                .querySelector('#deck-new-coffee')
                ?.getAttribute('aria-checked'),
        ).toBe('true');

        fireEvent.change(name, { target: { value: ' Team scale ' } });
        fireEvent.change(cards, { target: { value: '1, 2, 3' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

        const [url, payload, options] = lastCall(mocks.post) as [
            string,
            unknown,
            VisitOptions,
        ];

        expect(url).toBe('/w/nordlys/teams/team-1/poker-decks');
        expect(payload).toEqual({
            name: 'Team scale',
            cards: ['1', '2', '3'],
            include_unknown: true,
            include_coffee: true,
        });

        act(() => options.onSuccess?.());

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows the server errors of a deck in the editor, which stays open', () => {
        renderPage();

        fireEvent.click(
            screen.getByRole('button', { name: /Create a custom deck/ }),
        );

        const dialog = screen.getByRole('dialog');

        fireEvent.change(
            dialog.querySelector('#deck-new-name') as HTMLInputElement,
            { target: { value: 'hours' } },
        );
        fireEvent.change(
            dialog.querySelector('#deck-new-cards') as HTMLInputElement,
            { target: { value: '1, 2' } },
        );
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

        const options = lastCall(mocks.post)[2] as VisitOptions;

        act(() =>
            options.onError?.({
                name: 'A deck with this name already exists.',
            }),
        );

        expect(
            within(screen.getByRole('dialog')).getByText(
                'A deck with this name already exists.',
            ),
        ).toBeTruthy();
    });

    it('edits a deck of the team under its own field ids', () => {
        renderPage();

        fireEvent.click(screen.getByRole('button', { name: 'Edit Hours' }));

        const dialog = screen.getByRole('dialog', { name: 'Edit Hours' });

        expect(
            (dialog.querySelector('#deck-deck-1-name') as HTMLInputElement)
                .value,
        ).toBe('Hours');
        expect(
            dialog
                .querySelector('#deck-deck-1-coffee')
                ?.getAttribute('aria-checked'),
        ).toBe('false');

        fireEvent.change(
            dialog.querySelector('#deck-deck-1-cards') as HTMLInputElement,
            { target: { value: '4 h,' } },
        );
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

        const [url, payload] = lastCall(mocks.patch) as [string, unknown];

        expect(url).toBe('/w/nordlys/teams/team-1/poker-decks/deck-1');
        expect(payload).toEqual({
            name: 'Hours',
            cards: ['1 h', '2 h', '4 h'],
            include_unknown: true,
            include_coffee: false,
        });
    });

    it('edits and deletes a workspace deck through the workspace routes', async () => {
        renderPage();

        fireEvent.click(
            screen.getByRole('button', { name: 'Edit House scale' }),
        );
        fireEvent.click(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: 'Save',
            }),
        );

        expect(lastCall(mocks.patch)[0]).toBe('/w/nordlys/poker-decks/deck-3');

        act(() => (lastCall(mocks.patch)[2] as VisitOptions).onSuccess?.());

        fireEvent.click(
            screen.getByRole('button', { name: 'Delete House scale' }),
        );
        fireEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Delete deck',
            }),
        );

        expect(lastCall(mocks.delete)[0]).toBe('/w/nordlys/poker-decks/deck-3');
    });

    it('deletes a deck only after the confirmation, which says games keep their cards', async () => {
        renderPage();

        fireEvent.click(screen.getByRole('button', { name: 'Delete Hours' }));

        const confirm = screen.getByRole('alertdialog', {
            name: 'Delete this deck?',
        });

        expect(
            within(confirm).getByText('Games that use it keep their cards.'),
        ).toBeTruthy();
        expect(mocks.delete).not.toHaveBeenCalled();

        fireEvent.click(
            within(confirm).getByRole('button', { name: 'Delete deck' }),
        );

        const [url, options] = lastCall(mocks.delete) as [string, VisitOptions];

        expect(url).toBe('/w/nordlys/teams/team-1/poker-decks/deck-1');

        await act(async () => options.onFinish?.());

        expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('keeps the deck when the deletion is cancelled', () => {
        renderPage();

        fireEvent.click(screen.getByRole('button', { name: 'Delete Hours' }));
        fireEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Cancel',
            }),
        );

        expect(mocks.delete).not.toHaveBeenCalled();
    });

    it('duplicates a deck of the team through the duplicate route', () => {
        renderPage();

        fireEvent.click(
            screen.getByRole('button', { name: 'Duplicate Hours' }),
        );

        const [url, , options] = lastCall(mocks.post) as [
            string,
            unknown,
            VisitOptions,
        ];

        expect(url).toBe(
            '/w/nordlys/teams/team-1/poker-decks/deck-1/duplicate',
        );

        act(() => options.onSuccess?.());

        expect(mocks.toastSuccess).toHaveBeenCalledWith('Deck duplicated.');
    });

    it('duplicates a built-in deck as a new deck of the team named "Copy of"', () => {
        renderPage({
            savedDecks: [{ ...hours, name: 'Copy of Fibonacci' }, house],
        });

        fireEvent.click(
            screen.getByRole('button', { name: 'Duplicate Fibonacci' }),
        );

        const [url, payload] = lastCall(mocks.post) as [string, unknown];

        expect(url).toBe('/w/nordlys/teams/team-1/poker-decks');
        expect(payload).toEqual({
            name: 'Copy of Fibonacci 2',
            cards: ['0', '1', '2'],
            include_unknown: true,
            include_coffee: true,
        });
    });

    it('duplicates a workspace deck as a deck of the team', () => {
        renderPage();

        fireEvent.click(
            screen.getByRole('button', { name: 'Duplicate House scale' }),
        );

        const [url, payload] = lastCall(mocks.post) as [string, unknown];

        expect(url).toBe('/w/nordlys/teams/team-1/poker-decks');
        expect(payload).toEqual({
            name: 'Copy of House scale',
            cards: ['S', 'M', 'L'],
            include_unknown: false,
            include_coffee: true,
        });
    });

    it('shows the refusal of a duplication', () => {
        renderPage();

        fireEvent.click(
            screen.getByRole('button', { name: 'Duplicate Hours' }),
        );

        act(() =>
            (lastCall(mocks.post)[2] as VisitOptions).onError?.({
                name: 'This team already has 30 saved decks.',
            }),
        );

        expect(mocks.toastError).toHaveBeenCalledWith(
            'This team already has 30 saved decks.',
        );
    });

    it('sets a built-in deck or a saved deck as the default of the team', () => {
        renderPage();

        expect(
            within(card('Fibonacci')).queryByRole('button', {
                name: /as default$/,
            }),
        ).toBeNull();

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Set T-shirt sizes as default',
            }),
        );

        expect(lastCall(mocks.put).slice(0, 2)).toEqual([
            '/w/nordlys/teams/team-1/default-poker-deck',
            { deck: 'tshirt' },
        ]);

        fireEvent.click(
            screen.getByRole('button', { name: 'Set House scale as default' }),
        );

        expect(lastCall(mocks.put)[1]).toEqual({ saved_deck_id: 'deck-3' });
    });

    it('reloads the page when the server no longer knows the deck', () => {
        renderPage();

        fireEvent.click(screen.getByRole('button', { name: 'Edit Hours' }));
        fireEvent.click(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: 'Save',
            }),
        );

        let handled: boolean | undefined;

        act(() => {
            handled = (
                lastCall(mocks.patch)[2] as VisitOptions
            ).onHttpException?.();
        });

        expect(handled).toBe(false);
        expect(mocks.reload).toHaveBeenCalledOnce();
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
