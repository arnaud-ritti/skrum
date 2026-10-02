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

        expect(onSubmit).toHaveBeenCalledWith(
            { name: 'Nadia', presence: 5 },
            expect.any(FormData),
        );
    });

    it('submits the proposed name when the field is empty', () => {
        const onSubmit = setup({ defaultName: 'Thoughtful otter' });

        expect(screen.getByText('Thoughtful otter')).toBeTruthy();

        fireEvent.submit(screen.getByRole('button', { name: 'Join' }));

        expect(onSubmit).toHaveBeenCalledWith(
            { name: 'Thoughtful otter' },
            expect.any(FormData),
        );
    });

    it('omits the colour picker and the presence when takenColors is absent', () => {
        const onSubmit = setup({ initialName: 'Nadia' });

        expect(screen.queryByRole('radiogroup')).toBeNull();

        fireEvent.submit(screen.getByRole('button', { name: 'Join' }));

        expect(onSubmit).toHaveBeenCalledWith(
            { name: 'Nadia' },
            expect.any(FormData),
        );
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

        expect(onSubmit).toHaveBeenCalledWith(
            { name: 'Nadia', presence: 1 },
            expect.any(FormData),
        );
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

        expect(onSubmit).toHaveBeenCalledWith(
            { name: 'Théo B.' },
            expect.any(FormData),
        );
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

    it('promises no suggested nickname when none is proposed', () => {
        setup();

        expect(
            document.querySelector('[data-slot="guest-join-preview"]'),
        ).toBeNull();
        expect(
            screen.queryByText('Suggested nickname if you leave it empty'),
        ).toBeNull();

        fireEvent.change(screen.getByLabelText('Your nickname'), {
            target: { value: 'Nadia' },
        });

        expect(
            document.querySelector('[data-slot="guest-join-preview"]')
                ?.textContent,
        ).toContain('Nadia');
    });

    it('shows the proposed nickname with its hint while the field is empty', () => {
        setup({ defaultName: 'Thoughtful otter' });

        const preview = document.querySelector(
            '[data-slot="guest-join-preview"]',
        );

        expect(preview?.textContent).toContain('Thoughtful otter');
        expect(preview?.textContent).toContain(
            'Suggested nickname if you leave it empty',
        );
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

        expect(onSubmit).toHaveBeenCalledWith(
            { name: longName },
            expect.any(FormData),
        );
    });

    it('renders extra controls before the join button and submits them as form data', () => {
        const onSubmit = setup({
            defaultName: 'Thoughtful otter',
            children: (
                <label>
                    <input
                        type="checkbox"
                        id="spectator"
                        name="spectator"
                        value="1"
                    />
                    Join as spectator
                </label>
            ),
        });
        const spectator = screen.getByLabelText('Join as spectator');
        const join = screen.getByRole('button', { name: 'Join' });

        expect(spectator.id).toBe('spectator');
        expect(
            spectator.compareDocumentPosition(join) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();

        fireEvent.click(spectator);
        fireEvent.submit(join);

        const [data, formData] = onSubmit.mock.calls[0] as [
            { name: string },
            FormData,
        ];

        expect(data).toEqual({ name: 'Thoughtful otter' });
        expect(formData.get('spectator')).toBe('1');
        expect(formData.get('name')).toBe('Thoughtful otter');
    });

    it('keeps the join button in the flow by default', () => {
        setup();

        const wrapper = document.querySelector(
            '[data-slot="guest-join-action"]',
        );

        expect(wrapper?.classList.contains('sticky')).toBe(false);
        expect(
            wrapper?.contains(screen.getByRole('button', { name: 'Join' })),
        ).toBe(true);
    });

    it('pins the join button to the bottom with stickyAction', () => {
        setup({ stickyAction: true });

        const wrapper = document.querySelector(
            '[data-slot="guest-join-action"]',
        );

        expect(wrapper?.classList.contains('sticky')).toBe(true);
        expect(wrapper?.classList.contains('bottom-0')).toBe(true);
        expect(
            wrapper?.contains(screen.getByRole('button', { name: 'Join' })),
        ).toBe(true);
    });

    it('links to the login page', () => {
        setup();

        expect(
            screen.getByRole('link', { name: 'Log in' }).getAttribute('href'),
        ).toBe('/login');
    });
});
