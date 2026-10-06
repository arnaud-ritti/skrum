import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { retroRequest } from '@/lib/retro/api';
import { openKeyboardShortcutsEvent } from '@/lib/shortcuts/events';
import { renderWithProviders } from '@/test/render';
import { BoardActions, BoardPresence, BoardTitle } from './board-header';
import { boardState } from '@/test/whiteboard-state';

vi.mock('@/lib/retro/api', async (original) => ({
    ...(await original<typeof import('@/lib/retro/api')>()),
    retroRequest: vi.fn(async () => null),
}));

afterEach(() => {
    vi.mocked(retroRequest).mockClear();
});

function sentBodies(): unknown[] {
    return vi.mocked(retroRequest).mock.calls.map(([, body]) => body);
}

describe('BoardTitle', () => {
    it("shows the board's name with the team above it and no path", () => {
        renderWithProviders(<BoardTitle state={boardState()} />);

        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Sprint board',
        );
        expect(
            document.querySelector('[data-slot="session-overline"]')
                ?.textContent,
        ).toBe('Atlas · Whiteboard');
        expect(
            screen.queryByRole('navigation', { name: 'Breadcrumb' }),
        ).toBeNull();
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('shows a guest "Whiteboard" above the name, without the team and without a link', () => {
        renderWithProviders(
            <BoardTitle
                state={boardState({
                    board: { teamName: null },
                    me: { isGuest: true, isFacilitator: false },
                    links: { team: null, sessions: null },
                })}
            />,
        );

        expect(
            document.querySelector('[data-slot="session-overline"]')
                ?.textContent,
        ).toBe('Whiteboard');
        expect(
            screen.queryByRole('navigation', { name: 'Breadcrumb' }),
        ).toBeNull();
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Sprint board',
        );
    });

    it('keeps the name editable', () => {
        renderWithProviders(<BoardTitle state={boardState()} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Rename the board' }),
        );

        expect(
            (
                screen.getByRole('textbox', {
                    name: 'Board name',
                }) as HTMLInputElement
            ).value,
        ).toBe('Sprint board');
    });

    it('turns the name into the "Board name" field on a press, saves on Enter and refetches', async () => {
        const state = boardState();

        renderWithProviders(<BoardTitle state={state} />);
        fireEvent.click(screen.getByRole('button', { name: 'Sprint board' }));

        const field = screen.getByRole('textbox', { name: 'Board name' });

        expect((field as HTMLInputElement).value).toBe('Sprint board');
        expect(field.getAttribute('maxlength')).toBe('120');

        fireEvent.change(field, { target: { value: '  Sprint 43 board ' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        await waitFor(() => expect(state.refetch).toHaveBeenCalledTimes(1));

        expect(sentBodies()).toEqual([{ title: 'Sprint 43 board' }]);
        await waitFor(() =>
            expect(
                screen.queryByRole('textbox', { name: 'Board name' }),
            ).toBeNull(),
        );
    });

    it('opens the field with F2 and with the pencil button', () => {
        renderWithProviders(<BoardTitle state={boardState()} />);

        fireEvent.keyDown(
            screen.getByRole('button', { name: 'Sprint board' }),
            { key: 'F2' },
        );

        const field = screen.getByRole('textbox', { name: 'Board name' });

        fireEvent.keyDown(field, { key: 'Escape' });
        fireEvent.click(
            screen.getByRole('button', { name: 'Rename the board' }),
        );

        expect(
            screen.getByRole('textbox', { name: 'Board name' }),
        ).toBeTruthy();
    });

    it('cancels on Escape and sends nothing', () => {
        const state = boardState();

        renderWithProviders(<BoardTitle state={state} />);
        fireEvent.click(screen.getByRole('button', { name: 'Sprint board' }));

        const field = screen.getByRole('textbox', { name: 'Board name' });

        fireEvent.change(field, { target: { value: 'Another name' } });
        fireEvent.keyDown(field, { key: 'Escape' });

        expect(
            screen.queryByRole('textbox', { name: 'Board name' }),
        ).toBeNull();
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Sprint board',
        );
        expect(retroRequest).not.toHaveBeenCalled();
    });

    it('saves a changed name when the field loses focus', async () => {
        const state = boardState();

        renderWithProviders(<BoardTitle state={state} />);
        fireEvent.click(screen.getByRole('button', { name: 'Sprint board' }));

        const field = screen.getByRole('textbox', { name: 'Board name' });

        fireEvent.change(field, { target: { value: 'Sprint 43 board' } });
        fireEvent.blur(field);

        await waitFor(() => expect(state.refetch).toHaveBeenCalledTimes(1));

        expect(sentBodies()).toEqual([{ title: 'Sprint 43 board' }]);
        await waitFor(() =>
            expect(
                screen.queryByRole('textbox', { name: 'Board name' }),
            ).toBeNull(),
        );
    });

    it('closes the field and sends nothing when it loses focus unchanged or empty', () => {
        renderWithProviders(<BoardTitle state={boardState()} />);

        for (const value of ['Sprint board', '  ']) {
            fireEvent.click(
                screen.getByRole('button', { name: 'Sprint board' }),
            );

            const field = screen.getByRole('textbox', { name: 'Board name' });

            fireEvent.change(field, { target: { value } });
            fireEvent.blur(field);

            expect(
                screen.queryByRole('textbox', { name: 'Board name' }),
            ).toBeNull();
        }

        expect(retroRequest).not.toHaveBeenCalled();
    });

    it('does not save the draft of a rename cancelled with Escape when the field then loses focus', () => {
        renderWithProviders(<BoardTitle state={boardState()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Sprint board' }));

        const field = screen.getByRole('textbox', { name: 'Board name' });

        fireEvent.change(field, { target: { value: 'Another name' } });
        fireEvent.keyDown(field, { key: 'Escape' });
        fireEvent.blur(field);

        expect(retroRequest).not.toHaveBeenCalled();
    });

    it('keeps the field focusable while saving and open with the draft after a refusal', async () => {
        let refuse: (reason: Error) => void = () => {};

        vi.mocked(retroRequest).mockImplementationOnce(
            () =>
                new Promise((_, reject) => {
                    refuse = reject;
                }),
        );

        const state = boardState();

        renderWithProviders(<BoardTitle state={state} />);
        fireEvent.click(screen.getByRole('button', { name: 'Sprint board' }));

        const field = screen.getByRole('textbox', { name: 'Board name' });

        fireEvent.change(field, { target: { value: 'Sprint 43 board' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        await waitFor(() =>
            expect(field.getAttribute('aria-busy')).toBe('true'),
        );

        expect(field.hasAttribute('readonly')).toBe(true);
        expect(field.hasAttribute('disabled')).toBe(false);

        refuse(new Error('refused'));

        await waitFor(() => expect(field.hasAttribute('readonly')).toBe(false));

        expect(
            (
                screen.getByRole('textbox', {
                    name: 'Board name',
                }) as HTMLInputElement
            ).value,
        ).toBe('Sprint 43 board');
        expect(state.refetch).not.toHaveBeenCalled();
    });

    it('leaves the focus where the viewer moved it while an Enter rename was saving', async () => {
        let accept: (value: null) => void = () => {};

        vi.mocked(retroRequest).mockImplementationOnce(
            () => new Promise((resolve) => (accept = resolve)),
        );

        const state = boardState();

        renderWithProviders(
            <>
                <BoardTitle state={state} />
                <button type="button">Elsewhere</button>
            </>,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Sprint board' }));

        const field = screen.getByRole('textbox', { name: 'Board name' });

        fireEvent.change(field, { target: { value: 'Sprint 43 board' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });

        elsewhere.focus();
        accept(null);

        await waitFor(() =>
            expect(
                screen.queryByRole('textbox', { name: 'Board name' }),
            ).toBeNull(),
        );
        expect(document.activeElement).toBe(elsewhere);
    });

    it('says that a press on the name renames the board, without changing the heading', () => {
        renderWithProviders(<BoardTitle state={boardState()} />);

        expect(
            screen
                .getByRole('button', { name: 'Sprint board' })
                .getAttribute('aria-description'),
        ).toBe('Rename the board');
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Sprint board',
        );
    });

    it('sends nothing for an empty or an unchanged name', () => {
        renderWithProviders(<BoardTitle state={boardState()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Sprint board' }));

        const field = screen.getByRole<HTMLInputElement>('textbox', {
            name: 'Board name',
        });

        fireEvent.change(field, { target: { value: '   ' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        expect(field.validationMessage).toBe('The name is required.');

        fireEvent.change(field, { target: { value: 'Sprint board' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        expect(
            screen.queryByRole('textbox', { name: 'Board name' }),
        ).toBeNull();
        expect(retroRequest).not.toHaveBeenCalled();
    });

    it('says under the name, on a phone, that it is a whiteboard and how many are online', () => {
        const online = ['a', 'b'].map((id) => ({
            id: `member-${id}`,
            name: `Member ${id}`,
            avatarUrl: `/avatars/${id}.svg`,
            isGuest: false,
        }));

        renderWithProviders(<BoardTitle state={boardState({ online })} />);

        expect(
            document.querySelector('[data-slot="session-subtitle"]')
                ?.textContent,
        ).toBe('Whiteboard · 2 online');
    });

    it('gives who may not rename, and a guest, the plain name with no field and no back link', () => {
        renderWithProviders(
            <BoardTitle
                state={boardState({
                    me: { isFacilitator: false, isGuest: true },
                    links: { team: null, sessions: null },
                })}
            />,
        );

        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Sprint board',
        );
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.queryByRole('link')).toBeNull();

        fireEvent.keyDown(screen.getByRole('heading', { level: 1 }), {
            key: 'F2',
        });

        expect(screen.queryByRole('textbox')).toBeNull();
    });
});

describe('BoardActions', () => {
    function actions(folded: boolean, onExport = vi.fn()) {
        return (
            <BoardActions
                state={boardState()}
                folded={folded}
                onExport={onExport}
                hideMyCursor={false}
                onHideMyCursorChange={() => {}}
            />
        );
    }

    it('shows no facilitator control in the top bar', () => {
        renderWithProviders(actions(false));

        expect(
            screen.queryByRole('toolbar', { name: 'Facilitation tools' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: 'Timer' })).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Lock the board' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Bring everyone to me' }),
        ).toBeNull();
        expect(
            document.querySelector('[data-slot="board-header-separator"]'),
        ).toBeNull();
    });

    it("folds Export and Share as the other sessions' bars do", async () => {
        const user = userEvent.setup();
        const onExport = vi.fn();
        const onShortcuts = vi.fn();
        const { rerender } = renderWithProviders(actions(false, onExport));

        for (const name of ['Export', 'Share']) {
            const word = within(screen.getByRole('button', { name })).getByText(
                name,
            );

            expect(word.className).toContain('sr-only');
            expect(word.className).toContain(
                '@session-words/session:not-sr-only',
            );
        }

        rerender(actions(true, onExport));

        expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();

        window.addEventListener(openKeyboardShortcutsEvent, onShortcuts);
        await user.click(screen.getByRole('button', { name: 'Board menu' }));
        await user.click(
            screen.getByRole('menuitem', { name: 'Keyboard shortcuts' }),
        );
        window.removeEventListener(openKeyboardShortcutsEvent, onShortcuts);

        expect(onShortcuts).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole('button', { name: 'Board menu' }));
        await user.click(screen.getByRole('menuitem', { name: 'Export' }));

        expect(onExport).toHaveBeenCalledTimes(1);
    });
});

describe('BoardPresence', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('shows two avatars and the rest as +N on a phone, the count left to the line under the name', () => {
        vi.stubGlobal('matchMedia', (query: string) => ({
            matches: query === '(max-width: 639px)',
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
        }));
        const online = ['a', 'b', 'c', 'd', 'e'].map((id) => ({
            id: `member-${id}`,
            name: `Member ${id}`,
            avatarUrl: `/avatars/${id}.svg`,
            isGuest: false,
        }));

        renderWithProviders(<BoardPresence state={boardState({ online })} />);

        const avatars = document.querySelector(
            '[data-slot="presence-stack-avatars"]',
        );

        expect(avatars?.children).toHaveLength(3);
        expect(
            document.querySelector('[data-slot="presence-stack-more"]')
                ?.textContent,
        ).toBe('+3');
        expect(
            document.querySelector('[data-slot="presence-stack"]')?.className,
        ).toContain('max-sm:[&_[data-slot=presence-stack-count]]:sr-only');
    });
});
