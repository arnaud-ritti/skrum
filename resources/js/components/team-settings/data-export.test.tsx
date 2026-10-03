import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { ClosedTeamSurvey } from './data-export';
import { DataExport } from './data-export';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const surveys: ClosedTeamSurvey[] = [
    {
        id: 's1',
        title: 'Q3 pulse',
        closedAt: '2026-09-18T10:00:00+00:00',
        exportUrl: '/surveys/s1/export',
    },
    {
        id: 's2',
        title: 'Onboarding',
        closedAt: null,
        exportUrl: '/surveys/s2/export',
    },
];

function dataExport(closedSurveys: ClosedTeamSurvey[] = surveys) {
    return renderWithProviders(
        <DataExport
            closedSurveys={closedSurveys}
            estimatesUrl="/w/nordlys/teams/t1/estimates"
            actionItemsUrl="/w/nordlys/action-items?team=t1"
        />,
    );
}

describe('DataExport', () => {
    it('lists each closed survey with its closing day and a CSV download', () => {
        dataExport();

        const rows = Array.from(
            document.querySelectorAll('[data-test="survey-export"]'),
        ) as HTMLElement[];

        expect(rows.map((row) => row.textContent)).toEqual([
            expect.stringContaining('Q3 pulse'),
            expect.stringContaining('Onboarding'),
        ]);
        expect(rows[0].textContent).toContain('Closed on Sep 18, 2026');

        const download = within(rows[0]).getByRole('link', {
            name: 'Download CSV Q3 pulse',
        });

        expect(download.getAttribute('href')).toBe('/surveys/s1/export');
        expect(download.hasAttribute('download')).toBe(true);
    });

    it('says when no survey is closed yet', () => {
        dataExport([]);

        expect(screen.getByText('No closed survey yet.')).not.toBeNull();
        expect(
            document.querySelector('[data-test="survey-export"]'),
        ).toBeNull();
    });

    it('links the estimation history and the action items of the team', () => {
        dataExport();

        const exports = screen.getByRole('region', { name: 'Exports' });

        expect(
            within(exports)
                .getByRole('link', { name: 'Estimation history' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/teams/t1/estimates');
        expect(exports.textContent).toContain(
            "The team's action items, on the action items page.",
        );
        expect(
            document
                .querySelector('[data-test="action-items-link"]')
                ?.getAttribute('href'),
        ).toBe('/w/nordlys/action-items?team=t1');
    });

    it('says what deleting the team removes', () => {
        dataExport();

        expect(
            screen.getByRole('region', { name: 'What is kept' }).textContent,
        ).toContain(
            "Deleting the team deletes its sessions, action items and settings. Guests' names live only in the sessions they joined.",
        );
    });
});
