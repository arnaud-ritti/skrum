import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuestJoin } from '@/components/skrum/guest-join';
import type { GuestJoinProps } from '@/components/skrum/guest-join';
import { renderWithProviders } from '@/test/render';

const session: GuestJoinProps['session'] = {
    kind: 'retro',
    title: 'Sprint 42 retro',
};

function setup(props: Partial<GuestJoinProps> = {}) {
    const onSubmit = vi.fn();

    renderWithProviders(
        <GuestJoin
            session={session}
            onSubmit={onSubmit}
            loginUrl="/login"
            {...props}
        />,
    );

    return onSubmit;
}

describe('GuestJoin', () => {
    it('keeps the name field id and the Join button name', () => {
        setup();

        expect(document.getElementById('name')).toBe(
            screen.getByLabelText('Your nickname'),
        );
        expect(screen.getByRole('button', { name: 'Join' })).toBeTruthy();
    });

    it('submits the typed name and the chosen colour', () => {
        const onSubmit = setup({ takenColors: [] });

        fireEvent.change(screen.getByLabelText('Your nickname'), {
            target: { value: '  Nadia ' },
        });
        fireEvent.click(screen.getByRole('radio', { name: 'Colour 5' }));
        fireEvent.submit(screen.getByRole('button', { name: 'Join' }));

        expect(onSubmit).toHaveBeenCalledWith({ name: 'Nadia', presence: 5 });
    });

    it('submits the proposed name when the field is empty', () => {
        const onSubmit = setup({ defaultName: 'Thoughtful otter' });

        expect(screen.getByText('Thoughtful otter')).toBeTruthy();

        fireEvent.submit(screen.getByRole('button', { name: 'Join' }));

        expect(onSubmit).toHaveBeenCalledWith({ name: 'Thoughtful otter' });
    });

    it('omits the colour picker and the presence when takenColors is absent', () => {
        const onSubmit = setup({ initialName: 'Nadia' });

        expect(screen.queryByRole('radiogroup')).toBeNull();

        fireEvent.submit(screen.getByRole('button', { name: 'Join' }));

        expect(onSubmit).toHaveBeenCalledWith({ name: 'Nadia' });
    });

    it('disables taken colours and moves the selection with the arrow keys', () => {
        const onSubmit = setup({
            takenColors: [2],
            initialPresence: 1,
            initialName: 'Nadia',
        });

        const taken = screen.getByRole('radio', { name: 'Colour 2 (taken)' });

        expect((taken as HTMLButtonElement).disabled).toBe(true);

        const first = screen.getByRole('radio', { name: 'Colour 1' });

        fireEvent.keyDown(first, { key: 'ArrowRight' });

        expect(
            screen
                .getByRole('radio', { name: 'Colour 3' })
                .getAttribute('aria-checked'),
        ).toBe('true');

        fireEvent.keyDown(screen.getByRole('radio', { name: 'Colour 3' }), {
            key: 'ArrowLeft',
        });
        fireEvent.submit(screen.getByRole('button', { name: 'Join' }));

        expect(onSubmit).toHaveBeenCalledWith({ name: 'Nadia', presence: 1 });
    });

    it('falls back to a free colour when the chosen one gets taken', () => {
        setup({ takenColors: [1, 2], initialPresence: 2 });

        expect(
            screen
                .getByRole('radio', { name: 'Colour 3' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('shows the name error, blocks submit, and releases it when edited', () => {
        const onSubmit = setup({
            initialName: 'Théo',
            error: { field: 'name', message: 'Théo is already here.' },
        });
        const input = screen.getByLabelText('Your nickname');

        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(input.getAttribute('aria-describedby')).toContain(
            screen.getByText('Théo is already here.').id,
        );

        const button = screen.getByRole('button', {
            name: 'Join',
        }) as HTMLButtonElement;

        expect(button.disabled).toBe(true);

        fireEvent.change(input, { target: { value: 'Théo B.' } });

        expect(screen.queryByText('Théo is already here.')).toBeNull();
        expect(button.disabled).toBe(false);

        fireEvent.submit(button);

        expect(onSubmit).toHaveBeenCalledWith({ name: 'Théo B.' });
    });

    it('shows the connecting state and does not submit while processing', () => {
        const onSubmit = setup({ initialName: 'Nadia', processing: true });
        const button = screen.getByRole('button', {
            name: 'Connecting to the session…',
        });

        expect(button.getAttribute('aria-busy')).toBe('true');

        fireEvent.submit(button);

        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('offers a random name only when the field is empty', () => {
        const onRandomName = vi.fn();

        setup({ defaultName: 'Otter', onRandomName });
        fireEvent.click(
            screen.getByRole('button', { name: 'Another random nickname' }),
        );

        expect(onRandomName).toHaveBeenCalledTimes(1);

        fireEvent.change(screen.getByLabelText('Your nickname'), {
            target: { value: 'Nadia' },
        });

        expect(
            screen.queryByRole('button', { name: 'Another random nickname' }),
        ).toBeNull();
        expect(screen.getByText('Guest')).toBeTruthy();
    });

    it('renders with only the kind and the title the join pages receive', () => {
        setup();

        expect(screen.getByText('Sprint 42 retro')).toBeTruthy();
        expect(screen.getByText('Retrospective')).toBeTruthy();
        expect(
            document.querySelectorAll(
                '[data-slot="guest-join-session"] [data-slot^="guest-join-"]',
            ),
        ).toHaveLength(0);
    });

    it('shows the status, participants, facilitator and code only when given', () => {
        setup({
            session: {
                ...session,
                code: 'K7Q2',
                status: 'scheduled',
                participants: 1,
                facilitator: 'Camille',
            },
        });

        expect(screen.getByText('Scheduled')).toBeTruthy();
        expect(screen.getByText('1 participant')).toBeTruthy();
        expect(screen.getByText('Camille facilitates')).toBeTruthy();
        expect(screen.getByText('Code K7Q2')).toBeTruthy();
    });

    it('presents a game room with the name of its game', () => {
        setup({
            session: { kind: 'game', title: 'Friday room', gameLabel: 'Quiz' },
        });

        expect(
            document
                .querySelector('[data-slot="guest-join-session"]')
                ?.getAttribute('data-kind'),
        ).toBe('game');
        expect(screen.getByText('Game')).toBeTruthy();
        expect(screen.getByText('Quiz')).toBeTruthy();
    });

    it('keeps a 60-character suggested name and a long title inside the card', () => {
        const longName = 'N'.repeat(60);
        const onSubmit = setup({
            session: { kind: 'whiteboard', title: 'T'.repeat(280) },
            initialName: longName,
        });

        fireEvent.submit(screen.getByRole('button', { name: 'Join' }));

        expect(onSubmit).toHaveBeenCalledWith({ name: longName });
    });

    it('links to the login page', () => {
        setup();

        expect(
            screen.getByRole('link', { name: 'Log in' }).getAttribute('href'),
        ).toBe('/login');
    });
});
