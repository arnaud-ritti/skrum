import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InstanceVersionStatus } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import { UpdatesCard } from './updates-card';

type PostOptions = { onStart?: () => void; onFinish?: () => void };

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router: { post: mocks.post },
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
    mocks.post.mockReset();
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

    it('still says when it last checked while the daily check is off', () => {
        setup({ state: 'unknown', latest: null, checkedAt: null }, false);

        expect(lastCheck()).toBe('Never checked.');
    });

    it('offers Check now beside the last check', () => {
        setup(
            {
                state: 'current',
                latest: '1.8.2',
                checkedAt: '2026-10-02T06:00:00',
            },
            false,
        );

        const button = screen.getByRole('button', { name: 'Check now' });
        const row = button.parentElement;

        expect(
            row?.querySelector('[data-slot=update-last-check]')?.textContent,
        ).toBe('Checked yesterday: up to date.');
        expect(row?.className).toContain('justify-between');

        fireEvent.click(button);

        expect(mocks.post).toHaveBeenCalledOnce();
        expect(mocks.post.mock.calls[0][0]).toBe('/admin/update-checks');
        expect(mocks.post.mock.calls[0][2]).toMatchObject({
            preserveScroll: true,
        });
    });

    it('shows its progress and cannot be pressed twice', () => {
        setup({ state: 'unknown', latest: null, checkedAt: null });

        const button = () =>
            screen.getByRole('button', {
                name: 'Check now',
            }) as HTMLButtonElement;

        fireEvent.click(button());

        const options = mocks.post.mock.calls[0][2] as PostOptions;

        act(() => options.onStart?.());

        expect(button().disabled).toBe(true);
        expect(button().getAttribute('aria-busy')).toBe('true');

        fireEvent.click(button());

        expect(mocks.post).toHaveBeenCalledOnce();

        act(() => options.onFinish?.());

        expect(button().disabled).toBe(false);
    });
});
