import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamScheduleLine } from '@/components/teams/team-schedule';
import { renderWithProviders } from '@/test/render';
import type { TeamSchedule } from '@/types';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string;
            children: React.ReactNode;
        }) => (
            <a href={href} {...props}>
                {children}
            </a>
        ),
    };
});

const sprint = {
    id: 'sprint-42',
    number: 42,
    startsOn: '2026-09-21',
    endsOn: '2026-10-04',
};

function line(container: HTMLElement): string | undefined {
    return container
        .querySelector('[data-slot="team-schedule"]')
        ?.textContent?.trim();
}

describe('the sprint and the next retro of a team', () => {
    it('names the sprint and the next retro with its time', () => {
        const { container } = renderWithProviders(
            <TeamScheduleLine
                schedule={{
                    sprint,
                    nextRetro: { date: '2026-10-02', time: '14:00' },
                }}
            />,
        );

        expect(line(container)).toMatch(
            /^Sprint 42 · Next retro Fri, Oct 2, 2\sPM$/u,
        );
        expect(
            container.querySelector('[data-slot="team-schedule"] svg'),
        ).not.toBeNull();
    });

    it('leaves the time out when the team has none', () => {
        const { container } = renderWithProviders(
            <TeamScheduleLine
                schedule={{
                    sprint,
                    nextRetro: { date: '2026-10-02', time: null },
                }}
            />,
        );

        expect(line(container)).toBe('Sprint 42 · Next retro Fri, Oct 2');
    });

    it('shows the sprint alone without a next retro, and the next retro alone between two sprints', () => {
        const schedules: Array<[TeamSchedule, string]> = [
            [{ sprint, nextRetro: null }, 'Sprint 42'],
            [
                {
                    sprint: null,
                    nextRetro: { date: '2026-10-02', time: null },
                },
                'Next retro Fri, Oct 2',
            ],
        ];

        for (const [schedule, expected] of schedules) {
            const { container, unmount } = renderWithProviders(
                <TeamScheduleLine schedule={schedule} />,
            );

            expect(line(container)).toBe(expected);
            unmount();
        }
    });

    it('renders nothing without a schedule', () => {
        const { container } = renderWithProviders(
            <TeamScheduleLine schedule={null} />,
        );

        expect(container.innerHTML).toBe('');
    });

    it('offers to start the first sprint to who may, on a team without sprints', () => {
        renderWithProviders(
            <TeamScheduleLine
                schedule={null}
                startFirstSprintHref="/w/nordlys/teams/team-1/members#sprints"
            />,
        );

        expect(
            screen
                .getByRole('link', { name: 'Start the first sprint' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/members#sprints');
    });
});
