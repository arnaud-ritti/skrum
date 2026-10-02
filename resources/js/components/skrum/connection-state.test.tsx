import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    ConnectionState,
    EditingIndicator,
} from '@/components/skrum/connection-state';

describe('ConnectionState', () => {
    it('renders nothing when connected', () => {
        const { container } = render(<ConnectionState status="connected" />);

        expect(container.firstChild).toBeNull();
    });

    it('keeps the data-realtime hook when connected', () => {
        const { container } = render(
            <ConnectionState status="connected" realtime="connected" />,
        );

        expect(
            container.querySelector('[data-realtime="connected"]'),
        ).not.toBeNull();
    });

    it('shows the attempt out of the maximum while reconnecting', () => {
        render(
            <ConnectionState
                status="reconnecting"
                attempt={2}
                maxAttempts={5}
            />,
        );

        expect(screen.getByRole('status').textContent).toContain(
            'Reconnecting… (2/5)',
        );
    });

    it('omits the attempt when it is unknown', () => {
        render(<ConnectionState status="reconnecting" />);

        expect(screen.getByRole('status').textContent).toBe('Reconnecting…');
    });

    it('says offline and reconnected in text', () => {
        const { rerender } = render(<ConnectionState status="offline" />);

        expect(screen.getByRole('status').textContent).toContain('Offline');

        rerender(<ConnectionState status="resynced" pendingChanges={3} />);

        expect(screen.getByRole('status').textContent).toContain('Reconnected');
        expect(screen.getByRole('status').textContent).toContain(
            '3 changes synced',
        );
    });

    it('exposes the realtime state on the rendered element', () => {
        render(<ConnectionState status="connecting" realtime="connecting" />);

        expect(screen.getByRole('status').getAttribute('data-realtime')).toBe(
            'connecting',
        );
    });

    it('banner is an alert with a retry button when offline', () => {
        const onRetry = vi.fn();
        render(
            <ConnectionState
                status="offline"
                variant="banner"
                pendingChanges={2}
                onRetry={onRetry}
            />,
        );

        expect(screen.getByRole('alert')).toBeTruthy();
        expect(screen.getByText(/2 changes waiting/)).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

        expect(onRetry).toHaveBeenCalledOnce();
    });

    it('banner has no retry button without a callback', () => {
        render(<ConnectionState status="offline" variant="banner" />);

        expect(screen.queryByRole('button')).toBeNull();
    });

    it('banner is not an alert while merely reconnecting', () => {
        render(<ConnectionState status="reconnecting" variant="banner" />);

        expect(screen.queryByRole('alert')).toBeNull();
        expect(screen.getByRole('status')).toBeTruthy();
    });

    it('overlay lets the board underneath receive pointer events', () => {
        const { container } = render(
            <ConnectionState status="reconnecting" variant="overlay" />,
        );

        expect(
            container.querySelector('[data-slot="connection-overlay"]')
                ?.className,
        ).toContain('pointer-events-none');
        expect(screen.getByRole('status')).toBeTruthy();
    });

    it('offers retry inside the pill when offline', () => {
        const onRetry = vi.fn();
        render(<ConnectionState status="offline" onRetry={onRetry} />);

        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

        expect(onRetry).toHaveBeenCalledOnce();
    });
    it('says the session expired as an alert, with a reload button', () => {
        const onReload = vi.fn();
        const onRetry = vi.fn();
        const { rerender } = render(
            <ConnectionState
                status="expired"
                variant="banner"
                onReload={onReload}
                onRetry={onRetry}
            />,
        );

        expect(screen.getByRole('alert').textContent).toContain(
            'Your session has expired.',
        );
        expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

        expect(onReload).toHaveBeenCalledOnce();

        rerender(<ConnectionState status="expired" />);

        expect(screen.getByRole('alert').textContent).toContain(
            'Your session has expired.',
        );
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('shows the given hint in place of the kept-locally sentence', () => {
        render(
            <ConnectionState
                status="reconnecting"
                variant="banner"
                hint="Live updates are paused."
            />,
        );

        expect(screen.getByRole('status').textContent).toContain(
            'Live updates are paused.',
        );
        expect(screen.queryByText(/kept locally/)).toBeNull();
    });
});

describe('EditingIndicator', () => {
    it('names who edits what, in text', () => {
        const user = { name: 'Inès Brun', initials: 'IB', presence: 9 };
        const { rerender } = render(
            <EditingIndicator user={user} target="card" />,
        );

        expect(screen.getByRole('status').textContent).toContain(
            'Inès Brun is editing the card',
        );

        rerender(<EditingIndicator user={user} target="column" />);

        expect(screen.getByRole('status').textContent).toContain(
            'Inès Brun is editing the column',
        );
    });

    it('survives an out-of-range presence slot', () => {
        render(
            <EditingIndicator
                user={{ name: 'Zed', initials: 'Z', presence: 99 }}
                target="group"
            />,
        );

        expect(screen.getByRole('status')).toBeTruthy();
    });
});
