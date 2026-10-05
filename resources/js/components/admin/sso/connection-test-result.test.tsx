import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ConnectionTestResult } from './connection-test-result';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('ConnectionTestResult', () => {
    it('shows a successful test with its time and issuer', () => {
        renderWithProviders(
            <ConnectionTestResult
                result={{
                    ok: true,
                    ms: 184,
                    issuer: 'https://login.atlas.test/realms/atlas',
                    error: null,
                }}
                lastTest={null}
            />,
        );

        expect(
            screen.getByText(
                'Connected · 184 ms · issuer https://login.atlas.test/realms/atlas',
            ),
        ).not.toBeNull();
    });

    it.each([
        [
            'unreachable',
            "The provider's discovery document could not be reached.",
        ],
        [
            'not_oidc',
            'The address answers, but not with an OpenID Connect discovery document.',
        ],
        [
            'issuer_mismatch',
            'The provider names another issuer: https://evil.test.',
        ],
    ] as const)('says what failed for %s', (error, sentence) => {
        renderWithProviders(
            <ConnectionTestResult
                result={{
                    ok: false,
                    ms: 90,
                    issuer:
                        error === 'issuer_mismatch'
                            ? 'https://evil.test'
                            : null,
                    error,
                }}
                lastTest={null}
            />,
        );

        expect(screen.getByRole('alert').textContent).toContain(sentence);
    });

    it('keeps the last result and when it ran', () => {
        renderWithProviders(
            <ConnectionTestResult
                result={null}
                lastTest={{
                    provider: 'oidc',
                    at: '2026-10-01T09:00:00Z',
                    ok: true,
                    ms: 120,
                    issuer: 'https://login.atlas.test',
                }}
            />,
        );

        expect(
            screen.getByText(
                'Connected · 120 ms · issuer https://login.atlas.test',
            ),
        ).not.toBeNull();
        expect(screen.getByText(/^Last test 2 days ago at /)).not.toBeNull();
    });

    it('leaves out the time and issuer a kept test lacks', () => {
        renderWithProviders(
            <ConnectionTestResult
                result={null}
                lastTest={{
                    provider: 'oidc',
                    at: '2026-10-03T09:00:00Z',
                    ok: true,
                    ms: null,
                    issuer: null,
                }}
            />,
        );

        expect(screen.getByText('Connected')).not.toBeNull();
    });

    it('says the last test failed without its reason', () => {
        renderWithProviders(
            <ConnectionTestResult
                result={null}
                lastTest={{
                    provider: 'oidc',
                    at: '2026-10-03T09:00:00Z',
                    ok: false,
                    ms: null,
                    issuer: null,
                }}
            />,
        );

        expect(screen.getByRole('alert').textContent).toContain(
            'The last test failed.',
        );
        expect(
            screen.getByText(
                `Last test today at ${new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(new Date('2026-10-03T09:00:00Z'))}`,
            ),
        ).not.toBeNull();
    });

    it('shows nothing before a first test', () => {
        const { container } = renderWithProviders(
            <ConnectionTestResult result={null} lastTest={null} />,
        );

        expect(container.textContent).toBe('');
    });
});
