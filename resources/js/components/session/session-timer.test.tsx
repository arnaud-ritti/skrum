import { act, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionTimer, TimeUpBadge } from '@/components/session/session-timer';
import { renderWithProviders } from '@/test/render';

vi.mock('sonner', () => ({ toast: vi.fn() }));

const start = new Date('2026-10-16T10:00:00Z');
const inTenSeconds = new Date(start.getTime() + 10_000).toISOString();

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
    vi.mocked(toast).mockClear();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('SessionTimer', () => {
    it('renders nothing without a timer and without controls', () => {
        const { container } = renderWithProviders(
            <SessionTimer endsAt={null} offset={0} />,
        );

        expect(container.querySelector('[role="timer"]')).toBeNull();
    });

    it('counts down, then names the pill "Time\'s up!" and toasts once', () => {
        renderWithProviders(<SessionTimer endsAt={inTenSeconds} offset={0} />);

        expect(screen.getByRole('timer').textContent).toContain('0:10');

        act(() => {
            vi.advanceTimersByTime(11_000);
        });

        expect(screen.getByRole('timer').getAttribute('aria-label')).toBe(
            "Time's up!",
        );
        expect(screen.getByRole('timer').getAttribute('data-state')).toBe(
            'done',
        );
        expect(toast).toHaveBeenCalledTimes(1);

        act(() => {
            vi.advanceTimersByTime(5_000);
        });

        expect(toast).toHaveBeenCalledTimes(1);
    });

    it('does not toast for a timer that had already ended when the page opened', () => {
        const past = new Date(start.getTime() - 5_000).toISOString();

        renderWithProviders(<SessionTimer endsAt={past} offset={0} />);

        expect(toast).not.toHaveBeenCalled();
    });

    it('does not toast for a timer that arrives already ended on a page open for a while', () => {
        const { rerender } = renderWithProviders(
            <SessionTimer endsAt={null} offset={0} />,
        );

        act(() => {
            vi.advanceTimersByTime(600_000);
        });

        const past = new Date(start.getTime() + 300_000).toISOString();

        rerender(<SessionTimer endsAt={past} offset={0} />);

        act(() => {
            vi.advanceTimersByTime(1_000);
        });

        expect(toast).not.toHaveBeenCalled();
    });

    it('beeps through one audio context, however many alarms ring', () => {
        const created = vi.fn();

        class FakeAudioContext {
            currentTime = 0;
            destination = {};

            constructor() {
                created();
            }

            createOscillator() {
                return {
                    frequency: { value: 0 },
                    connect: (node: unknown) => node,
                    start: () => {},
                    stop: () => {},
                };
            }

            createGain() {
                return {
                    gain: {
                        setValueAtTime: () => {},
                        exponentialRampToValueAtTime: () => {},
                    },
                    connect: (node: unknown) => node,
                };
            }

            resume() {
                return Promise.resolve();
            }
        }

        vi.stubGlobal('AudioContext', FakeAudioContext);

        const { rerender } = renderWithProviders(
            <SessionTimer endsAt={inTenSeconds} offset={0} />,
        );

        act(() => {
            vi.advanceTimersByTime(11_000);
        });

        rerender(
            <SessionTimer
                endsAt={new Date(start.getTime() + 20_000).toISOString()}
                offset={0}
            />,
        );

        act(() => {
            vi.advanceTimersByTime(11_000);
        });

        expect(toast).toHaveBeenCalledTimes(2);
        expect(created).toHaveBeenCalledTimes(1);

        vi.unstubAllGlobals();
    });

    it('does not toast with alarm off', () => {
        renderWithProviders(
            <SessionTimer endsAt={inTenSeconds} offset={0} alarm={false} />,
        );

        act(() => {
            vi.advanceTimersByTime(11_000);
        });

        expect(toast).not.toHaveBeenCalled();
    });

    it('offers the menu only to who can start or stop', () => {
        renderWithProviders(
            <SessionTimer
                endsAt={null}
                offset={0}
                onStart={() => {}}
                onStop={() => {}}
            />,
        );

        expect(screen.getByRole('button', { name: 'Timer' })).toBeTruthy();
    });

    it('shows "+2 min" only when it can extend and a timer runs', () => {
        const { rerender } = renderWithProviders(
            <SessionTimer
                endsAt={inTenSeconds}
                offset={0}
                onStart={() => {}}
                onStop={() => {}}
            />,
        );

        expect(screen.queryByRole('button', { name: '+2 min' })).toBeNull();

        rerender(
            <SessionTimer
                endsAt={inTenSeconds}
                offset={0}
                onStart={() => {}}
                onStop={() => {}}
                onExtend={() => {}}
            />,
        );

        expect(screen.getByRole('button', { name: '+2 min' })).toBeTruthy();
    });
});

describe('TimeUpBadge', () => {
    it('shows "Time\'s up" only at zero', () => {
        const { container } = renderWithProviders(
            <TimeUpBadge endsAt={inTenSeconds} offset={0} />,
        );

        expect(container.querySelector('[data-slot="badge"]')).toBeNull();

        act(() => {
            vi.advanceTimersByTime(11_000);
        });

        expect(
            container.querySelector('[data-slot="badge"]')?.textContent,
        ).toBe("Time's up");
    });
});
