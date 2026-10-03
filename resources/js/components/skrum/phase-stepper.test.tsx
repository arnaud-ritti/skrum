import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhaseStepper } from '@/components/skrum/phase-stepper';
import type { PhaseStep } from '@/components/skrum/phase-stepper';
import { renderWithProviders } from '@/test/render';

function steps(optional = true): PhaseStep[] {
    const base: PhaseStep[] = [
        { id: 'writing', label: 'Writing' },
        { id: 'grouping', label: 'Grouping' },
        { id: 'voting', label: 'Voting' },
        { id: 'discussing', label: 'Discussing' },
    ];

    return optional
        ? [
              { id: 'check_in', label: 'Check-in' },
              { id: 'icebreaker', label: 'Icebreaker' },
              ...base,
          ]
        : base;
}

describe('PhaseStepper', () => {
    it('renders phases in the given order with the current one marked', () => {
        renderWithProviders(<PhaseStepper phases={steps()} current="voting" />);

        const items = screen.getAllByRole('listitem').filter((item) => {
            return item.getAttribute('data-slot') === 'phase-step';
        });

        expect(items).toHaveLength(6);
        expect(items[0].textContent).toContain('Check-in');
        expect(items[4].querySelector('[aria-current="step"]')).not.toBeNull();
        expect(items[4].getAttribute('data-state')).toBe('current');
        expect(items[1].getAttribute('data-state')).toBe('done');
        expect(items[5].getAttribute('data-state')).toBe('upcoming');
    });

    it('works without optional phases and with a single phase or 200 phases', () => {
        const { rerender } = renderWithProviders(
            <PhaseStepper phases={steps(false)} current="writing" />,
        );

        expect(
            document.querySelectorAll('[data-slot="phase-step"]'),
        ).toHaveLength(4);

        rerender(
            <PhaseStepper
                phases={[{ id: 'writing', label: 'Writing' }]}
                current="writing"
            />,
        );
        expect(
            document.querySelectorAll('[data-slot="phase-step"]'),
        ).toHaveLength(1);

        const many = Array.from({ length: 200 }, (_, index) => ({
            id: `p${index}`,
            label: `Phase ${index}`,
        }));
        rerender(<PhaseStepper phases={many} current="p10" />);
        expect(
            document.querySelectorAll('[data-slot="phase-step"]'),
        ).toHaveLength(200);
    });

    it('is read only for a participant and names the leader', () => {
        renderWithProviders(
            <PhaseStepper
                phases={steps(false)}
                current="grouping"
                leaderName="Camille"
                onPhaseChange={vi.fn()}
            />,
        );

        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.getByText('Camille leads the phases')).toBeTruthy();
    });

    it('moves to the neighbour phases with Previous and Next', () => {
        const onPhaseChange = vi.fn();

        renderWithProviders(
            <PhaseStepper
                phases={steps(false)}
                current="grouping"
                interactive
                onPhaseChange={onPhaseChange}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));

        expect(onPhaseChange).toHaveBeenNthCalledWith(1, 'writing');
        expect(onPhaseChange).toHaveBeenNthCalledWith(2, 'voting');
    });

    it('only enables the neighbour steps', () => {
        const onPhaseChange = vi.fn();

        renderWithProviders(
            <PhaseStepper
                phases={steps(false)}
                current="grouping"
                interactive
                onPhaseChange={onPhaseChange}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /^Discussing/ }));
        expect(onPhaseChange).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: /^Voting/ }));
        expect(onPhaseChange).toHaveBeenCalledWith('voting');
    });

    it('offers Complete on the last phase and Reopen once ended', () => {
        const onPhaseChange = vi.fn();
        const { rerender } = renderWithProviders(
            <PhaseStepper
                phases={steps(false)}
                current="discussing"
                interactive
                onPhaseChange={onPhaseChange}
            />,
        );

        expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Complete' }));
        expect(onPhaseChange).toHaveBeenCalledWith('completed');

        rerender(
            <PhaseStepper
                phases={steps(false)}
                current="completed"
                interactive
                onPhaseChange={onPhaseChange}
            />,
        );

        expect(
            document.querySelector('[aria-current="step"]')?.textContent,
        ).toBe('Completed');
        expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
        expect(onPhaseChange).toHaveBeenLastCalledWith('discussing');
    });

    it('keeps every step as a ticked marker once ended: the labels are read, not shown', () => {
        renderWithProviders(
            <PhaseStepper phases={steps()} current="completed" />,
        );

        const items = Array.from(
            document.querySelectorAll('[data-slot="phase-step"]'),
        );

        expect(items).toHaveLength(6);

        for (const item of items) {
            expect(item.getAttribute('data-state')).toBe('done');
            expect(item.querySelector('.sr-only')?.className).not.toContain(
                'not-sr-only',
            );
        }

        expect(items[0].textContent).toContain('Check-in');
    });

    it('shows every label and the names of Previous and Next once the session header is wide enough for the full rail', () => {
        renderWithProviders(
            <PhaseStepper
                phases={steps()}
                current="voting"
                interactive
                onPhaseChange={vi.fn()}
            />,
        );

        const items = Array.from(
            document.querySelectorAll('[data-slot="phase-step"]'),
        );
        const hidden = items
            .filter((item) => item.getAttribute('data-state') !== 'current')
            .map((item) => item.querySelector('.sr-only')?.className ?? '');

        expect(hidden).toHaveLength(5);

        for (const className of hidden) {
            expect(className).toContain('@session-rail/session:not-sr-only');
        }

        for (const name of ['Previous', 'Next']) {
            expect(screen.getByRole('button', { name }).className).toContain(
                '@session-rail/session:w-auto',
            );
        }

        expect(
            document.querySelector('[data-slot="phase-stepper"]')?.innerHTML,
        ).not.toContain('@4xl/phases');
    });

    it('names the list Phases, as the board header did', () => {
        renderWithProviders(<PhaseStepper phases={steps()} current="voting" />);

        expect(screen.getByRole('list', { name: 'Phases' }).tagName).toBe('OL');
    });

    it('keeps focus on the forward button from Next to Complete to Reopen', () => {
        const onPhaseChange = vi.fn();
        const stepper = (current: string, disabled = false) => (
            <PhaseStepper
                phases={steps(false)}
                current={current}
                interactive
                disabled={disabled}
                onPhaseChange={onPhaseChange}
            />
        );
        const { rerender } = renderWithProviders(stepper('voting'));
        const forward = screen.getByRole('button', { name: 'Next' });

        forward.focus();
        fireEvent.click(forward);
        rerender(stepper('voting', true));

        expect(document.activeElement).toBe(forward);
        expect(forward.hasAttribute('disabled')).toBe(false);
        expect(forward.getAttribute('aria-disabled')).toBe('true');

        fireEvent.click(forward);

        expect(onPhaseChange).toHaveBeenCalledTimes(1);

        rerender(stepper('discussing'));

        expect(document.activeElement).toBe(forward);
        expect(screen.getByRole('button', { name: 'Complete' })).toBe(forward);

        rerender(stepper('completed'));

        expect(document.activeElement).toBe(forward);
        expect(screen.getByRole('button', { name: 'Reopen' })).toBe(forward);
    });

    it('keeps focus on Previous when the first phase is reached', () => {
        const onPhaseChange = vi.fn();
        const { rerender } = renderWithProviders(
            <PhaseStepper
                phases={steps(false)}
                current="grouping"
                interactive
                onPhaseChange={onPhaseChange}
            />,
        );
        const previous = screen.getByRole('button', { name: 'Previous' });

        previous.focus();
        fireEvent.click(previous);
        rerender(
            <PhaseStepper
                phases={steps(false)}
                current="writing"
                interactive
                onPhaseChange={onPhaseChange}
            />,
        );
        fireEvent.click(previous);

        expect(document.activeElement).toBe(previous);
        expect(previous.getAttribute('aria-disabled')).toBe('true');
        expect(onPhaseChange).toHaveBeenCalledTimes(1);
    });

    it('scrolls the rail to the active step on mount and when it changes', () => {
        const scrollTo = vi.fn();
        const original = Object.getOwnPropertyDescriptor(
            Element.prototype,
            'scrollTo',
        );

        Object.defineProperty(Element.prototype, 'scrollTo', {
            configurable: true,
            writable: true,
            value: scrollTo,
        });

        try {
            const { rerender } = renderWithProviders(
                <PhaseStepper phases={steps()} current="writing" />,
            );

            expect(scrollTo).toHaveBeenCalledTimes(1);

            rerender(<PhaseStepper phases={steps()} current="discussing" />);

            expect(scrollTo).toHaveBeenCalledTimes(2);
            expect(scrollTo.mock.instances[1]).toBe(
                document.querySelector('[data-slot="phase-scroller"]'),
            );
        } finally {
            if (original) {
                Object.defineProperty(Element.prototype, 'scrollTo', original);
            } else {
                Reflect.deleteProperty(Element.prototype, 'scrollTo');
            }
        }
    });

    it('follows its container by default and keeps the forced modes', () => {
        const { container, rerender } = renderWithProviders(
            <PhaseStepper phases={steps()} current="voting" />,
        );
        const mode = () =>
            container
                .querySelector('[data-slot="phase-stepper"]')
                ?.getAttribute('data-mode');

        expect(mode()).toBe('auto');
        expect(screen.getByText('Phase 5/6')).toBeTruthy();
        expect(screen.getByRole('progressbar')).toBeTruthy();

        rerender(<PhaseStepper phases={steps()} current="voting" compact />);

        expect(mode()).toBe('compact');

        rerender(<PhaseStepper phases={steps()} current="voting" mobile />);

        expect(mode()).toBe('mobile');
        expect(
            container.querySelectorAll('[data-slot="phase-step"]'),
        ).toHaveLength(6);
    });

    it('reflects a phase change from props and announces it', () => {
        const { rerender } = renderWithProviders(
            <PhaseStepper phases={steps(false)} current="writing" />,
        );

        rerender(<PhaseStepper phases={steps(false)} current="voting" />);

        expect(screen.getByRole('status').textContent).toBe('Phase Voting');
    });

    it('roves focus with the arrow keys', () => {
        renderWithProviders(
            <PhaseStepper
                phases={steps(false)}
                current="grouping"
                interactive
                onPhaseChange={vi.fn()}
            />,
        );

        const grouping = screen.getByRole('button', { name: /^Grouping/ });
        const voting = screen.getByRole('button', { name: /^Voting/ });

        expect(grouping.getAttribute('tabindex')).toBe('0');
        expect(voting.getAttribute('tabindex')).toBe('-1');

        grouping.focus();
        fireEvent.keyDown(grouping, { key: 'ArrowRight' });

        expect(document.activeElement).toBe(voting);
        expect(voting.getAttribute('tabindex')).toBe('0');

        fireEvent.keyDown(voting, { key: 'ArrowLeft' });
        expect(document.activeElement).toBe(grouping);
    });

    it('keeps full names in compact mode and marks skipped phases', () => {
        renderWithProviders(
            <PhaseStepper
                phases={[
                    { id: 'writing', label: 'Writing', skipped: true },
                    { id: 'grouping', label: 'Grouping' },
                ]}
                current="grouping"
                compact
            />,
        );

        expect(screen.getByText('Writing')).toBeTruthy();
        expect(screen.getByText(', skipped')).toBeTruthy();
    });

    it('is the compact rail on mobile: a marker per step, the label of the current one, no count and no progress bar', () => {
        const { container } = renderWithProviders(
            <PhaseStepper phases={steps()} current="voting" mobile />,
        );
        const rail = screen.getByRole('list', { name: 'Phases' });
        const shown = [...rail.querySelectorAll('[data-slot="phase-step"]')];

        expect(shown).toHaveLength(6);
        expect(shown.every((step) => !step.classList.contains('hidden'))).toBe(
            true,
        );
        expect(
            container.querySelectorAll('[data-slot="phase-marker"]'),
        ).toHaveLength(6);
        expect(
            container.querySelectorAll('[data-slot="phase-link"]'),
        ).toHaveLength(5);
        expect(
            rail.querySelector('[aria-current="step"] .truncate')?.className,
        ).not.toContain('sr-only');
        expect(screen.getByText('Writing').parentElement?.className).toContain(
            'sr-only',
        );
        expect(screen.queryByText('Phase 5/6')).toBeNull();
        expect(screen.queryByRole('progressbar')).toBeNull();
        expect(screen.getByRole('status').textContent).toBe('Phase Voting');
    });

    it('leaves the moves to the screen on mobile: the rail is read, and still names the leader', () => {
        const onPhaseChange = vi.fn();
        const { rerender } = renderWithProviders(
            <PhaseStepper
                phases={steps()}
                current="voting"
                mobile
                interactive
                leaderName="Camille"
                onPhaseChange={onPhaseChange}
            />,
        );

        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.queryByText('Camille leads the phases')).toBeNull();

        rerender(
            <PhaseStepper
                phases={steps()}
                current="completed"
                mobile
                interactive
                onPhaseChange={onPhaseChange}
            />,
        );

        expect(screen.queryByRole('button')).toBeNull();
        expect(
            document.querySelector('[aria-current="step"]')?.textContent,
        ).toContain('Completed');

        rerender(
            <PhaseStepper
                phases={steps()}
                current="voting"
                mobile
                leaderName="Camille"
            />,
        );

        expect(screen.getByText('Camille leads the phases')).toBeTruthy();
    });
});
