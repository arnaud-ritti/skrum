import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    SessionPresence,
    toParticipants,
} from '@/components/session/session-presence';
import { hashedSlot } from '@/lib/presence/presence-color';
import { renderWithProviders } from '@/test/render';

const online = [
    {
        id: 'p1',
        name: 'Alice Martin',
        avatarUrl: '/avatars/a.svg',
        isGuest: false,
        presence: 9,
    },
    {
        id: 'p2',
        name: 'Bob Stone',
        avatarUrl: '/avatars/b.svg',
        isGuest: false,
        presence: 2,
    },
    { id: 'p3', name: 'Visitor', avatarUrl: '/avatars/c.svg', isGuest: true },
];

function stubViewport(matching: string[]): void {
    vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string): MediaQueryList => ({
            matches: matching.includes(query),
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
        }),
    );
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('toParticipants', () => {
    it("maps role, self, status and each person's colour", () => {
        expect(toParticipants(online, 'p2', 'p1')).toEqual([
            {
                id: 'p1',
                name: 'Alice Martin',
                avatarUrl: '/avatars/a.svg',
                role: 'facilitator',
                status: 'online',
                isMe: false,
                presence: 9,
            },
            {
                id: 'p2',
                name: 'Bob Stone',
                avatarUrl: '/avatars/b.svg',
                role: 'member',
                status: 'online',
                isMe: true,
                presence: 2,
            },
            {
                id: 'p3',
                name: 'Visitor',
                avatarUrl: '/avatars/c.svg',
                role: 'guest',
                status: 'online',
                isMe: false,
                presence: hashedSlot('p3'),
            },
        ]);
    });

    it('lets a caller choose the colour', () => {
        expect(
            toParticipants(online, 'p2', 'p1', () => 4).map(
                (participant) => participant.presence,
            ),
        ).toEqual([4, 4, 4]);
    });
});

describe('SessionPresence', () => {
    it("paints each avatar in the person's colour", () => {
        const { container } = renderWithProviders(
            <SessionPresence online={online} selfId="p2" />,
        );

        expect(container.querySelector('.bg-skrum-presence-9')).not.toBeNull();
    });

    it('names the group by the number online and tags each avatar for flying reactions', () => {
        const { container } = renderWithProviders(
            <SessionPresence online={online} selfId="p1" />,
        );

        expect(screen.getByRole('group', { name: '3 online' })).toBeTruthy();
        expect(
            container.querySelector(
                'img[data-presence-id="p3"][alt="Visitor"]',
            ),
        ).not.toBeNull();
    });

    it('keeps the five avatars and the counter of the mockup', () => {
        const many = Array.from({ length: 10 }, (_, index) => ({
            id: `p${index}`,
            name: `Person ${index}`,
            avatarUrl: `/avatars/${index}.svg`,
            isGuest: false,
        }));
        const { container } = renderWithProviders(
            <SessionPresence online={many} selfId="p0" />,
        );

        expect(container.querySelectorAll('[data-presence-id]')).toHaveLength(
            5,
        );
        expect(screen.getByRole('group', { name: '10 online' })).toBeTruthy();
    });

    it('shows the counter alone below 64rem, without avatars or the overflow bubble', () => {
        stubViewport(['not all and (min-width: 64rem)']);

        const { container } = renderWithProviders(
            <SessionPresence online={online} selfId="p1" />,
        );

        expect(container.querySelector('[data-presence-id]')).toBeNull();
        expect(
            container.querySelector('[data-slot="presence-stack-more"]'),
        ).toBeNull();
        expect(screen.getByRole('group', { name: '3 online' })).toBeTruthy();
    });

    it('keeps the avatars from 64rem, and the small ones of a whiteboard below sm only', () => {
        stubViewport(['(max-width: 767px)']);

        const wide = renderWithProviders(
            <SessionPresence online={online} selfId="p1" />,
        );

        expect(
            wide.container.querySelectorAll('[data-presence-id]'),
        ).toHaveLength(3);
        wide.unmount();

        stubViewport(['not all and (min-width: 64rem)']);

        const { container } = renderWithProviders(
            <SessionPresence online={online} selfId="p1" phoneAvatars={2} />,
        );

        expect(container.querySelectorAll('[data-presence-id]')).toHaveLength(
            3,
        );
    });

    it('keeps the number when the bar has no room for "online"', () => {
        const { container } = renderWithProviders(
            <SessionPresence online={online} selfId="p1" />,
        );
        const count = container.querySelector(
            '[data-slot="presence-stack-count"]',
        );
        const [number, label] = count?.children ?? [];

        expect(number.textContent).toBe('3');
        expect(number.getAttribute('aria-hidden')).toBe('true');
        expect(number.className).toContain('@session-detail/session:hidden');
        expect(label.textContent).toBe('3 online');
        expect(label.className).toContain('sr-only');
        expect(label.className).toContain(
            '@session-detail/session:not-sr-only',
        );
    });

    it('folds the guests into the presence popover', async () => {
        const { container } = renderWithProviders(
            <SessionPresence online={online} selfId="p1" />,
        );
        const badge = container.querySelector(
            '[data-slot="presence-stack-guests"]',
        );

        expect(badge?.textContent).toBe('1 guest');
        expect(badge?.className).toContain('hidden');
        expect(badge?.className).toContain(
            '@session-detail/session:inline-flex',
        );

        await userEvent.setup().click(
            screen.getByRole('button', {
                name: '3 participants connected, view the list',
            }),
        );

        expect(
            screen
                .getByRole('dialog', { name: 'Participants' })
                .querySelector('[data-slot="presence-stack-popover-guests"]')
                ?.textContent,
        ).toBe('1 guest');
    });

    it('reads the typing line without showing it, so that the bar never widens while someone writes', () => {
        const { container } = renderWithProviders(
            <SessionPresence
                online={online}
                selfId="p1"
                typingFor={(member) => member.id === 'p2'}
            />,
        );
        const typing = container.querySelector(
            '[data-slot="presence-stack-typing"]',
        );

        expect(typing?.textContent).toBe('Bob is writing…');
        expect(typing?.className).toContain('sr-only');
        expect(typing?.className).not.toContain('not-sr-only');
        expect(typing?.getAttribute('aria-live')).toBe('polite');
    });

    it('rings who is typing and names them on the typing line', () => {
        const { container } = renderWithProviders(
            <SessionPresence
                online={online}
                selfId="p1"
                typingFor={(member) => member.id === 'p2'}
            />,
        );

        expect(container.querySelectorAll('[data-typing="true"]')).toHaveLength(
            1,
        );
        expect(
            container.querySelector('[data-slot="presence-stack-typing"]')
                ?.textContent,
        ).toBe('Bob is writing…');
    });

    it('forwards a count of people writing, with no ring', () => {
        const { container } = renderWithProviders(
            <SessionPresence online={online} selfId="p1" typingCount={2} />,
        );

        expect(container.querySelector('[data-typing]')).toBeNull();
        expect(
            container.querySelector('[data-slot="presence-stack-typing"]')
                ?.textContent,
        ).toBe('2 people are writing…');
    });
});
