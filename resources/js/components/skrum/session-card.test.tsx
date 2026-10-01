import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SessionCard } from '@/components/skrum/session-card';
import type { SessionCardProps } from '@/components/skrum/session-card';

const base: SessionCardProps = {
    href: '/sessions/1',
    kind: 'retro',
    title: 'Sprint 42 retro',
    team: 'Atlas',
    when: '2 days ago',
    status: 'ended',
    stats: { participants: 9, cards: 38, actions: 6 },
};

describe('SessionCard', () => {
    it('is one link whose name includes the title, with no nested buttons', () => {
        render(<SessionCard {...base} />);

        const link = screen.getByRole('link', { name: /Sprint 42 retro/ });

        expect(link.getAttribute('href')).toBe('/sessions/1');
        expect(screen.queryAllByRole('button')).toHaveLength(0);
        expect(screen.getAllByRole('link')).toHaveLength(1);
    });

    it('shows the ended state with the final counters', () => {
        render(<SessionCard {...base} />);

        expect(screen.getByText('Ended')).toBeTruthy();
        expect(screen.getByText('38')).toBeTruthy();
        expect(screen.getByText('6')).toBeTruthy();
    });

    it('shows live presence and a join hint instead of the counters', () => {
        render(
            <SessionCard
                {...base}
                kind="poker"
                status="live"
                people={[
                    { name: 'Tess Martin' },
                    { name: 'Noa Kim' },
                    { name: 'Ana Lee' },
                    { name: 'Bo Chen' },
                    { name: 'Cy Dunn' },
                ]}
            />,
        );

        expect(screen.getByText('Live')).toBeTruthy();
        expect(screen.getByText(/Join/)).toBeTruthy();
        expect(screen.getByText('+2')).toBeTruthy();
        expect(screen.queryByText('38')).toBeNull();
    });

    it('moves from live to ended on rerender with the final counters', () => {
        const { rerender } = render(
            <SessionCard
                {...base}
                status="live"
                people={[{ name: 'Tess Martin' }]}
            />,
        );

        expect(screen.getByText('Live')).toBeTruthy();

        rerender(<SessionCard {...base} />);

        expect(screen.getByText('Ended')).toBeTruthy();
        expect(screen.queryByText(/Join/)).toBeNull();
        expect(screen.getByText('38')).toBeTruthy();
    });

    it('renders the scheduled state and omits missing counters', () => {
        render(
            <SessionCard
                {...base}
                status="scheduled"
                stats={{ participants: 4 }}
            />,
        );

        expect(screen.getByText('Scheduled')).toBeTruthy();
        expect(screen.queryByText('cards')).toBeNull();
    });

    it.each(['retro', 'poker', 'whiteboard', 'survey', 'icebreaker'] as const)(
        'renders the %s kind',
        (kind) => {
            render(<SessionCard {...base} kind={kind} />);

            expect(screen.getByRole('link').getAttribute('data-kind')).toBe(
                kind,
            );
        },
    );
});
