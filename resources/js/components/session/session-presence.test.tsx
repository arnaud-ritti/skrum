import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    SessionPresence,
    toParticipants,
} from '@/components/session/session-presence';
import { renderWithProviders } from '@/test/render';

const online = [
    {
        id: 'p1',
        name: 'Alice Martin',
        avatarUrl: '/avatars/a.svg',
        isGuest: false,
    },
    {
        id: 'p2',
        name: 'Bob Stone',
        avatarUrl: '/avatars/b.svg',
        isGuest: false,
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
    it('maps role, self and status', () => {
        expect(toParticipants(online, 'p2', 'p1')).toEqual([
            {
                id: 'p1',
                name: 'Alice Martin',
                avatarUrl: '/avatars/a.svg',
                role: 'facilitator',
                status: 'online',
                isMe: false,
                presence: undefined,
            },
            {
                id: 'p2',
                name: 'Bob Stone',
                avatarUrl: '/avatars/b.svg',
                role: 'member',
                status: 'online',
                isMe: true,
                presence: undefined,
            },
            {
                id: 'p3',
                name: 'Visitor',
                avatarUrl: '/avatars/c.svg',
                role: 'guest',
                status: 'online',
                isMe: false,
                presence: undefined,
            },
        ]);
    });
});

describe('SessionPresence', () => {
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

    it('shows the counter alone below sm, without avatars or the overflow bubble', () => {
        stubViewport(['(max-width: 639px)', '(max-width: 767px)']);

        const { container } = renderWithProviders(
            <SessionPresence online={online} selfId="p1" />,
        );

        expect(container.querySelector('[data-presence-id]')).toBeNull();
        expect(
            container.querySelector('[data-slot="presence-stack-more"]'),
        ).toBeNull();
        expect(screen.getByRole('group', { name: '3 online' })).toBeTruthy();
    });

    it('keeps the avatars between sm and md', () => {
        stubViewport(['(max-width: 767px)']);

        const { container } = renderWithProviders(
            <SessionPresence online={online} selfId="p1" />,
        );

        expect(container.querySelectorAll('[data-presence-id]')).toHaveLength(
            3,
        );
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
