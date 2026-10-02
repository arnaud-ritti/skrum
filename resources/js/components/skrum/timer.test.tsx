import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Timer } from '@/components/skrum/timer';
import { renderWithProviders } from '@/test/render';

function state(container: HTMLElement): string | null | undefined {
    return container
        .querySelector('[data-slot="timer-pill"]')
        ?.getAttribute('data-state');
}

describe('Timer', () => {
    it('renders nothing without a timer and without controls', () => {
        const { container } = renderWithProviders(
            <Timer remainingSeconds={null} />,
        );

        expect(container.querySelector('[data-slot="timer"]')).toBeNull();
    });

    it('shows the remaining time in normal state', () => {
        const { container } = renderWithProviders(
            <Timer remainingSeconds={272} totalSeconds={360} />,
        );

        expect(screen.getByRole('timer').getAttribute('aria-label')).toBe(
            '5 minutes left',
        );
        expect(screen.getByRole('timer').textContent).toContain('4:32');
        expect(state(container)).toBe('normal');
        expect(
            container.querySelector('[data-slot="timer-ring"]'),
        ).not.toBeNull();
    });

    it('turns warning below one minute without animation', () => {
        const { container } = renderWithProviders(
            <Timer remainingSeconds={48} totalSeconds={360} />,
        );

        expect(state(container)).toBe('low');
        expect(screen.getByRole('timer').className).toContain(
            'bg-skrum-warning',
        );
        expect(screen.getByRole('timer').className).not.toContain('animate');
    });

    it('honours a custom low threshold', () => {
        const { container } = renderWithProviders(
            <Timer remainingSeconds={90} lowThresholdSeconds={120} />,
        );

        expect(state(container)).toBe('low');
    });

    it('shows done with nudge that reduced motion disables', () => {
        const { container } = renderWithProviders(
            <Timer remainingSeconds={0} />,
        );
        const pill = screen.getByRole('timer');

        expect(state(container)).toBe('done');
        expect(pill.className).toContain('bg-destructive');
        expect(pill.className).toContain('animate-nudge');
        expect(pill.className).toContain('motion-reduce:animate-none');
        expect(pill.getAttribute('aria-label')).toBe("Time's up!");
    });

    it('shows paused state with the frozen time', () => {
        const { container } = renderWithProviders(
            <Timer remainingSeconds={130} paused />,
        );

        expect(state(container)).toBe('paused');
        expect(screen.getByRole('timer').textContent).toContain('2:10');
        expect(screen.getByRole('timer').className).toContain(
            'text-muted-foreground',
        );
    });

    it('supports the lg size', () => {
        const { container } = renderWithProviders(
            <Timer remainingSeconds={425} totalSeconds={600} size="lg" />,
        );

        expect(
            container
                .querySelector('[data-slot="timer-ring"]')
                ?.getAttribute('class'),
        ).toContain('size-7');
    });

    it('keeps paused state when remaining changes while paused', () => {
        const onDone = vi.fn();
        const { container, rerender } = renderWithProviders(
            <Timer remainingSeconds={130} paused onDone={onDone} />,
        );

        rerender(<Timer remainingSeconds={0} paused onDone={onDone} />);

        expect(state(container)).toBe('paused');
        expect(onDone).not.toHaveBeenCalled();
    });

    it('fires onDone once when reaching zero', () => {
        const onDone = vi.fn();
        const { rerender } = renderWithProviders(
            <Timer remainingSeconds={2} onDone={onDone} />,
        );

        rerender(<Timer remainingSeconds={1} onDone={onDone} />);
        rerender(<Timer remainingSeconds={0} onDone={onDone} />);
        rerender(<Timer remainingSeconds={0} onDone={onDone} />);

        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('does not fire onDone when mounted already at zero', () => {
        const onDone = vi.fn();
        renderWithProviders(<Timer remainingSeconds={0} onDone={onDone} />);

        expect(onDone).not.toHaveBeenCalled();
    });

    it('announces only at 60 seconds, 10 seconds and zero', () => {
        const { rerender } = renderWithProviders(
            <Timer remainingSeconds={70} />,
        );
        const live = () => screen.getByRole('status').textContent;

        rerender(<Timer remainingSeconds={65} />);
        expect(live()).toBe('');
        rerender(<Timer remainingSeconds={60} />);
        expect(live()).toBe('1 minute left');
        rerender(<Timer remainingSeconds={10} />);
        expect(live()).toBe('10 seconds left');
        rerender(<Timer remainingSeconds={0} />);
        expect(live()).toBe("Time's up!");
    });

    it('renders pause, resume and add only when given', () => {
        const { rerender } = renderWithProviders(
            <Timer remainingSeconds={120} />,
        );

        expect(screen.queryByRole('button')).toBeNull();

        const onPause = vi.fn();
        const onAdd = vi.fn();
        rerender(
            <Timer remainingSeconds={120} onPause={onPause} onAdd={onAdd} />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Pause timer' }));
        fireEvent.click(screen.getByRole('button', { name: '1 min' }));

        expect(onPause).toHaveBeenCalledTimes(1);
        expect(onAdd).toHaveBeenCalledWith(60);

        const onResume = vi.fn();
        rerender(<Timer remainingSeconds={120} paused onResume={onResume} />);
        fireEvent.click(screen.getByRole('button', { name: 'Resume timer' }));

        expect(onResume).toHaveBeenCalledTimes(1);
    });

    it('toggles with T and adds a minute with +', () => {
        const onPause = vi.fn();
        const onResume = vi.fn();
        const onAdd = vi.fn();
        const { rerender } = renderWithProviders(
            <Timer
                remainingSeconds={120}
                onPause={onPause}
                onResume={onResume}
                onAdd={onAdd}
            />,
        );
        const button = screen.getByRole('button', { name: 'Pause timer' });

        fireEvent.keyDown(button, { key: 't' });
        fireEvent.keyDown(button, { key: '+' });

        expect(onPause).toHaveBeenCalledTimes(1);
        expect(onAdd).toHaveBeenCalledWith(60);

        rerender(
            <Timer
                remainingSeconds={120}
                paused
                onPause={onPause}
                onResume={onResume}
                onAdd={onAdd}
            />,
        );
        fireEvent.keyDown(
            screen.getByRole('button', { name: 'Resume timer' }),
            {
                key: 'T',
            },
        );

        expect(onResume).toHaveBeenCalledTimes(1);
    });

    it('starts a preset and stops from the menu', async () => {
        const user = userEvent.setup();
        const onStart = vi.fn();
        const onStop = vi.fn();
        renderWithProviders(
            <Timer remainingSeconds={30} onStart={onStart} onStop={onStop} />,
        );

        await user.click(screen.getByRole('button', { name: 'Timer' }));
        await user.click(screen.getByRole('menuitem', { name: '5 min' }));

        expect(onStart).toHaveBeenCalledWith(300);

        await user.click(screen.getByRole('button', { name: 'Timer' }));
        await user.click(screen.getByRole('menuitem', { name: 'Stop timer' }));

        expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('shows only the menu when no timer runs and disables stop', async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <Timer
                remainingSeconds={null}
                onStart={vi.fn()}
                onStop={vi.fn()}
            />,
        );

        expect(screen.queryByRole('timer')).toBeNull();

        await user.click(screen.getByRole('button', { name: 'Timer' }));

        expect(
            screen
                .getByRole('menuitem', { name: 'Stop timer' })
                .getAttribute('aria-disabled'),
        ).toBe('true');
    });
});
