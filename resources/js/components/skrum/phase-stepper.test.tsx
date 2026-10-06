import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

    it('is a read-only rail of named steps in the steps variant: every label shown, the list and the count speak of steps', () => {
        renderWithProviders(
            <PhaseStepper
                variant="steps"
                phases={steps(false)}
                current="grouping"
            />,
        );

        const labels = Array.from(
            document.querySelectorAll('[data-slot="phase-step"]'),
        ).map((item) => item.querySelector('.truncate')?.textContent);

        expect(labels).toEqual(['Writing', 'Grouping', 'Voting', 'Discussing']);
        expect(
            document.querySelector(
                '[data-slot="phase-step"] .sr-only .truncate',
            ),
        ).toBeNull();
        expect(screen.getByRole('list', { name: 'Steps' })).toBeTruthy();
        expect(screen.getByText('Step 2/4')).toBeTruthy();
        expect(screen.getByRole('status').textContent).toBe('Step Grouping');
        expect(screen.queryByRole('button')).toBeNull();
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

    it('keeps the names of the other phases for assistive tech only in compact mode and marks skipped phases', () => {
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

        expect(screen.getByText('Writing').closest('.sr-only')).not.toBeNull();
        expect(screen.getByText('Grouping').closest('.sr-only')).toBeNull();
        expect(screen.getByText(', skipped')).toBeTruthy();
    });

    it('shows the name of every phase in the labelled state', () => {
        renderWithProviders(
            <PhaseStepper phases={steps()} current="writing" labelled />,
        );

        expect(screen.getByText('Voting').closest('.sr-only')).toBeNull();
        expect(screen.getByText('Icebreaker').closest('.sr-only')).toBeNull();
    });

    it('writes "Next phase" on the compact forward button of the facilitator', () => {
        const { container } = renderWithProviders(
            <PhaseStepper
                phases={steps()}
                current="voting"
                compact
                interactive
                onPhaseChange={() => {}}
            />,
        );
        const forward = container.querySelector(
            '[data-slot="phase-forward"]',
        ) as HTMLElement;

        expect(forward.textContent).toBe('Next phase');
        expect(screen.getByText('Next phase').closest('.sr-only')).toBeNull();
    });

    it('keeps one step tabbable when the focused phase leaves the list', () => {
        const onPhaseChange = vi.fn();
        const { rerender } = renderWithProviders(
            <PhaseStepper
                phases={steps()}
                current="voting"
                interactive
                onPhaseChange={onPhaseChange}
            />,
        );

        screen.getByRole('button', { name: /^Icebreaker/ }).focus();

        rerender(
            <PhaseStepper
                phases={steps(false)}
                current="voting"
                interactive
                onPhaseChange={onPhaseChange}
            />,
        );

        expect(
            screen
                .getByRole('button', { name: /^Voting/ })
                .getAttribute('tabindex'),
        ).toBe('0');
    });

    it('offers no move and no count when the current phase is unknown', () => {
        const onPhaseChange = vi.fn();
        const { container } = renderWithProviders(
            <PhaseStepper
                phases={steps(false)}
                current="gone"
                interactive
                onPhaseChange={onPhaseChange}
            />,
        );

        fireEvent.click(screen.getByText('Writing'));

        expect(onPhaseChange).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
        expect(container.querySelector('[data-slot="phase-count"]')).toBeNull();
    });

    it('reads the position as the value of the progress bar', () => {
        renderWithProviders(<PhaseStepper phases={steps()} current="voting" />);

        expect(
            screen.getByRole('progressbar').getAttribute('aria-valuetext'),
        ).toBe('Phase 5/6');
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

describe('PhaseStepper in the session bar', () => {
    const bar = (current = 'voting', interactive = true) => (
        <PhaseStepper
            bar
            phases={steps()}
            current={current}
            interactive={interactive}
            onPhaseChange={vi.fn()}
        />
    );
    const others = () =>
        [...document.querySelectorAll('[data-slot="phase-step"]')].filter(
            (step) => step.getAttribute('data-state') !== 'current',
        );

    it("names only the current step in the middle form and keeps the others' names accessible", () => {
        renderWithProviders(bar());

        const current = document.querySelector(
            '[data-slot="phase-step"][data-state="current"]',
        );

        expect(current?.querySelector('.sr-only .truncate')).toBeNull();
        expect(current?.textContent).toContain('Voting');
        expect(others()).toHaveLength(5);

        for (const step of others()) {
            const name = step.querySelector('.sr-only');

            expect(name?.className).toContain(
                '@session-rail/session:not-sr-only',
            );
            expect(
                step.querySelector('[data-slot="phase-marker"]'),
            ).not.toBeNull();
        }

        expect(screen.getByRole('button', { name: /^Grouping/ })).toBeTruthy();
    });

    it('says the name of a numbered step in a tooltip', async () => {
        renderWithProviders(bar());

        await userEvent
            .setup()
            .hover(screen.getByRole('button', { name: /^Grouping/ }));

        expect((await screen.findByRole('tooltip')).textContent).toBe(
            'Grouping',
        );
    });

    it('shows the words of Previous and Next from a wider step than the names of the steps', () => {
        renderWithProviders(bar());

        for (const name of ['Previous', 'Next']) {
            const button = screen.getByRole('button', { name });

            expect(button.className).toContain('@session-words/session:w-auto');
            expect(button.querySelector('.sr-only')?.className).toContain(
                '@session-words/session:not-sr-only',
            );
        }
    });

    it('offers the compact phase control with the current phase and opens the list of phases', async () => {
        const onPhaseChange = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(
            <PhaseStepper
                bar
                phases={steps()}
                current="voting"
                interactive
                onPhaseChange={onPhaseChange}
            />,
        );

        const count = screen.getByRole('button', { name: 'Phase 5/6' });

        expect(count.textContent).toBe('5/6');
        expect(count.getAttribute('data-slot')).toBe('phase-count');

        await user.click(count);

        const entries = screen.getAllByRole('menuitemradio');

        expect(entries.map((entry) => entry.textContent)).toEqual([
            '1Check-in',
            '2Icebreaker',
            '3Writing',
            '4Grouping',
            '5Voting',
            '6Discussing',
        ]);
        expect(
            entries.map((entry) => entry.getAttribute('aria-checked')),
        ).toEqual(['false', 'false', 'false', 'false', 'true', 'false']);
        expect(entries[0].hasAttribute('data-disabled')).toBe(true);
        expect(entries[5].hasAttribute('data-disabled')).toBe(false);

        await user.click(entries[5]);

        expect(onPhaseChange).toHaveBeenCalledExactlyOnceWith('discussing');
    });

    it('shows a participant the place of the phase, with no control', () => {
        renderWithProviders(bar('voting', false));

        const count = document.querySelector('[data-slot="phase-count"]');

        expect(count?.tagName).toBe('SPAN');
        expect(count?.textContent).toBe('5/6');
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('keeps one focusable set of phase controls', () => {
        renderWithProviders(bar());

        const count = screen.getByRole('button', { name: 'Phase 5/6' });

        expect(count.className).toContain('@7xl/session:hidden');

        for (const step of others()) {
            expect(step.className).toContain('hidden');
            expect(step.className).toContain('@7xl/session:flex');
        }

        expect(
            screen.getAllByRole('button', { name: 'Previous' }),
        ).toHaveLength(1);
        expect(screen.getAllByRole('button', { name: 'Next' })).toHaveLength(1);
        expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(
            1,
        );
    });

    it('leaves the place alone on a phone: the name and the arrows come back with the room', () => {
        renderWithProviders(bar());

        const current = document.querySelector(
            '[data-slot="phase-step"][data-state="current"]',
        );

        expect(current?.className).toContain('hidden');
        expect(current?.className).toContain('@4xl/session:flex');

        for (const name of ['Previous', 'Next']) {
            const button = screen.getByRole('button', { name });

            expect(button.className).toContain('hidden');
            expect(button.className).toContain('@3xl/session:inline-flex');
        }
    });

    it('is sized by its content, with no container and no scrolling area of its own', () => {
        const { container } = renderWithProviders(bar());
        const root = container.querySelector('[data-slot="phase-stepper"]');

        expect(root?.getAttribute('data-mode')).toBe('bar');
        expect(root?.className).not.toContain('@container');
        expect(
            container.querySelector('[class*="overflow-x-auto"]'),
        ).toBeNull();
        expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('keeps the ticked markers, the badge and Reopen once ended', () => {
        const onPhaseChange = vi.fn();

        renderWithProviders(
            <PhaseStepper
                bar
                phases={steps(false)}
                current="completed"
                interactive
                onPhaseChange={onPhaseChange}
            />,
        );

        expect(
            document.querySelector('[aria-current="step"]')?.textContent,
        ).toBe('Completed');
        expect(document.querySelector('[data-slot="phase-count"]')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));

        expect(onPhaseChange).toHaveBeenCalledExactlyOnceWith('discussing');
    });
});
