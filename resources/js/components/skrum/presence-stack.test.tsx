import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PresenceStack } from '@/components/skrum/presence-stack';
import type { Participant } from '@/components/skrum/presence-stack';
import { renderWithProviders } from '@/test/render';

function person(index: number, overrides: Partial<Participant> = {}) {
    return {
        id: `p${index}`,
        name: `Person${index} Name`,
        initials: 'PN',
        presence: (index % 12) + 1,
        role: 'member',
        status: 'online',
        ...overrides,
    } satisfies Participant;
}

const twelve = Array.from({ length: 12 }, (_, index) => person(index));

describe('PresenceStack', () => {
    it('shows five avatars, the +N chip and the real total', () => {
        const { container } = renderWithProviders(
            <PresenceStack participants={twelve} />,
        );

        expect(
            container.querySelectorAll('[data-slot="person-avatar"]'),
        ).toHaveLength(5);
        expect(screen.getByText('+7')).toBeTruthy();
        expect(screen.getByText('12 online')).toBeTruthy();
    });

    it('keeps the participant id on the avatar element', () => {
        const { container } = renderWithProviders(
            <PresenceStack participants={twelve} max={2} />,
        );

        const ids = [...container.querySelectorAll('[data-presence-id]')].map(
            (element) => element.getAttribute('data-presence-id'),
        );

        expect(ids).toEqual(['p0', 'p1']);
    });

    it('shows the server avatar as an image that carries the id and the name', () => {
        const { container } = renderWithProviders(
            <PresenceStack
                participants={[
                    person(0, { avatarUrl: '/avatars/0.png' }),
                    person(1, {
                        role: 'guest',
                        name: 'Visitor',
                        avatarUrl: '/avatars/guest.png',
                    }),
                    person(2),
                ]}
            />,
        );

        const images = [...container.querySelectorAll('img[data-presence-id]')];

        expect(
            images.map((image) => [
                image.getAttribute('data-presence-id'),
                image.getAttribute('alt'),
                image.getAttribute('src'),
            ]),
        ).toEqual([
            ['p0', 'Person0 Name', '/avatars/0.png'],
            ['p1', 'Visitor', '/avatars/guest.png'],
        ]);
        expect(container.querySelectorAll('[data-presence-id]')).toHaveLength(
            3,
        );
    });

    it('falls back to the initials when the image fails, keeping the id', () => {
        const { container } = renderWithProviders(
            <PresenceStack
                participants={[person(0, { avatarUrl: '/avatars/0.png' })]}
            />,
        );

        fireEvent.error(container.querySelector('img') as HTMLImageElement);

        expect(container.querySelector('img')).toBeNull();
        expect(
            container
                .querySelector('[data-presence-id="p0"]')
                ?.getAttribute('data-slot'),
        ).toBe('person-avatar');
    });

    it('does not repeat the ids in the opened list', () => {
        renderWithProviders(
            <PresenceStack
                participants={[
                    person(0, { avatarUrl: '/avatars/0.png' }),
                    person(1),
                ]}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /view the list/ }));

        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(document.querySelectorAll('[data-presence-id]')).toHaveLength(2);
    });

    it('accepts participants without initials or presence colour, and a 60-character name', () => {
        const name = 'N'.repeat(60);

        renderWithProviders(
            <PresenceStack
                participants={[
                    { id: 'a', name, role: 'member', status: 'online' },
                ]}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /view the list/ }));

        expect(within(screen.getByRole('dialog')).getByText(name)).toBeTruthy();
    });

    it('renders nobody and 200 participants', () => {
        const { unmount } = renderWithProviders(
            <PresenceStack participants={[]} />,
        );

        expect(screen.getByText('0 online')).toBeTruthy();
        unmount();

        renderWithProviders(
            <PresenceStack
                participants={Array.from({ length: 200 }, (_, index) =>
                    person(index),
                )}
            />,
        );

        expect(screen.getByText('+195')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /view the list/ }));
        expect(
            within(screen.getByRole('dialog')).getAllByRole('listitem'),
        ).toHaveLength(200);
    });

    it('exposes a dialog button and lists everyone in the popover', () => {
        renderWithProviders(<PresenceStack participants={twelve} />);

        const button = screen.getByRole('button', {
            name: '12 participants connected, view the list',
        });

        expect(button.getAttribute('aria-haspopup')).toBe('dialog');

        fireEvent.click(button);

        const dialog = screen.getByRole('dialog');

        expect(within(dialog).getAllByRole('listitem')).toHaveLength(12);
    });

    it('orders the list facilitator, me, online, away, offline, guests', () => {
        const participants = [
            person(0, { status: 'offline', name: 'Offline One' }),
            person(1, { role: 'guest', name: 'Guest One' }),
            person(2, { status: 'away', name: 'Away One' }),
            person(3, { name: 'Online One' }),
            person(4, { isMe: true, name: 'Me One' }),
            person(5, { role: 'facilitator', name: 'Chief One' }),
        ];

        renderWithProviders(<PresenceStack participants={participants} />);
        fireEvent.click(screen.getByRole('button'));

        const names = within(screen.getByRole('dialog'))
            .getAllByRole('listitem')
            .map((item) => item.textContent ?? '');

        const order = [
            'Chief One',
            'Me One',
            'Online One',
            'Away One',
            'Offline One',
            'Guest One',
        ];

        order.forEach((name, index) => {
            expect(names[index]).toContain(name);
        });
    });

    it('states presence in text, not only by colour', () => {
        renderWithProviders(
            <PresenceStack
                participants={[
                    person(0, { status: 'away', awayMinutes: 3 }),
                    person(1, { status: 'offline' }),
                    person(2, { typing: true }),
                ]}
            />,
        );
        fireEvent.click(screen.getByRole('button'));

        const dialog = screen.getByRole('dialog');

        expect(within(dialog).getByText(/Away for 3 min/)).toBeTruthy();
        expect(within(dialog).getByText(/Disconnected/)).toBeTruthy();
        expect(within(dialog).getByText(/Writing…/)).toBeTruthy();
    });

    it('counts offline participants out of the total and the stack', () => {
        const { container } = renderWithProviders(
            <PresenceStack
                participants={[person(0), person(1, { status: 'offline' })]}
            />,
        );

        expect(
            container.querySelectorAll('[data-slot="person-avatar"]'),
        ).toHaveLength(1);
    });

    it('names who is typing in a live region', () => {
        renderWithProviders(
            <PresenceStack
                participants={[
                    person(0, { name: 'Inès Benali', typing: true }),
                    person(1, { name: 'Yuki Sato', typing: true }),
                ]}
            />,
        );

        const region = document.querySelector('[aria-live="polite"]');

        expect(region?.textContent).toContain('Inès and Yuki are writing…');
    });

    it('renders no typing text when nobody types', () => {
        renderWithProviders(<PresenceStack participants={twelve} />);

        const region = document.querySelector('[aria-live="polite"]');

        expect(region?.textContent).toBe('');
    });

    it('shows Invite only with a callback, and calls it', () => {
        const onInvite = vi.fn();
        const { unmount } = renderWithProviders(
            <PresenceStack participants={twelve} />,
        );

        fireEvent.click(screen.getByRole('button'));
        expect(screen.queryByRole('button', { name: 'Invite' })).toBeNull();
        unmount();

        renderWithProviders(
            <PresenceStack participants={twelve} onInvite={onInvite} />,
        );
        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(screen.getByRole('button', { name: 'Invite' }));

        expect(onInvite).toHaveBeenCalledTimes(1);
    });

    it('closes the popover on Escape', () => {
        renderWithProviders(<PresenceStack participants={twelve} />);
        fireEvent.click(screen.getByRole('button'));

        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows a guest count badge for anonymous guests', () => {
        renderWithProviders(
            <PresenceStack
                participants={[
                    person(0),
                    person(1, { role: 'guest' }),
                    person(2, { role: 'guest' }),
                ]}
            />,
        );

        expect(screen.getByText('2 guests')).toBeTruthy();
    });
});
