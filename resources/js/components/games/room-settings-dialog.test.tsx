import {
    cleanup,
    fireEvent,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoomSettingsDialog } from './room-settings-dialog';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({
            props: { locale: 'en', locales: ['en', 'fr'], translations: {} },
        }),
    };
});

const api = vi.hoisted(() => ({ retroRequest: vi.fn() }));

vi.mock('@/lib/retro/api', () => ({ retroRequest: api.retroRequest }));

function described(element: HTMLElement): string {
    return (element.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim();
}

function renderDialog(room: Record<string, unknown> = {}) {
    const ctx = {
        snapshot: {
            room: {
                id: 'room',
                name: 'Friday fun',
                access: 'team',
                locale: 'en',
                reactionsEnabled: true,
                ...room,
            },
        },
        run: <T,>(mutation: Promise<T>) => mutation,
        refetch: vi.fn().mockResolvedValue(undefined),
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <RoomSettingsDialog open onOpenChange={vi.fn()} />
        </RoomProvider>,
    );

    return screen.getByRole('dialog');
}

beforeEach(() => {
    api.retroRequest.mockReset();
    api.retroRequest.mockResolvedValue(null);
});

describe('RoomSettingsDialog', () => {
    it('keeps Save off for a name made only of spaces', () => {
        renderDialog();

        const save = screen.getByRole('button', {
            name: 'Save',
        }) as HTMLButtonElement;

        expect(save.disabled).toBe(false);

        fireEvent.change(screen.getByLabelText('Name'), {
            target: { value: '   ' },
        });

        expect(save.disabled).toBe(true);
    });

    it('shows each setting as a row with its help and its control', () => {
        const dialog = renderDialog();
        const rows = Array.from(
            dialog.querySelectorAll<HTMLElement>('[data-slot="setting-row"]'),
        );
        const name = screen.getByLabelText('Name');

        expect(rows).toHaveLength(3);
        expect(rows.some((row) => row.contains(name))).toBe(false);
        expect(
            name.compareDocumentPosition(rows[0]) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();

        const guests = within(rows[0]).getByRole('switch', {
            name: 'Allow guests without an account',
        });
        const language = within(rows[1]).getByRole('combobox', {
            name: 'Language of words and questions',
        });
        const reactions = within(rows[2]).getByRole('switch', {
            name: 'Reactions',
        });

        expect(described(guests)).toBe(
            'Guests join with a nickname, no account',
        );
        expect(language.textContent).toBe('English');
        expect(described(language)).toBe(
            'The language the games draw their words from.',
        );
        expect(reactions.getAttribute('aria-checked')).toBe('true');
        expect(rows[0].parentElement?.classList.contains('border-y')).toBe(
            true,
        );
    });

    it('keeps the switch named Reactions with its description', () => {
        renderDialog();

        const reactions = screen.getByRole('switch', { name: 'Reactions' });

        expect(reactions.id).toBe('room-reactions');
        expect(described(reactions)).toBe(
            'Players can send emoji reactions during the game.',
        );
    });

    it('shows Allow guests without an account as a switch, off for a room of the team', () => {
        const dialog = renderDialog();
        const guests = screen.getByRole('switch', {
            name: 'Allow guests without an account',
        });

        expect(guests.id).toBe('room-guests');
        expect(guests.getAttribute('aria-checked')).toBe('false');
        expect(within(dialog).getAllByRole('combobox')).toHaveLength(1);
        expect(within(dialog).queryByText('Who can join')).toBeNull();
    });

    it('shows the switch on for a room open to its link, and says what turning it off does', async () => {
        renderDialog({ access: 'link' });
        const guests = screen.getByRole('switch', {
            name: 'Allow guests without an account',
        });

        expect(guests.getAttribute('aria-checked')).toBe('true');

        await userEvent.click(guests);

        expect(described(guests)).toBe('Guests in this room lose access.');
    });

    it('sends link when the switch is on and team when it is off', async () => {
        renderDialog();
        const guests = screen.getByRole('switch', {
            name: 'Allow guests without an account',
        });

        await userEvent.click(guests);
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(api.retroRequest).toHaveBeenCalledTimes(1));
        expect(api.retroRequest.mock.calls[0][1]).toMatchObject({
            access: 'link',
        });

        cleanup();
        api.retroRequest.mockClear();
        renderDialog({ access: 'link' });

        await userEvent.click(
            screen.getByRole('switch', {
                name: 'Allow guests without an account',
            }),
        );
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(api.retroRequest).toHaveBeenCalledTimes(1));
        expect(api.retroRequest.mock.calls[0][1]).toMatchObject({
            access: 'team',
        });
    });

    it('saves the name, the access, the language and the reactions', async () => {
        renderDialog();

        fireEvent.change(screen.getByLabelText('Name'), {
            target: { value: ' Lunch break ' },
        });
        await userEvent.click(
            screen.getByRole('switch', { name: 'Reactions' }),
        );
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(api.retroRequest).toHaveBeenCalledTimes(1));
        expect(api.retroRequest.mock.calls[0][1]).toEqual({
            name: 'Lunch break',
            access: 'team',
            locale: 'en',
            reactions_enabled: false,
        });
    });
});
