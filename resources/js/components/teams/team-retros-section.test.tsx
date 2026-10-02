import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    TeamRetrosSection,
    retroTone,
} from '@/components/teams/team-retros-section';
import { renderWithProviders } from '@/test/render';
import type { RetroSummary } from '@/types';

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    reload: vi.fn(),
    props: {
        translations: {},
        locale: 'en',
        errors: {} as Record<string, string>,
    },
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: mocks.props }),
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string | { url: string };
            children: React.ReactNode;
        }) => (
            <a href={typeof href === 'string' ? href : href.url} {...props}>
                {children}
            </a>
        ),
        router: {
            post: mocks.post,
            patch: mocks.patch,
            delete: mocks.delete,
            reload: mocks.reload,
        },
    };
});

const writing: RetroSummary = {
    id: 'retro-1',
    title: 'Sprint 42 retrospective',
    phase: 'writing',
    phaseLabel: 'Writing',
    createdAt: '2026-09-28T10:00:00+00:00',
    templateName: '4L',
    facilitator: { name: 'Camille Roux', avatarUrl: '/avatars/c.svg' },
    rotiAverage: null,
};

const closed: RetroSummary = {
    ...writing,
    id: 'retro-2',
    title: 'Sprint 41 retrospective',
    phase: 'completed',
    phaseLabel: 'Completed',
    templateName: 'Sailboat',
    rotiAverage: 4.1,
};

describe('retroTone', () => {
    it('gives voting the warning tone, a closed retro the muted one and the other phases the info one', () => {
        expect(retroTone('voting')).toBe('warning');
        expect(retroTone('completed')).toBe('muted');
        expect(retroTone('writing')).toBe('info');
        expect(retroTone('discussing')).toBe('info');
    });
});

describe('the retrospectives of a team', () => {
    it('shows an empty state without a card', () => {
        const { container } = renderWithProviders(
            <TeamRetrosSection retros={[]} />,
        );

        expect(screen.getByText('No retrospectives yet.')).toBeTruthy();
        expect(container.querySelector('[data-slot="team-retros"]')).toBeNull();
        expect(
            screen.getByRole('heading', { level: 2, name: /Retrospectives/ }),
        ).toBeTruthy();
    });

    it('links each card to its retro with its phase, template and facilitator', () => {
        renderWithProviders(<TeamRetrosSection retros={[writing, closed]} />);

        const card = screen.getByRole('link', {
            name: /Sprint 42 retrospective/,
        });
        const status = card.querySelector(
            '[data-slot="session-card-status"]',
        ) as HTMLElement;

        expect(card.getAttribute('href')).toBe('/retros/retro-1');
        expect(status.textContent).toBe('Writing');
        expect(status.dataset.tone).toBe('info');
        expect(within(card).getByText(/4L ·/)).toBeTruthy();
        expect(
            within(card).getByText('Facilitated by Camille Roux'),
        ).toBeTruthy();
        expect(within(card).getByText('Join')).toBeTruthy();
        expect(card.querySelector('[data-slot="retro-roti"]')).toBeNull();
    });

    it('shows the ROTI of a closed retro and sends to its summary', () => {
        renderWithProviders(<TeamRetrosSection retros={[writing, closed]} />);

        const card = screen.getByRole('link', {
            name: /Sprint 41 retrospective/,
        });

        expect(
            (
                card.querySelector(
                    '[data-slot="session-card-status"]',
                ) as HTMLElement
            ).dataset.tone,
        ).toBe('muted');
        expect(within(card).getByText('ROTI 4.1 / 5')).toBeTruthy();
        expect(within(card).getByText('Summary')).toBeTruthy();
        expect(card.querySelector('[data-slot="session-card-dot"]')).toBeNull();
    });

    it('counts the retros beside the title and survives a retro without facilitator or date', () => {
        renderWithProviders(
            <TeamRetrosSection
                retros={[
                    writing,
                    {
                        ...closed,
                        facilitator: null,
                        createdAt: null as unknown as string,
                    },
                ]}
            />,
        );

        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
            'Retrospectives2',
        );
        expect(screen.getAllByText(/Facilitated by/)).toHaveLength(1);
    });
});
