import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InstanceVersionStatus } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import { UpdatesCard } from './updates-card';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

function setup(status: InstanceVersionStatus, enabled = true) {
    const onEnabledChange = vi.fn();

    renderWithProviders(
        <UpdatesCard
            version="1.8.2"
            status={status}
            enabled={enabled}
            onEnabledChange={onEnabledChange}
        />,
    );

    return onEnabledChange;
}

function lastCheck(): string {
    return (
        document.querySelector('[data-slot=update-last-check]')?.textContent ??
        ''
    );
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-03T10:00:00'));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('UpdatesCard', () => {
    it('shows the version and turns the check on', () => {
        const onEnabledChange = setup(
            { state: 'unknown', latest: null, checkedAt: null },
            false,
        );

        expect(screen.getByText('v1.8.2')).not.toBeNull();
        expect(
            screen.getByText(
                'The instance asks GitHub once a day; nothing about the instance is sent.',
            ),
        ).not.toBeNull();

        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Check for new versions once a day',
            }),
        );

        expect(onEnabledChange).toHaveBeenCalledExactlyOnceWith(true);
    });

    it('says a newer version is available', () => {
        setup({
            state: 'outdated',
            latest: '1.9.0',
            checkedAt: '2026-10-03T06:00:00',
        });

        expect(lastCheck()).toBe('Checked today: v1.9.0 is available.');
    });

    it('says the instance is up to date', () => {
        setup({
            state: 'current',
            latest: '1.8.2',
            checkedAt: '2026-10-02T06:00:00',
        });

        expect(lastCheck()).toBe('Checked yesterday: up to date.');
    });

    it('says when no check has given an answer', () => {
        setup({ state: 'unknown', latest: null, checkedAt: null });

        expect(lastCheck()).toBe('Never checked.');
    });

    it('says that a build outside the releases is not compared', () => {
        setup({ state: 'unreleased', latest: null, checkedAt: null });

        expect(lastCheck()).toBe(
            'This build is not a release: it is not compared with new versions.',
        );
    });

    it('reads the refusal with the switch', () => {
        renderWithProviders(
            <UpdatesCard
                version="1.8.2"
                status={{ state: 'unknown', latest: null, checkedAt: null }}
                enabled
                onEnabledChange={vi.fn()}
                error="The check cannot be turned on."
            />,
        );

        expect(
            screen
                .getByRole('switch')
                .getAttribute('aria-describedby')
                ?.split(' ')
                .map((id) => document.getElementById(id)?.textContent),
        ).toContain('The check cannot be turned on.');
    });

    it('says nothing of a check while it is off', () => {
        setup({ state: 'unknown', latest: null, checkedAt: null }, false);

        expect(
            document.querySelector('[data-slot=update-last-check]'),
        ).toBeNull();
    });
});
