import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    icebreakerSessionForm,
    roomLimitReason,
} from '@/components/teams/session-create/icebreaker-session-fields';
import type { IcebreakerSessionFormProps } from '@/components/teams/session-create/icebreaker-session-fields';
import { NewSessionDialog } from '@/components/teams/session-create/new-session-dialog';
import { Button } from '@/components/ui/button';
import { renderWithProviders } from '@/test/render';
import type { GameOption } from '@/types';

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        router: { post: mocks.post },
    };
});

type VisitOptions = {
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const gameOptions: GameOption[] = [
    { value: 'draw', label: 'Draw & Guess', available: true },
    { value: 'gif', label: 'Sprint in one GIF', available: false },
    { value: 'hangman', label: 'Hangman', available: true },
    { value: 'decoded', label: 'Decoded', available: true },
];

const team = { id: 't1', name: 'Atlas' };

const fakeRetro = {
    render: () => <p>Retro form</p>,
};

function open(props: Partial<IcebreakerSessionFormProps> = {}) {
    renderWithProviders(
        <NewSessionDialog
            trigger={<Button>New session</Button>}
            team={team}
            icebreaker={icebreakerSessionForm({
                workspaceSlug: 'acme',
                gameOptions,
                ...props,
            })}
        />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'New session' }));

    return screen.getByRole('dialog');
}

function games(): HTMLElement[] {
    return within(
        screen.getByRole('radiogroup', { name: 'Choose an icebreaker' }),
    ).getAllByRole('radio');
}

function checkedGames(): (string | undefined)[] {
    return games()
        .filter((card) => card.getAttribute('aria-checked') === 'true')
        .map((card) => card.dataset.game);
}

function typeName(value: string): void {
    fireEvent.change(screen.getByLabelText('Name'), { target: { value } });
}

function submit(dialog: HTMLElement): void {
    const button = within(dialog).getByRole('button', {
        name: 'Create & open',
    }) as HTMLButtonElement;

    fireEvent.submit(button.form as HTMLFormElement);
}

function lastPost(): [string, Record<string, unknown>, VisitOptions] {
    return mocks.post.mock.calls[mocks.post.mock.calls.length - 1] as [
        string,
        Record<string, unknown>,
        VisitOptions,
    ];
}

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.post.mockReset();
});

describe('the icebreaker form', () => {
    it('opens with an empty required name, the first available game and the team access', () => {
        open();

        const name = screen.getByLabelText('Name') as HTMLInputElement;

        expect(name).toBe(document.querySelector('#new-icebreaker-name'));
        expect(name.value).toBe('');
        expect(name.required).toBe(true);
        expect(name.maxLength).toBe(60);
        expect(games().map((card) => card.dataset.game)).toEqual([
            'draw',
            'gif',
            'hangman',
            'decoded',
        ]);
        expect(checkedGames()).toEqual(['draw']);
        expect(
            screen
                .getByRole('switch', {
                    name: 'Allow guests without an account',
                })
                .getAttribute('aria-checked'),
        ).toBe('false');
    });

    it('shows Allow guests without an account as a switch, off for a room of the team', () => {
        const dialog = open();
        const guests = screen.getByRole('switch', {
            name: 'Allow guests without an account',
        });
        const row = guests.closest('[data-slot="setting-row"]') as HTMLElement;

        expect(guests.id).toBe('new-icebreaker-guests');
        expect(guests.getAttribute('aria-checked')).toBe('false');
        expect(
            document.getElementById(
                guests.getAttribute('aria-describedby') ?? '',
            )?.textContent,
        ).toBe('Guests join with a nickname, no account');
        expect(
            within(row.parentElement as HTMLElement).getByText('Invitation'),
        ).toBeTruthy();
        expect(within(dialog).queryByRole('combobox')).toBeNull();
        expect(within(dialog).queryByText('Who can join')).toBeNull();
    });

    it('shows the duration and players of each game from the catalogue', () => {
        open();

        const [draw, gif, hangman, decoded] = games();

        expect(within(draw).getByText('10 min')).toBeTruthy();
        expect(within(draw).getByText('2-12')).toBeTruthy();
        expect(within(gif).getByText('5 min')).toBeTruthy();
        expect(within(gif).getByText('1-30')).toBeTruthy();
        expect(within(hangman).getByText('5–10 min')).toBeTruthy();
        expect(within(hangman).getByText('1-30')).toBeTruthy();
        expect(within(decoded).getByText('5 min')).toBeTruthy();
        expect(within(decoded).getByText('2-30')).toBeTruthy();
    });

    it('posts the name, the game and the access to the rooms of the team', () => {
        const dialog = open();

        typeName('Friday warm-up');
        fireEvent.click(screen.getByRole('radio', { name: 'Hangman' }));
        submit(dialog);

        const [url, body] = lastPost();

        expect(checkedGames()).toEqual(['hangman']);
        expect(url).toBe('/w/acme/teams/t1/games');
        expect(body).toEqual({
            name: 'Friday warm-up',
            game: 'hangman',
            access: 'team',
        });
    });

    it('sends link when the switch is on and team when it is off', async () => {
        const user = userEvent.setup();
        const dialog = open();
        const guests = screen.getByRole('switch', {
            name: 'Allow guests without an account',
        });

        typeName('Open room');
        await user.click(guests);
        submit(dialog);

        expect(lastPost()[1]).toEqual({
            name: 'Open room',
            game: 'draw',
            access: 'link',
        });

        await user.click(guests);
        submit(dialog);

        expect(lastPost()[1]).toEqual({
            name: 'Open room',
            game: 'draw',
            access: 'team',
        });
    });

    it('shows an unavailable game disabled with its reason and never selects it', () => {
        const dialog = open();
        const gif = screen.getByRole('radio', { name: 'Sprint in one GIF' });

        expect(gif.getAttribute('aria-disabled')).toBe('true');
        expect(gif.textContent).toContain('No GIF provider configured');

        fireEvent.click(gif);
        typeName('Room');
        submit(dialog);

        expect(checkedGames()).toEqual(['draw']);
        expect(lastPost()[1]).toMatchObject({ game: 'draw' });
    });

    it('opens on the first available game when the first of the list is not', () => {
        open({
            gameOptions: [
                { value: 'gif', label: 'Sprint in one GIF', available: false },
                { value: 'decoded', label: 'Decoded', available: true },
            ],
        });

        expect(checkedGames()).toEqual(['decoded']);
    });

    it('cannot be sent when no game is available', () => {
        const dialog = open({
            gameOptions: [
                { value: 'gif', label: 'Sprint in one GIF', available: false },
            ],
        });

        typeName('Room');
        submit(dialog);

        expect(checkedGames()).toEqual([]);
        expect(
            (
                within(dialog).getByRole('button', {
                    name: 'Create & open',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('does not post a blank name and says the name is required', () => {
        const dialog = open();

        typeName('   ');
        submit(dialog);

        expect(mocks.post).not.toHaveBeenCalled();
        expect(screen.getByRole('alert').textContent).toBe(
            'The name is required.',
        );
        expect(screen.getByLabelText('Name').getAttribute('aria-invalid')).toBe(
            'true',
        );
    });

    it('shows the server errors under the name and under the games, and closes on success', () => {
        const dialog = open();

        expect(
            document
                .querySelector('#new-icebreaker-name')
                ?.hasAttribute('aria-describedby'),
        ).toBe(false);

        typeName('Room');
        submit(dialog);

        act(() => {
            const [, , options] = lastPost();

            options.onStart?.();
            options.onError?.({
                name: 'This team already has 10 game rooms.',
                game: 'This game is not available.',
            });
            options.onFinish?.();
        });

        expect(
            screen.getAllByRole('alert').map((alert) => alert.textContent),
        ).toEqual([
            'This team already has 10 game rooms.',
            'This game is not available.',
        ]);
        expect(screen.getByLabelText('Name').getAttribute('aria-invalid')).toBe(
            'true',
        );

        const grid = screen.getByRole('radiogroup', {
            name: 'Choose an icebreaker',
        });

        expect(grid.getAttribute('aria-invalid')).toBe('true');
        expect(
            document.getElementById(grid.getAttribute('aria-describedby')!)
                ?.textContent,
        ).toBe('This game is not available.');

        submit(dialog);

        act(() => {
            lastPost()[2].onSuccess?.();
        });

        expect(screen.queryByRole('dialog')).toBeNull();
    });
});

describe('the icebreaker type of the dialog', () => {
    const t = (key: string, replacements?: Record<string, string | number>) =>
        key.replace(':count', String(replacements?.count));

    it('has no reason while the team may open a room', () => {
        expect(roomLimitReason(true, 10, t)).toBeUndefined();
    });

    it('names the room limit when the team has reached it', () => {
        expect(roomLimitReason(false, 10, t)).toBe(
            'This team already has 10 game rooms.',
        );
    });

    it('is shown disabled with the reason, and the dialog stays on another type', () => {
        renderWithProviders(
            <NewSessionDialog
                trigger={<Button>New session</Button>}
                team={team}
                retro={fakeRetro}
                icebreaker={icebreakerSessionForm({
                    workspaceSlug: 'acme',
                    gameOptions,
                    disabledReason: roomLimitReason(false, 10, t),
                })}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'New session' }));

        const tile = screen.getByRole('radio', { name: /Icebreaker/ });

        expect(tile.getAttribute('aria-disabled')).toBe('true');
        expect(tile.textContent).toContain(
            'This team already has 10 game rooms.',
        );

        fireEvent.click(tile);

        expect(screen.getByText('Retro form')).toBeTruthy();
        expect(document.querySelector('#new-icebreaker-name')).toBeNull();
    });
});
