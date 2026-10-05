import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import { renderWithProviders } from '@/test/render';
import { boardState } from '@/test/whiteboard-state';
import {
    DeleteBoardDialog,
    HandOverDialog,
    RenameBoardDialog,
    SaveTemplateDialog,
} from './board-dialogs';

const mocks = vi.hoisted(() => ({ visit: vi.fn(), saved: vi.fn() }));

vi.mock('@/lib/retro/api', async (original) => ({
    ...(await original<typeof import('@/lib/retro/api')>()),
    retroRequest: vi.fn(async () => null),
}));

vi.mock('@inertiajs/react', async (original) => ({
    ...(await original<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router: { visit: mocks.visit },
}));

vi.mock('sonner', () => ({
    toast: { success: mocks.saved, error: vi.fn() },
}));

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        },
    );
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
    vi.mocked(retroRequest).mockReset();
    vi.mocked(retroRequest).mockImplementation(async () => null);
    mocks.visit.mockClear();
    mocks.saved.mockClear();
});

const candidates = [
    { userId: 'user-ada', name: 'Ada Admin' },
    { userId: 'user-max', name: 'Max Member' },
];

describe('RenameBoardDialog', () => {
    it('starts from the current title, saves the new one, refetches and closes', async () => {
        const state = boardState();
        const onOpenChange = vi.fn();

        renderWithProviders(
            <RenameBoardDialog
                state={state}
                open
                onOpenChange={onOpenChange}
            />,
        );

        const dialog = within(screen.getByRole('dialog', { name: 'Rename' }));
        const field = dialog.getByRole('textbox', {
            name: 'Title',
        }) as HTMLInputElement;

        expect(field.value).toBe('Sprint board');
        expect(field.maxLength).toBe(120);
        expect(field.required).toBe(true);

        fireEvent.change(field, { target: { value: 'Sprint 43' } });
        fireEvent.click(dialog.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

        expect(vi.mocked(retroRequest).mock.calls[0][1]).toEqual({
            title: 'Sprint 43',
        });
        expect(state.refetch).toHaveBeenCalledTimes(1);
    });

    it('stays open and says why when the server refuses', async () => {
        const onOpenChange = vi.fn();

        vi.mocked(retroRequest).mockRejectedValueOnce(
            new RetroRequestError(403, 'Only the facilitator can do that.'),
        );

        renderWithProviders(
            <RenameBoardDialog
                state={boardState()}
                open
                onOpenChange={onOpenChange}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect((await screen.findByRole('alert')).textContent).toContain(
            'Only the facilitator can do that.',
        );
        expect(onOpenChange).not.toHaveBeenCalled();
    });
});

describe('SaveTemplateDialog', () => {
    const fill = (name: string, description = ''): void => {
        fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
            target: { value: name },
        });
        fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
            target: { value: description },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    };

    it('says who can use the template and limits the two fields', () => {
        renderWithProviders(
            <SaveTemplateDialog
                boardId="board-1"
                open
                onOpenChange={() => {}}
            />,
        );

        const dialog = screen.getByRole('dialog', { name: 'Save as template' });

        expect(dialog.textContent).toContain(
            'Everyone in the workspace can start a board from it.',
        );
        expect(dialog.querySelector('input[maxlength="80"]')).not.toBeNull();
        expect(dialog.querySelector('input[maxlength="300"]')).not.toBeNull();
    });

    it('sends the name, and no description when it is empty, then says it is saved', async () => {
        const onOpenChange = vi.fn();

        renderWithProviders(
            <SaveTemplateDialog
                boardId="board-1"
                open
                onOpenChange={onOpenChange}
            />,
        );

        fill('Kick-off');

        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

        expect(vi.mocked(retroRequest).mock.calls[0][1]).toEqual({
            name: 'Kick-off',
            description: null,
        });
        expect(mocks.saved).toHaveBeenCalledWith('Template saved.');
    });

    it('shows a refused name under its field and stays open', async () => {
        const onOpenChange = vi.fn();

        vi.mocked(retroRequest).mockRejectedValueOnce(
            new RetroRequestError(
                422,
                'A template with this name already exists.',
                {
                    name: ['A template with this name already exists.'],
                },
            ),
        );

        renderWithProviders(
            <SaveTemplateDialog
                boardId="board-1"
                open
                onOpenChange={onOpenChange}
            />,
        );

        fill('Kick-off', 'How we start');

        const name = await waitFor(() => {
            const field = screen.getByRole('textbox', { name: 'Name' });

            expect(field.getAttribute('aria-invalid')).toBe('true');

            return field;
        });

        expect(
            document.getElementById(name.getAttribute('aria-describedby')!)
                ?.textContent,
        ).toBe('A template with this name already exists.');
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(mocks.saved).not.toHaveBeenCalled();
    });

    it('shows a refusal that is not about a field above the footer', async () => {
        vi.mocked(retroRequest).mockRejectedValueOnce(
            new RetroRequestError(403, 'This action is unauthorized.'),
        );

        renderWithProviders(
            <SaveTemplateDialog
                boardId="board-1"
                open
                onOpenChange={() => {}}
            />,
        );

        fill('Kick-off');

        expect((await screen.findByRole('alert')).textContent).toContain(
            'This action is unauthorized.',
        );
    });
});

describe('HandOverDialog', () => {
    it('cannot be submitted when no one else can facilitate', () => {
        const onOpenChange = vi.fn();

        renderWithProviders(
            <HandOverDialog
                state={boardState()}
                open
                onOpenChange={onOpenChange}
            />,
        );

        const dialog = within(
            screen.getByRole('dialog', { name: 'Hand over facilitation' }),
        );

        expect(
            dialog.getByText('No one else can facilitate this board yet.'),
        ).toBeTruthy();
        expect(dialog.queryByRole('combobox')).toBeNull();
        expect(dialog.queryByRole('button', { name: 'Hand over' })).toBeNull();

        fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('hands over to the chosen candidate, refetches and closes', async () => {
        const user = userEvent.setup();
        const state = boardState({ me: { transferCandidates: candidates } });
        const onOpenChange = vi.fn();

        renderWithProviders(
            <HandOverDialog state={state} open onOpenChange={onOpenChange} />,
        );

        const handOver = (): HTMLButtonElement =>
            screen.getByRole('button', { name: 'Hand over' });

        expect(handOver().disabled).toBe(true);

        await user.click(
            screen.getByRole('combobox', { name: 'New facilitator' }),
        );

        expect(
            screen.getAllByRole('option').map((option) => option.textContent),
        ).toEqual(['Ada Admin', 'Max Member']);

        await user.click(screen.getByRole('option', { name: 'Max Member' }));

        expect(handOver().disabled).toBe(false);

        await user.click(handOver());

        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

        expect(vi.mocked(retroRequest).mock.calls[0][1]).toEqual({
            user_id: 'user-max',
        });
        expect(state.refetch).toHaveBeenCalledTimes(1);
    });
});

describe('DeleteBoardDialog', () => {
    const confirm = (): void => {
        fireEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Delete this board',
            }),
        );
    };

    it('asks, says what is lost, deletes and goes back to the team', async () => {
        renderWithProviders(
            <DeleteBoardDialog
                state={boardState()}
                open
                onOpenChange={() => {}}
            />,
        );

        const dialog = screen.getByRole('alertdialog', {
            name: 'Delete this board?',
        });

        expect(dialog.textContent).toContain(
            'Everything on it is removed for everyone.',
        );
        expect(retroRequest).not.toHaveBeenCalled();

        confirm();

        await waitFor(() =>
            expect(mocks.visit).toHaveBeenCalledWith('/workspaces/w/teams/t'),
        );
    });

    it('goes to the dashboard when the board has no team to go back to', async () => {
        renderWithProviders(
            <DeleteBoardDialog
                state={boardState({ links: { team: null } })}
                open
                onOpenChange={() => {}}
            />,
        );

        confirm();

        await waitFor(() =>
            expect(mocks.visit).toHaveBeenCalledWith('/dashboard'),
        );
    });

    it('says something went wrong rather than the raw text of a server error', async () => {
        vi.mocked(retroRequest).mockRejectedValueOnce(
            new RetroRequestError(500, 'Server Error'),
        );

        renderWithProviders(
            <DeleteBoardDialog
                state={boardState()}
                open
                onOpenChange={() => {}}
            />,
        );

        confirm();

        expect((await screen.findByRole('alert')).textContent).toContain(
            'Something went wrong. Please try again.',
        );
    });

    it('stays on the board and says why when the deletion is refused', async () => {
        const onOpenChange = vi.fn();

        vi.mocked(retroRequest).mockRejectedValueOnce(
            new RetroRequestError(0, 'Network error'),
        );

        renderWithProviders(
            <DeleteBoardDialog
                state={boardState()}
                open
                onOpenChange={onOpenChange}
            />,
        );

        confirm();

        expect((await screen.findByRole('alert')).textContent).toContain(
            'Something went wrong. Please try again.',
        );
        expect(mocks.visit).not.toHaveBeenCalled();
        expect(onOpenChange).not.toHaveBeenCalled();
    });
});
