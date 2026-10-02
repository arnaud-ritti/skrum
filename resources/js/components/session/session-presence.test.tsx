import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});
