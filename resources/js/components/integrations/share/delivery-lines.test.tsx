import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeliveryLines } from '@/components/integrations/share/delivery-lines';
import type { IntegrationDelivery } from '@/types';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

function delivery(
    overrides: Partial<IntegrationDelivery>,
): IntegrationDelivery {
    return {
        id: 'd1',
        channel: 'slack',
        kind: 'summary',
        status: 'sent',
        error: null,
        sentAt: null,
        createdAt: null,
        requestedBy: null,
        recipientCount: null,
        ...overrides,
    } as IntegrationDelivery;
}

afterEach(() => {
    vi.useRealTimers();
});

describe('DeliveryLines', () => {
    it('keeps an empty live region before the first delivery', () => {
        const { container } = render(<DeliveryLines deliveries={[]} />);

        expect(
            container.querySelector('[aria-live="polite"]')?.childElementCount,
        ).toBe(0);
        expect(screen.queryByRole('list')).toBeNull();
    });

    it('announces a queued, a sent and an emailed delivery', () => {
        render(
            <DeliveryLines
                deliveries={[
                    delivery({ id: 'a', status: 'queued' }),
                    delivery({ id: 'b', channel: 'telegram' }),
                    delivery({ id: 'c', channel: 'email', recipientCount: 1 }),
                    delivery({ id: 'd', channel: 'email', recipientCount: 4 }),
                ]}
            />,
        );

        expect(
            screen.getByRole('list').closest('[aria-live="polite"]'),
        ).not.toBeNull();
        expect(
            screen.getAllByRole('listitem').map((line) => line.textContent),
        ).toEqual([
            'Sending to Slack…',
            'Sent to Telegram',
            'Emailed to 1 person',
            'Emailed to 4 people',
        ]);
    });

    it('shows a failure in the destructive token, with the reason or a default one', () => {
        render(
            <DeliveryLines
                deliveries={[
                    delivery({
                        id: 'a',
                        status: 'failed',
                        error: 'Channel archived',
                    }),
                    delivery({ id: 'b', status: 'failed' }),
                ]}
            />,
        );

        const [named, unnamed] = screen.getAllByRole('listitem');

        expect(named.textContent).toBe('Slack: failed — Channel archived');
        expect(named.className).toBe('text-destructive');
        expect(unnamed.textContent).toBe(
            'Slack: failed — Something went wrong. Please try again.',
        );
    });

    it('moves the relative time on as the minutes pass', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-05T10:00:30Z'));

        render(
            <DeliveryLines
                deliveries={[delivery({ sentAt: '2026-10-05T10:00:00Z' })]}
            />,
        );

        const before = screen.getByRole('listitem').textContent;

        act(() => {
            vi.advanceTimersByTime(5 * 60_000);
        });

        expect(screen.getByRole('listitem').textContent).not.toBe(before);
    });

    it('adds the relative time once mounted', () => {
        render(
            <DeliveryLines
                deliveries={[delivery({ sentAt: new Date().toISOString() })]}
            />,
        );

        expect(screen.getByRole('listitem').textContent).toMatch(
            /^Sent to Slack · .+/,
        );
    });
});
