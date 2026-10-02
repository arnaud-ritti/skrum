import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { retroRequest } from '@/lib/retro/api';
import { renderWithProviders } from '@/test/render';
import { boardState } from '@/test/whiteboard-state';
import { BoardMenu } from './board-menu';

const mocks = vi.hoisted(() => ({ visit: vi.fn() }));

vi.mock('@/lib/retro/api', async (original) => ({
    ...(await original<typeof import('@/lib/retro/api')>()),
    retroRequest: vi.fn(async () => null),
}));

vi.mock('@inertiajs/react', async (original) => ({
    ...(await original<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router: { visit: mocks.visit },
}));

afterEach(() => {
    vi.mocked(retroRequest).mockReset();
    vi.mocked(retroRequest).mockImplementation(async () => null);
    mocks.visit.mockClear();
});

type State = ReturnType<typeof boardState>;

async function openMenu(state: State, onHide = vi.fn()) {
    const user = userEvent.setup();

    renderWithProviders(
        <BoardMenu
            state={state}
            hideMyCursor={false}
            onHideMyCursorChange={onHide}
        />,
    );

    await user.click(screen.getByRole('button', { name: 'Board menu' }));

    return { user, menu: within(screen.getByRole('menu')), onHide };
}

const names = (items: HTMLElement[]): string[] =>
    items.map((item) => item.textContent ?? '');

describe('BoardMenu', () => {
    it('gives the facilitator every entry, the deletion last, and no guest-link entry', async () => {
        const { menu } = await openMenu(boardState());

        expect(names(menu.getAllByRole('menuitem'))).toEqual([
            'Duplicate this board',
            'Save as template',
            'Rename',
            'Hand over facilitation',
            'Delete this board',
        ]);
        expect(names(menu.getAllByRole('menuitemcheckbox'))).toEqual([
            'Hide my cursor',
            'Show live cursors',
            'Show flying reactions',
        ]);
        expect(
            menu
                .getAllByRole('menuitem')
                .every((item) => item.querySelector('svg') !== null),
        ).toBe(true);
        expect(menu.queryByText(/guest/i)).toBeNull();
    });

    it('gives a guest "Hide my cursor" alone, without a separator', async () => {
        const { user, menu, onHide } = await openMenu(
            boardState({
                me: {
                    isGuest: true,
                    isFacilitator: false,
                    canDelete: false,
                    userId: null,
                },
                links: { team: null },
            }),
        );

        expect(menu.queryAllByRole('menuitem')).toEqual([]);
        expect(menu.queryAllByRole('separator')).toEqual([]);
        expect(names(menu.getAllByRole('menuitemcheckbox'))).toEqual([
            'Hide my cursor',
        ]);

        await user.click(menu.getByRole('menuitemcheckbox'));

        expect(onHide).toHaveBeenCalledWith(true);
    });

    it('lets a member who may do so take control, and no facilitator entry', async () => {
        const state = boardState({
            me: {
                isFacilitator: false,
                canTakeControl: true,
                canDelete: false,
            },
        });
        const { user, menu } = await openMenu(state);

        expect(names(menu.getAllByRole('menuitem'))).toEqual([
            'Take control',
            'Duplicate this board',
            'Save as template',
        ]);

        await user.click(menu.getByRole('menuitem', { name: 'Take control' }));

        await waitFor(() => expect(state.refetch).toHaveBeenCalledTimes(1));

        expect(vi.mocked(retroRequest).mock.calls[0][1]).toEqual({
            user_id: 'user-fran',
        });
    });

    it('switches a board setting from its checkbox and refetches', async () => {
        const state = boardState();
        const { user, menu } = await openMenu(state);

        await user.click(
            menu.getByRole('menuitemcheckbox', {
                name: 'Show flying reactions',
            }),
        );

        await waitFor(() => expect(state.refetch).toHaveBeenCalledTimes(1));

        expect(vi.mocked(retroRequest).mock.calls[0][1]).toEqual({
            reactions_enabled: false,
        });
    });

    it('opens the copy of a duplicated board', async () => {
        vi.mocked(retroRequest).mockResolvedValueOnce({
            url: '/whiteboards/copy',
        } as never);

        const { user, menu } = await openMenu(boardState());

        await user.click(
            menu.getByRole('menuitem', { name: 'Duplicate this board' }),
        );

        await waitFor(() =>
            expect(mocks.visit).toHaveBeenCalledWith('/whiteboards/copy'),
        );
    });

    it.each([
        ['Rename', 'dialog', 'Rename'],
        ['Save as template', 'dialog', 'Save as template'],
        ['Hand over facilitation', 'dialog', 'Hand over facilitation'],
        ['Delete this board', 'alertdialog', 'Delete this board?'],
    ])('opens the dialog of "%s"', async (entry, role, title) => {
        const { user, menu } = await openMenu(boardState());

        await user.click(menu.getByRole('menuitem', { name: entry }));

        expect(await screen.findByRole(role, { name: title })).toBeTruthy();
        expect(screen.queryByRole('menu')).toBeNull();
    });
});
