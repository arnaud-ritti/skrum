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
              { id: 'health_check', label: 'Health check' },
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
        expect(items[0].textContent).toContain('Health check');
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

        expect(screen.getAllByText('Ended').length).toBeGreaterThan(0);
        expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
        expect(onPhaseChange).toHaveBeenLastCalledWith('discussing');
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

    it('shows Phase n/total with progress on mobile', () => {
        renderWithProviders(
            <PhaseStepper phases={steps()} current="voting" mobile />,
        );

        expect(screen.getByText('Phase 5/6')).toBeTruthy();
        expect(
            screen.getByRole('progressbar').getAttribute('aria-valuenow'),
        ).toBe('5');
    });
});
