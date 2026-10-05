import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HealthCheckCompact } from '@/components/skrum/health-check-compact';
import type { HealthCheckResult } from '@/components/skrum/health-check-results';
import { renderWithProviders } from '@/test/render';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    };
});

const results: HealthCheckResult[] = [
    {
        key: 'interaction',
        label: 'Interaction',
        average: 4.2,
        previousAverage: 4.1,
    },
    {
        key: 'support',
        label: 'Manager support',
        average: 4.4,
        previousAverage: 4.4,
    },
    { key: 'tasks', label: 'Clear tasks', average: 3.6, previousAverage: 3.8 },
    {
        key: 'processes',
        label: 'Processes',
        average: 2.6,
        previousAverage: 3.1,
    },
    { key: 'vision', label: 'Vision', average: 3.3, previousAverage: null },
    { key: 'motivation', label: 'Motivation', average: null },
];

const row = (key: string) =>
    document.querySelector(`[data-statement-key="${key}"]`) as HTMLElement;

const delta = (key: string) =>
    row(key).querySelector('[data-slot="health-compact-delta"]');

function show(props: Partial<Parameters<typeof HealthCheckCompact>[0]> = {}) {
    return renderWithProviders(
        <HealthCheckCompact
            respondents={8}
            score={3.6}
            results={results}
            previousRetroTitle="Sprint 41"
            {...props}
        />,
    );
}

describe('HealthCheckCompact', () => {
    it('is a section named by its heading, with the answers and the average beside it', () => {
        show();

        const card = screen.getByRole('region', { name: 'Health check' });

        expect(
            within(card).getByRole('heading', {
                name: 'Health check',
                level: 2,
            }).parentElement,
        ).toBe(card);
        expect(card.textContent).toContain('8 answers · avg 3.6');
    });

    it('counts a single answer in the singular', () => {
        show({ respondents: 1 });

        expect(
            screen.getByRole('region', { name: 'Health check' }).textContent,
        ).toContain('1 answer · avg 3.6');
    });

    it('has one row per statement: label, bar as wide as the score, score', () => {
        show();

        expect(screen.getAllByRole('listitem')).toHaveLength(6);
        expect(row('interaction').textContent).toContain('Interaction');
        expect(
            row('interaction').querySelector(
                '[data-slot="health-compact-mean"]',
            )?.textContent,
        ).toBe('4.2');
        expect(
            (
                row('interaction').querySelector(
                    '[data-slot="health-compact-bar"] > span',
                ) as HTMLElement
            ).style.width,
        ).toBe('84%');
    });

    it('says how each statement moved since the previous retro', () => {
        show();

        expect(delta('interaction')?.textContent).toBe('+0.1 vs Sprint 41');
        expect(delta('interaction')?.getAttribute('data-trend')).toBe('up');
        expect(delta('tasks')?.textContent).toBe('−0.2 vs Sprint 41');
        expect(delta('tasks')?.getAttribute('data-trend')).toBe('down');
        expect(delta('support')?.textContent).toBe('=no change vs Sprint 41');
        expect(delta('vision')).toBeNull();
    });

    it('has no bar and no score for a statement nobody answered', () => {
        show();

        expect(
            row('motivation').querySelector(
                '[data-slot="health-compact-bar"] > span',
            ),
        ).toBeNull();
        expect(row('motivation').textContent).toContain('No answers');
    });

    it('marks a statement under the alert threshold, in words too', () => {
        show();

        expect(row('processes').getAttribute('data-alert')).toBe('true');
        expect(row('processes').textContent).toContain('Needs attention');
        expect(row('vision').getAttribute('data-alert')).toBeNull();
    });

    it('names the statement that dropped the most', () => {
        show();

        expect(
            document.querySelector('[data-slot="health-compact-note"]')
                ?.textContent,
        ).toBe('Processes dropped 0.5 — worth a topic next retro.');
    });

    it('has no such note when nothing dropped', () => {
        show({ results: results.slice(0, 2) });

        expect(
            document.querySelector('[data-slot="health-compact-note"]'),
        ).toBeNull();
    });

    it('opens the details from a button, absent without a handler', async () => {
        const onDetails = vi.fn();
        const { unmount } = show({ onDetails });

        await userEvent.click(screen.getByRole('button', { name: 'Details' }));

        expect(onDetails).toHaveBeenCalledOnce();

        unmount();
        show();

        expect(screen.queryByRole('button', { name: 'Details' })).toBeNull();
    });

    it('says so when there is no statement', () => {
        show({ results: [] });

        expect(screen.queryByRole('list')).toBeNull();
        expect(
            screen.getByRole('region', { name: 'Health check' }).textContent,
        ).toContain('No statements to show.');
    });
});
