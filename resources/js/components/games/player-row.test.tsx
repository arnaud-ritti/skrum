import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlayerPoints, PlayerRow } from './player-row';

const base = {
    name: 'Casey',
    avatarUrl: '/avatars/casey.svg',
    isGuest: false,
};

describe('PlayerRow', () => {
    it('is a list item with the name of the player', () => {
        render(
            <ul>
                <PlayerRow {...base} />
            </ul>,
        );

        const row = screen.getByRole('listitem');

        expect(
            row.querySelector('[data-slot="player-name"]')?.textContent,
        ).toBe('Casey');
        expect(row.getAttribute('data-me')).toBeNull();
        expect(row.getAttribute('data-offline')).toBeNull();
    });

    it('marks a guest and the viewer in words', () => {
        render(
            <ul>
                <PlayerRow {...base} isGuest isMe />
            </ul>,
        );

        const row = screen.getByRole('listitem');

        expect(row.textContent).toContain('(guest)');
        expect(row.textContent).toContain('(you)');
        expect(row.getAttribute('data-me')).toBe('true');
    });

    it('dims a player who is offline', () => {
        render(
            <ul>
                <PlayerRow {...base} offline />
            </ul>,
        );

        expect(screen.getByRole('listitem').getAttribute('data-offline')).toBe(
            'true',
        );
    });

    it('shows a rank, a detail line and what comes last', () => {
        render(
            <ol>
                <PlayerRow
                    {...base}
                    rank={2}
                    detail="found it"
                    trailing={<PlayerPoints points={6} />}
                />
            </ol>,
        );

        const row = screen.getByRole('listitem');

        expect(
            row.querySelector('[data-slot="player-rank"]')?.textContent,
        ).toBe('2');
        expect(row.textContent).toContain('found it');
        expect(screen.getByLabelText('6 points').textContent).toBe('6');
    });

    it('names a missing player without an avatar', () => {
        render(
            <ol>
                <PlayerRow
                    name="Former member"
                    avatarUrl={null}
                    isGuest={false}
                />
            </ol>,
        );

        const row = screen.getByRole('listitem');

        expect(row.textContent).toBe('Former member');
        expect(row.querySelector('[data-slot="person-avatar"]')).toBeNull();
    });
});
