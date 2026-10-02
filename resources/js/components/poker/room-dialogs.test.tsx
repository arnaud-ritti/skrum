import {
    act,
    fireEvent,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CustomTimerDialog,
    GameSettings,
    RoomDialogs,
    TaskFormDialog,
} from '@/components/poker/room-dialogs';
import type { RoomDialog } from '@/components/poker/room-dialogs';
import { RetroRequestError } from '@/lib/retro/api';
import { pokerSnapshot, pokerTask, renderInRoom } from '@/test/poker-room';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({
    request: vi.fn(),
    visit: vi.fn(),
    toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

vi.mock('sonner', () => ({ toast: mocks.toast }));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        router: { visit: mocks.visit },
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string;
            children: React.ReactNode;
        }) => (
            <a href={href} {...props}>
                {children}
            </a>
        ),
    };
});

type Route = { url: string; method: string };

/** The requests sent so far, as "METHOD url" with their body. */
function sent(): { route: string; body: unknown }[] {
    return mocks.request.mock.calls.map(([route, body]) => ({
        route: `${(route as Route).method.toUpperCase()} ${(route as Route).url}`,
        body,
    }));
}

function open(
    dialog: RoomDialog,
    snapshot = pokerSnapshot(),
    overrides: Parameters<typeof renderInRoom>[2] = {},
) {
    const onClose = vi.fn();

    return {
        onClose,
        ...renderInRoom(
            <RoomDialogs dialog={dialog} onClose={onClose} />,
            snapshot,
            overrides,
        ),
    };
}

/** The settings button of the header, pressed: its popover is open. */
async function openSettings(
    snapshot = pokerSnapshot(),
    overrides: Parameters<typeof renderInRoom>[2] = {},
) {
    const harness = renderInRoom(<GameSettings />, snapshot, overrides);

    fireEvent.click(screen.getByRole('button', { name: 'Game settings' }));

    return {
        ...harness,
        dialog: await screen.findByRole('dialog', { name: 'Game settings' }),
    };
}

const deckOptions = [
    { value: 'fibonacci', label: 'Fibonacci', cards: ['1', '2', '3', '?'] },
    { value: 'tshirt', label: 'T-shirt', cards: ['S', 'M', 'L'] },
    { value: 'custom', label: 'Custom', cards: [] },
];

const teamScale = {
    id: 'deck-1',
    name: 'Team scale',
    cards: ['1', '2', '4'],
    scope: 'team' as const,
};

beforeEach(() => {
    mocks.request.mockReset();
    mocks.request.mockResolvedValue(null);
    mocks.visit.mockReset();
    mocks.toast.mockClear();
    mocks.toast.error.mockClear();
    mocks.toast.success.mockClear();
});

describe('game settings', () => {
    it('shows the title and the four switches, and no guest switch', async () => {
        const { dialog } = await openSettings(
            pokerSnapshot({ game: { hasVotes: true } }),
        );

        expect(
            screen
                .getByRole('button', { name: 'Game settings' })
                .getAttribute('aria-expanded'),
        ).toBe('true');
        expect(within(dialog).getByText('Sprint 43 refinement')).toBeTruthy();
        expect(dialog.querySelector('#poker-title')).not.toBeNull();

        for (const id of [
            'poker-auto-reveal',
            'poker-anonymous-votes',
            'poker-cursors',
            'poker-reactions',
        ]) {
            expect(dialog.querySelector(`#${id}`)?.getAttribute('role')).toBe(
                'switch',
            );
        }

        expect(within(dialog).queryByText('Allow guests')).toBeNull();
    });

    it('sends the changed settings only, reads the game again and stays open', async () => {
        const { ctx, dialog } = await openSettings(
            pokerSnapshot({ game: { hasVotes: true } }),
        );

        fireEvent.click(dialog.querySelector('#poker-anonymous-votes')!);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Apply (1)' }));
        });

        expect(sent()).toEqual([
            {
                route: 'PATCH /poker/game-1/settings',
                body: { anonymous_votes: true },
            },
        ]);
        expect(ctx.refetch).toHaveBeenCalledTimes(1);
        expect(mocks.toast.success.mock.calls[0][0]).toBe('Settings applied');
        expect(screen.getByRole('dialog')).toBe(dialog);
        expect(within(dialog).getByText('No changes')).toBeTruthy();
    });

    it('says that turning anonymity off applies from the next round', async () => {
        const { dialog } = await openSettings(
            pokerSnapshot({ game: { hasVotes: true, anonymousVotes: true } }),
        );

        expect(
            within(dialog).queryByText(/Applies from the next round\./),
        ).toBeNull();

        fireEvent.click(dialog.querySelector('#poker-anonymous-votes')!);

        expect(
            within(dialog).getByText(/Applies from the next round\./),
        ).toBeTruthy();
    });

    it('keeps the change and shows the server message under the field', async () => {
        mocks.request.mockRejectedValue(
            new RetroRequestError(422, 'The title is too long.', {
                title: ['The title is too long.'],
            }),
        );

        const { dialog } = await openSettings(
            pokerSnapshot({ game: { hasVotes: true } }),
            { handleError: (error) => (error as Error).message },
        );

        fireEvent.change(dialog.querySelector('#poker-title')!, {
            target: { value: 'Another name' },
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Apply (1)' }));
        });

        expect(within(dialog).getByText('The title is too long.')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Apply (1)' })).toBeTruthy();
        expect(mocks.toast.success).not.toHaveBeenCalled();
    });

    it('locks the deck once votes exist and loads no saved deck', async () => {
        const { dialog } = await openSettings(
            pokerSnapshot({ game: { hasVotes: true } }),
            { deckOptions },
        );

        expect(
            within(dialog).getByText("The deck can't change once votes exist."),
        ).toBeTruthy();
        expect(within(dialog).queryByRole('radiogroup')).toBeNull();
        expect(mocks.request).not.toHaveBeenCalled();
    });

    it('offers the built-in and the saved decks, and builds the link to the saved decks page of the team', async () => {
        mocks.request.mockResolvedValueOnce([teamScale]);

        await openSettings(
            pokerSnapshot({ team: { id: 'atlas', workspace: 'nordlys' } }),
            { deckOptions },
        );

        const saved = await screen.findByRole('radio', {
            name: 'Team scale, 3 cards',
        });

        expect(within(saved).getByText('Saved')).toBeTruthy();
        expect(sent()[0].route).toBe('GET /poker/game-1/saved-decks');
        expect(
            screen
                .getByRole('radio', { name: 'Fibonacci, 4 cards' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(screen.queryByRole('radio', { name: /Custom/ })).toBeNull();
        expect(
            screen
                .getByRole('link', { name: 'Manage decks' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/teams/atlas/poker-decks');
    });

    it('sends a saved deck by its id and a built-in deck by its key', async () => {
        mocks.request.mockResolvedValueOnce([teamScale]);

        await openSettings(pokerSnapshot(), { deckOptions });

        fireEvent.click(
            await screen.findByRole('radio', { name: 'Team scale, 3 cards' }),
        );

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Apply (1)' }));
        });

        expect(sent()[1]).toEqual({
            route: 'PATCH /poker/game-1/settings',
            body: { deck: 'custom', saved_deck_id: 'deck-1' },
        });
    });

    it('types a deck for this game in the editor, without a name', async () => {
        mocks.request.mockResolvedValueOnce([]);

        await openSettings(pokerSnapshot(), { deckOptions });

        fireEvent.click(
            await screen.findByRole('button', { name: 'Create a deck' }),
        );

        const dialog = screen.getByRole('dialog');
        const cards =
            dialog.querySelector<HTMLInputElement>('#deck-custom-cards')!;

        expect(dialog.querySelector('#deck-custom-name')).toBeNull();

        fireEvent.change(cards, { target: { value: '1, 2, 4' } });
        fireEvent.click(screen.getByRole('button', { name: 'Use this deck' }));

        expect(
            screen
                .getByRole('radio', { name: 'Custom deck, 5 cards' })
                .getAttribute('aria-checked'),
        ).toBe('true');

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Apply (1)' }));
        });

        expect(sent()[1]).toEqual({
            route: 'PATCH /poker/game-1/settings',
            body: {
                deck: 'custom',
                custom_cards: ['1', '2', '4'],
                include_unknown: true,
                include_coffee: true,
            },
        });
    });

    it('selects the saved deck the game was created from', async () => {
        mocks.request.mockResolvedValueOnce([teamScale]);

        await openSettings(
            pokerSnapshot({
                game: {
                    deck: 'custom',
                    deckLabel: 'Team scale',
                    cards: ['1', '2', '4'],
                },
            }),
            { deckOptions },
        );

        const saved = await screen.findByRole('radio', {
            name: 'Team scale, 3 cards',
        });

        await waitFor(() =>
            expect(saved.getAttribute('aria-checked')).toBe('true'),
        );
        expect(screen.getAllByRole('radio')).toHaveLength(3);
        expect(
            (screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
    });
});

describe('game settings, for the others and at the edges', () => {
    it('shows the settings as text to a player who does not facilitate, and loads no saved deck', async () => {
        const { dialog } = await openSettings(
            pokerSnapshot({
                game: { autoReveal: true },
                me: { isFacilitator: false, playerId: 'bob' },
            }),
            { deckOptions },
        );

        expect(
            within(dialog).getByText(
                'Only the facilitator, Ada, can change these settings.',
            ),
        ).toBeTruthy();
        expect(dialog.querySelector('[role="switch"]')).toBeNull();
        expect(dialog.querySelector('#poker-title')).toBeNull();
        expect(within(dialog).queryByRole('radiogroup')).toBeNull();
        expect(
            within(dialog).queryByRole('button', { name: /Apply/ }),
        ).toBeNull();
        expect(within(dialog).getByText('Fibonacci, 7 cards')).toBeTruthy();
        expect(
            within(dialog).queryByText(
                "The deck can't change once votes exist.",
            ),
        ).toBeNull();
        expect(mocks.request).not.toHaveBeenCalled();
    });

    it('gives a guest no link to the saved decks page', async () => {
        const { dialog } = await openSettings(
            pokerSnapshot({
                me: { isFacilitator: false, isGuest: true, playerId: 'bob' },
                team: null,
                links: { team: null },
            }),
        );

        expect(within(dialog).queryByRole('link')).toBeNull();
    });

    it('asks before closing with a change left, and forgets it once discarded', async () => {
        const { dialog } = await openSettings(
            pokerSnapshot({ game: { hasVotes: true } }),
        );

        fireEvent.click(dialog.querySelector('#poker-auto-reveal')!);
        fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

        expect(within(dialog).getByText('Discard 1 changes?')).toBeTruthy();

        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Discard' }),
        );

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

        fireEvent.click(screen.getByRole('button', { name: 'Game settings' }));

        const reopened = await screen.findByRole('dialog', {
            name: 'Game settings',
        });

        expect(
            reopened
                .querySelector('#poker-auto-reveal')
                ?.getAttribute('aria-checked'),
        ).toBe('false');
        expect(mocks.request).not.toHaveBeenCalled();
    });

    it('has no settings button once the game has ended, nor a popover once the session has expired', () => {
        const { unmount } = renderInRoom(
            <GameSettings />,
            pokerSnapshot({ game: { endedAt: '2026-10-02T10:00:00Z' } }),
        );

        expect(
            screen.queryByRole('button', { name: 'Game settings' }),
        ).toBeNull();
        unmount();

        renderInRoom(<GameSettings />, pokerSnapshot(), {
            sessionExpired: true,
        });

        fireEvent.click(screen.getByRole('button', { name: 'Game settings' }));

        expect(screen.queryByRole('dialog')).toBeNull();
    });
});

describe('share', () => {
    it('turns guest access on from the switch the browser suite targets', async () => {
        const { ctx } = open('share');
        const dialog = await screen.findByRole('dialog');

        expect(
            within(dialog).getByRole('heading', {
                name: 'Invite to Sprint 43 refinement',
            }),
        ).toBeTruthy();
        expect(within(dialog).queryByLabelText('Guest link')).toBeNull();
        expect(within(dialog).queryByText('Post a link')).toBeNull();

        await act(async () => {
            fireEvent.click(dialog.querySelector('#poker-guest-link-access')!);
        });

        expect(sent()).toEqual([
            {
                route: 'PATCH /poker/game-1/settings',
                body: { guest_access_enabled: true },
            },
        ]);
        expect(ctx.refetch).toHaveBeenCalledTimes(1);
    });

    it('asks before closing guest access while a guest is in the game', async () => {
        const snapshot = pokerSnapshot({
            game: {
                guestAccessEnabled: true,
                guestUrl: 'https://skrum.test/poker/join/abc',
            },
        });

        open('share', snapshot, {
            online: [
                {
                    id: 'guest-1',
                    name: 'Visitor',
                    avatarUrl: '',
                    isGuest: true,
                },
            ],
        });

        const dialog = await screen.findByRole('dialog');

        fireEvent.click(dialog.querySelector('#poker-guest-link-access')!);

        expect(mocks.request).not.toHaveBeenCalled();

        const confirm = await screen.findByRole('alertdialog');

        expect(
            within(confirm).getByText('Guests in this game lose access.'),
        ).toBeTruthy();

        await act(async () => {
            fireEvent.click(
                within(confirm).getByRole('button', {
                    name: 'Turn off guest access',
                }),
            );
        });

        expect(sent()).toEqual([
            {
                route: 'PATCH /poker/game-1/settings',
                body: { guest_access_enabled: false },
            },
        ]);
    });

    it('closes guest access at once when no guest is in the game', async () => {
        open(
            'share',
            pokerSnapshot({
                game: {
                    guestAccessEnabled: true,
                    guestUrl: 'https://skrum.test/poker/join/abc',
                },
            }),
        );

        const dialog = await screen.findByRole('dialog');

        await act(async () => {
            fireEvent.click(dialog.querySelector('#poker-guest-link-access')!);
        });

        expect(screen.queryByRole('alertdialog')).toBeNull();
        expect(sent()).toEqual([
            {
                route: 'PATCH /poker/game-1/settings',
                body: { guest_access_enabled: false },
            },
        ]);
    });

    it('shows the guest link and asks before creating a new one', async () => {
        mocks.request.mockResolvedValue({ guestUrl: 'https://skrum.test/new' });

        const { ctx } = open(
            'share',
            pokerSnapshot({
                game: {
                    guestAccessEnabled: true,
                    guestUrl: 'https://skrum.test/poker/join/abc',
                },
            }),
        );
        const dialog = await screen.findByRole('dialog');

        expect(
            (within(dialog).getByLabelText('Guest link') as HTMLInputElement)
                .value,
        ).toBe('https://skrum.test/poker/join/abc');

        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Create a new link' }),
        );

        expect(mocks.request).not.toHaveBeenCalled();

        const confirm = await screen.findByRole('alertdialog');

        await act(async () => {
            fireEvent.click(
                within(confirm).getByRole('button', {
                    name: 'Create a new link',
                }),
            );
        });

        expect(sent()).toEqual([
            { route: 'POST /poker/game-1/guest-token', body: undefined },
        ]);
        expect(ctx.refetch).toHaveBeenCalledTimes(1);
    });

    it('posts the link to a channel and says the message is on its way', async () => {
        mocks.request.mockResolvedValue({ id: 'delivery-1' });

        const { ctx } = open(
            'share',
            pokerSnapshot({
                share: {
                    slack: true,
                    telegram: false,
                    msteams: false,
                    mattermost: false,
                    webhook: false,
                },
            }),
        );
        const dialog = await screen.findByRole('dialog');

        expect(
            within(dialog).queryByRole('button', {
                name: 'Post link to Telegram',
            }),
        ).toBeNull();

        await act(async () => {
            fireEvent.click(
                within(dialog).getByRole('button', {
                    name: 'Post link to Slack',
                }),
            );
        });

        expect(sent()).toEqual([
            {
                route: 'POST /poker/game-1/shares',
                body: { channel: 'slack', include_guest_link: false },
            },
        ]);
        expect(mocks.toast).toHaveBeenCalledWith('The message is on its way.');
        expect(ctx.refetch).toHaveBeenCalledTimes(1);
    });
});

describe('hand-over', () => {
    it('says so when nobody else can facilitate, and offers no submit', async () => {
        open('transfer');

        const dialog = await screen.findByRole('dialog');

        expect(
            within(dialog).getByText(
                'No one else can facilitate this game yet.',
            ),
        ).toBeTruthy();
        expect(
            within(dialog).queryByRole('button', { name: 'Hand over' }),
        ).toBeNull();
    });

    it('asks for a person, then hands the game over', async () => {
        const { ctx, onClose } = open(
            'transfer',
            pokerSnapshot({
                me: {
                    transferCandidates: [
                        { userId: 'user-bob', name: 'Bob' },
                        { userId: 'user-cleo', name: 'Cleo' },
                    ],
                },
            }),
        );
        const dialog = await screen.findByRole('dialog');
        const submit = within(dialog).getByRole('button', {
            name: 'Hand over',
        });

        expect(dialog.querySelector('#poker-new-facilitator')).not.toBeNull();

        await act(async () => {
            fireEvent.click(submit);
        });

        expect(
            within(dialog).getByText('Choose the new facilitator.'),
        ).toBeTruthy();
        expect(mocks.request).not.toHaveBeenCalled();

        fireEvent.change(dialog.querySelector('select')!, {
            target: { value: 'user-cleo' },
        });

        await act(async () => {
            fireEvent.click(submit);
        });

        expect(sent()).toEqual([
            {
                route: 'PUT /poker/game-1/facilitator',
                body: { user_id: 'user-cleo' },
            },
        ]);
        expect(ctx.refetch).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe('end and delete', () => {
    it('ends the game after a confirmation', async () => {
        const { ctx, onClose } = open('end');
        const dialog = await screen.findByRole('alertdialog');

        expect(within(dialog).getByText('End this game?')).toBeTruthy();

        await act(async () => {
            fireEvent.click(
                within(dialog).getByRole('button', { name: 'End game' }),
            );
        });

        expect(sent()).toEqual([
            { route: 'PUT /poker/game-1/status', body: { ended: true } },
        ]);
        expect(ctx.refetch).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('deletes the game after a confirmation and goes back to the team', async () => {
        open('delete');

        const dialog = await screen.findByRole('alertdialog');

        expect(within(dialog).getByText('Delete this game?')).toBeTruthy();

        await act(async () => {
            fireEvent.click(
                within(dialog).getByRole('button', { name: 'Delete' }),
            );
        });

        expect(sent()).toEqual([
            { route: 'DELETE /poker/game-1', body: undefined },
        ]);
        expect(mocks.visit).toHaveBeenCalledWith('/w/nordlys/teams/atlas');
    });

    it('opens nothing once the session has expired', () => {
        open('delete', pokerSnapshot(), { sessionExpired: true });

        expect(screen.queryByRole('alertdialog')).toBeNull();
    });
});

describe('TaskFormDialog', () => {
    it('adds a task with its title, and no description when none is typed', async () => {
        const saved = pokerTask('t9', 'Export invoices');
        const onOpenChange = vi.fn();

        mocks.request.mockResolvedValue(saved);

        const { ctx } = renderInRoom(
            <TaskFormDialog task={null} open onOpenChange={onOpenChange} />,
        );
        const dialog = await screen.findByRole('dialog');

        expect(within(dialog).getByText('Add task')).toBeTruthy();

        fireEvent.change(dialog.querySelector('#poker-task-title')!, {
            target: { value: ' Export invoices ' },
        });

        await act(async () => {
            fireEvent.click(
                within(dialog).getByRole('button', { name: 'Save' }),
            );
        });

        expect(sent()).toEqual([
            {
                route: 'POST /poker/game-1/tasks',
                body: { title: 'Export invoices', description: null },
            },
        ]);
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'task.upsert',
            task: saved,
        });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('edits a task, previews its saved description and keeps what was typed', async () => {
        const task = pokerTask('t1', 'Login page', {
            description: '**Bold**',
            descriptionHtml: '<p><strong>Bold</strong></p>',
        });

        mocks.request.mockResolvedValue(task);

        renderInRoom(
            <TaskFormDialog task={task} open onOpenChange={vi.fn()} />,
        );

        const dialog = await screen.findByRole('dialog');

        expect(within(dialog).getByText('Edit task')).toBeTruthy();

        fireEvent.mouseDown(
            within(dialog).getByRole('tab', { name: 'Preview' }),
        );

        expect(dialog.querySelector('strong')?.textContent).toBe('Bold');

        fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'Write' }));
        fireEvent.change(dialog.querySelector('#poker-task-description')!, {
            target: { value: 'New text' },
        });
        fireEvent.mouseDown(
            within(dialog).getByRole('tab', { name: 'Preview' }),
        );

        expect(within(dialog).getByText('Save to preview')).toBeTruthy();

        await act(async () => {
            fireEvent.click(
                within(dialog).getByRole('button', { name: 'Save' }),
            );
        });

        expect(sent()).toEqual([
            {
                route: 'PATCH /poker/game-1/tasks/t1',
                body: { title: 'Login page', description: 'New text' },
            },
        ]);
    });
});

describe('CustomTimerDialog', () => {
    it('starts a timer of the minutes typed', async () => {
        const onStart = vi.fn(async () => true);
        const onOpenChange = vi.fn();

        renderWithProviders(
            <CustomTimerDialog
                open
                onOpenChange={onOpenChange}
                onStart={onStart}
            />,
        );

        const dialog = await screen.findByRole('dialog');

        fireEvent.change(dialog.querySelector('#poker-timer-minutes')!, {
            target: { value: '7' },
        });

        await act(async () => {
            fireEvent.click(
                within(dialog).getByRole('button', { name: 'Start timer' }),
            );
        });

        expect(onStart).toHaveBeenCalledWith(420);
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('stays open when the server refuses the timer', async () => {
        const onStart = vi.fn(async () => false);
        const onOpenChange = vi.fn();

        renderWithProviders(
            <CustomTimerDialog
                open
                onOpenChange={onOpenChange}
                onStart={onStart}
            />,
        );

        const dialog = await screen.findByRole('dialog');

        await act(async () => {
            fireEvent.click(
                within(dialog).getByRole('button', { name: 'Start timer' }),
            );
        });

        expect(onStart).toHaveBeenCalledWith(300);
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('says why a number of minutes out of range is not started', async () => {
        const onStart = vi.fn(async () => true);
        const onOpenChange = vi.fn();

        renderWithProviders(
            <CustomTimerDialog
                open
                onOpenChange={onOpenChange}
                onStart={onStart}
            />,
        );

        const dialog = await screen.findByRole('dialog');

        fireEvent.change(dialog.querySelector('#poker-timer-minutes')!, {
            target: { value: '90' },
        });

        await act(async () => {
            fireEvent.submit(dialog.querySelector('form')!);
        });

        expect(within(dialog).getByRole('alert').textContent).toBe(
            'Choose between 1 and 60 minutes.',
        );
        expect(onStart).not.toHaveBeenCalled();
        expect(onOpenChange).not.toHaveBeenCalled();
    });
});
