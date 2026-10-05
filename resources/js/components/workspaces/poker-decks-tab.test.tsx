import {
    act,
    fireEvent,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PokerDecksTab } from '@/components/workspaces/poker-decks-tab';
import { renderWithProviders } from '@/test/render';
import type { WorkspacePokerDeck } from '@/types';

type VisitOptions = {
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    reload: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    Link: ({
        href,
        children,
        ...props
    }: {
        href: string;
        children: ReactNode;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
    router: {
        post: mocks.post,
        patch: mocks.patch,
        delete: mocks.delete,
        reload: mocks.reload,
    },
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: mocks.toastError },
}));

const deck: WorkspacePokerDeck = {
    id: 'deck-1',
    name: 'T-shirt sizing',
    cards: ['S', 'M', 'L', '?'],
    usageCount: 4,
    author: { name: 'Bastien L', avatarUrl: '' },
    canManage: true,
};

function tab(decks: WorkspacePokerDeck[], canCreate: boolean) {
    renderWithProviders(
        <PokerDecksTab
            workspace={{ id: 'w1', name: 'Nordlys', slug: 'nordlys' }}
            decks={decks}
            canCreate={canCreate}
            hrefFor={(kind, key) => `/team?new=${kind}&deck=${key}`}
        />,
    );
}

beforeEach(() => {
    for (const mock of [
        mocks.post,
        mocks.patch,
        mocks.delete,
        mocks.reload,
        mocks.toastError,
    ]) {
        mock.mockReset();
    }
});

describe('PokerDecksTab', () => {
    it('shows a deck with its values, its usage, its author and "Use"', () => {
        tab([deck], false);

        const card = screen.getByRole('article', { name: 'T-shirt sizing' });

        expect(within(card).getByText('4 games')).toBeTruthy();
        expect(within(card).getByText('By Bastien L')).toBeTruthy();
        expect(
            within(card).getByRole('group', { name: 'Values' }).textContent,
        ).toContain('S');
        expect(
            within(card)
                .getByRole('link', { name: 'Use T-shirt sizing' })
                .getAttribute('href'),
        ).toBe('/team?new=poker&deck=deck-1');
    });

    it('gives a member no control on a deck', () => {
        tab([{ ...deck, canManage: false }], false);

        expect(screen.queryByRole('button')).toBeNull();
    });

    it('says when the workspace has no deck, with the creation for a manager only', () => {
        tab([], false);

        expect(screen.getByText('No workspace decks yet.')).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Create a deck' }),
        ).toBeNull();
    });

    it('creates a deck of the workspace', async () => {
        tab([deck], true);

        await userEvent.click(
            screen.getByRole('button', { name: 'Create a deck' }),
        );

        const dialog = screen.getByRole('dialog');

        expect(
            within(dialog).getByRole('heading', { name: 'Create a deck' }),
        ).toBeTruthy();

        fireEvent.change(within(dialog).getByLabelText('Name'), {
            target: { value: 'Hours' },
        });

        for (const value of ['1', '2', '4']) {
            const add = within(dialog).getByRole('textbox', {
                name: 'Add a value',
            });

            fireEvent.change(add, { target: { value } });
            fireEvent.keyDown(add, { key: 'Enter' });
        }

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Save' }),
        );

        expect(mocks.post.mock.calls[0][0]).toBe('/w/nordlys/poker-decks');
        expect(mocks.post.mock.calls[0][1]).toMatchObject({
            name: 'Hours',
            cards: ['1', '2', '4'],
        });
    });

    it('says so when a save ends without an answer, the editor still open', async () => {
        tab([deck], true);

        await userEvent.click(
            screen.getByRole('button', { name: 'Actions for T-shirt sizing' }),
        );
        await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
        await userEvent.click(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: 'Save',
            }),
        );
        await act(async () => {
            (mocks.patch.mock.calls[0][2] as VisitOptions).onFinish?.();
        });

        expect(mocks.toastError).toHaveBeenCalledWith(
            'Something went wrong. Please try again.',
        );
        expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('edits a deck through the workspace route', async () => {
        tab([deck], true);

        await userEvent.click(
            screen.getByRole('button', { name: 'Actions for T-shirt sizing' }),
        );
        await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

        const dialog = screen.getByRole('dialog');

        expect(
            within(dialog).getByRole('heading', {
                name: 'Edit T-shirt sizing',
            }),
        ).toBeTruthy();

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Save' }),
        );

        expect(mocks.patch.mock.calls[0][0]).toBe(
            '/w/nordlys/poker-decks/deck-1',
        );
        expect(mocks.patch.mock.calls[0][1]).toEqual({
            name: 'T-shirt sizing',
            cards: ['S', 'M', 'L'],
            include_unknown: true,
            include_coffee: false,
        });
    });

    it('deletes a deck after the confirmation and gives the focus to the section heading', async () => {
        tab([deck], true);

        await userEvent.click(
            screen.getByRole('button', { name: 'Actions for T-shirt sizing' }),
        );
        await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
        await userEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Delete deck',
            }),
        );
        await act(async () => {
            (mocks.delete.mock.calls[0][1] as VisitOptions).onSuccess?.();
        });

        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
        expect(document.activeElement).toBe(
            screen.getByRole('heading', { name: /Planning poker/ }),
        );
    });

    it('shows why a deck could not be deleted', async () => {
        tab([deck], true);

        await userEvent.click(
            screen.getByRole('button', { name: 'Actions for T-shirt sizing' }),
        );
        await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

        const confirm = screen.getByRole('alertdialog');

        expect(
            within(confirm).getByText('Games that use it keep their cards.'),
        ).toBeTruthy();

        await userEvent.click(
            within(confirm).getByRole('button', { name: 'Delete deck' }),
        );

        expect(mocks.delete.mock.calls[0][0]).toBe(
            '/w/nordlys/poker-decks/deck-1',
        );

        await act(async () => {
            (mocks.delete.mock.calls[0][1] as VisitOptions).onFinish?.();
        });

        expect(
            within(screen.getByRole('alertdialog')).getByRole('alert')
                .textContent,
        ).toContain('Something went wrong. Please try again.');
    });

    it('returns the focus to the menu of the card when a dialog opened from it is cancelled', async () => {
        tab([deck], true);

        const menu = screen.getByRole('button', {
            name: 'Actions for T-shirt sizing',
        });

        await userEvent.click(menu);
        await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
        await userEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Cancel',
            }),
        );

        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
        await waitFor(() => expect(document.activeElement).toBe(menu));

        await userEvent.click(menu);
        await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
        await userEvent.click(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: 'Cancel',
            }),
        );

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        await waitFor(() => expect(document.activeElement).toBe(menu));
    });
});
