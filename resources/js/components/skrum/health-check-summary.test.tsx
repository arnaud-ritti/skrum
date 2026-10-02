import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HealthCheckSummary } from '@/components/skrum/health-check-summary';
import type { HealthCheckSummaryStatement } from '@/components/skrum/health-check-summary';
import { renderWithProviders } from '@/test/render';

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
            children?: React.ReactNode;
        }) => (
            <a href={href} {...props}>
                {children}
            </a>
        ),
    };
});

const statements: HealthCheckSummaryStatement[] = [
    {
        id: 'interaction',
        label: 'Interaction',
        text: 'Interaction with colleagues was productive',
        isBuiltin: true,
    },
    {
        id: 'vision',
        label: 'Vision',
        text: 'The vision and goals are clear to me',
        isBuiltin: true,
    },
    {
        id: 'custom-1',
        label: 'Delivery',
        text: 'We shipped what we promised',
        isBuiltin: false,
    },
];

describe('HealthCheckSummary', () => {
    it('is a region titled "Health check" whose sentence counts the statements and gives the scale', () => {
        renderWithProviders(<HealthCheckSummary statements={statements} />);

        const region = screen.getByRole('region', { name: 'Health check' });

        expect(
            within(region).getByText(
                '3 statements asked at the end of each retro, scored 1–10.',
            ),
        ).toBeTruthy();
    });

    it('counts a single statement in the singular', () => {
        renderWithProviders(
            <HealthCheckSummary statements={statements.slice(0, 1)} />,
        );

        expect(
            screen.getByText(
                '1 statement asked at the end of each retro, scored 1–10.',
            ),
        ).toBeTruthy();
    });

    it('lists each statement with its short label, its origin and its text, in the order given', () => {
        renderWithProviders(<HealthCheckSummary statements={statements} />);

        expect(
            screen.getAllByRole('listitem').map((item) => item.textContent),
        ).toEqual([
            'InteractionBuilt-inInteraction with colleagues was productive',
            'VisionBuilt-inThe vision and goals are clear to me',
            'DeliveryCustomWe shipped what we promised',
        ]);
    });

    it('says when a change of the statements applies', () => {
        renderWithProviders(<HealthCheckSummary statements={statements} />);

        expect(
            screen.getByText(
                'Changes apply to retros that have not collected answers yet.',
            ),
        ).toBeTruthy();
    });

    it('links to the page that manages the statements, under the word given', () => {
        const { rerender } = renderWithProviders(
            <HealthCheckSummary
                statements={statements}
                manageHref="/teams/atlas/health-check"
            />,
        );

        expect(
            screen.getByRole('link', { name: 'Manage' }).getAttribute('href'),
        ).toBe('/teams/atlas/health-check');

        rerender(
            <HealthCheckSummary
                statements={statements}
                manageHref="/teams/atlas/health-check"
                manageLabel="Details"
            />,
        );

        expect(screen.getByRole('link', { name: 'Details' })).toBeTruthy();
    });

    it('has no link without a page to lead to', () => {
        renderWithProviders(<HealthCheckSummary statements={statements} />);

        expect(screen.queryByRole('link')).toBeNull();
    });
});
