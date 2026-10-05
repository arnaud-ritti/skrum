import { fireEvent, screen, within } from '@testing-library/react';
import { Eye, Lock, Trash2, ArrowRight } from 'lucide-react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { FacilitatorBar } from '@/components/skrum/facilitator-bar';
import type { FacilitatorAction } from '@/components/skrum/facilitator-bar';
import { renderWithProviders } from '@/test/render';

function makeActions(overrides: Partial<FacilitatorAction>[] = []) {
    const base: FacilitatorAction[] = [
        {
            id: 'reveal',
            label: 'Reveal cards',
            icon: Eye,
            onSelect: vi.fn(),
            kind: 'toggle',
            pressed: false,
            shortcut: 'R',
        },
        {
            id: 'lock',
            label: 'Lock board',
            icon: Lock,
            onSelect: vi.fn(),
            kind: 'toggle',
            pressed: true,
        },
        {
            id: 'clear',
            label: 'Clear board',
            icon: Trash2,
            onSelect: vi.fn(),
            tone: 'destructive',
        },
    ];

    return base.map((action, index) => ({ ...action, ...overrides[index] }));
}

const next: FacilitatorAction = {
    id: 'next',
    label: 'Grouping',
    icon: ArrowRight,
    onSelect: vi.fn(),
};

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        },
    );
});

describe('FacilitatorBar', () => {
    it('renders a toolbar with toggles reflecting pressed state', () => {
        renderWithProviders(<FacilitatorBar actions={makeActions()} />);

        expect(
            screen.getByRole('toolbar', { name: 'Facilitation tools' }),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('button', { name: 'Reveal cards' })
                .getAttribute('aria-pressed'),
        ).toBe('false');
        expect(
            screen
                .getByRole('button', { name: 'Lock board' })
                .getAttribute('aria-pressed'),
        ).toBe('true');
        expect(
            screen
                .getByRole('button', { name: 'Clear board' })
                .hasAttribute('aria-pressed'),
        ).toBe(false);
    });

    it('calls onSelect for actions and the primary button', () => {
        const actions = makeActions();
        const onNext = vi.fn();
        renderWithProviders(
            <FacilitatorBar
                actions={actions}
                primary={{ ...next, onSelect: onNext }}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Reveal cards' }));
        fireEvent.click(screen.getByRole('button', { name: 'Grouping' }));

        expect(actions[0].onSelect).toHaveBeenCalledTimes(1);
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('does not fire a disabled action and exposes its reason', () => {
        const actions = makeActions([
            { disabled: true, disabledReason: 'Nobody has written yet' },
        ]);
        renderWithProviders(<FacilitatorBar actions={actions} />);

        const button = screen.getByRole('button', { name: 'Reveal cards' });
        fireEvent.click(button);

        expect(actions[0].onSelect).not.toHaveBeenCalled();
        expect(button.getAttribute('aria-disabled')).toBe('true');
        expect(button.getAttribute('aria-describedby')).toBeTruthy();
        expect(
            document.getElementById(
                button.getAttribute('aria-describedby') ?? '',
            )?.textContent,
        ).toBe('Nobody has written yet');
    });

    it('shows destructive actions with icon and label', () => {
        renderWithProviders(<FacilitatorBar actions={makeActions()} />);

        const button = screen.getByRole('button', { name: 'Clear board' });

        expect(button.querySelector('svg')).not.toBeNull();
        expect(button.textContent).toContain('Clear board');
    });

    it('moves focus with arrow keys, wrapping, and keeps one tab stop', () => {
        renderWithProviders(
            <FacilitatorBar actions={makeActions()} primary={next} />,
        );

        const buttons = screen.getAllByRole('button');
        expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1);

        buttons[0].focus();
        fireEvent.keyDown(buttons[0], { key: 'ArrowRight' });
        expect(document.activeElement).toBe(buttons[1]);
        expect(buttons[1].tabIndex).toBe(0);
        expect(buttons[0].tabIndex).toBe(-1);

        fireEvent.keyDown(buttons[1], { key: 'End' });
        expect(document.activeElement).toBe(buttons[3]);

        fireEvent.keyDown(buttons[3], { key: 'ArrowRight' });
        expect(document.activeElement).toBe(buttons[0]);

        fireEvent.keyDown(buttons[0], { key: 'ArrowLeft' });
        expect(document.activeElement).toBe(buttons[3]);
    });

    it('renders start and end slots', () => {
        renderWithProviders(
            <FacilitatorBar
                actions={makeActions()}
                start={<span>05:00</span>}
                end={<span>Done</span>}
            />,
        );

        expect(screen.getByText('05:00')).toBeTruthy();
        expect(screen.getByText('Done')).toBeTruthy();
    });

    it('compact mode shows icon-only named buttons and a More menu', async () => {
        const actions = makeActions();
        renderWithProviders(<FacilitatorBar actions={actions} compact />);

        const reveal = screen.getByRole('button', { name: 'Reveal cards' });
        expect(reveal.textContent).toBe('');
        expect(
            screen.queryByRole('button', { name: 'Clear board' }),
        ).toBeNull();

        const more = screen.getByRole('button', { name: 'More' });
        fireEvent.keyDown(more, { key: 'Enter' });

        const item = await screen.findByRole('menuitem', {
            name: /Clear board/,
        });
        expect(within(item).getByText('Clear board')).toBeTruthy();
        fireEvent.click(item);

        expect(actions[2].onSelect).toHaveBeenCalledTimes(1);
    });

    it('compact mode sends a destructive action to the More menu wherever it sits', async () => {
        const [reveal, lock, clear] = makeActions();
        renderWithProviders(
            <FacilitatorBar actions={[clear, reveal, lock]} compact />,
        );

        expect(
            screen.queryByRole('button', { name: 'Clear board' }),
        ).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Reveal cards' }),
        ).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Lock board' })).toBeTruthy();

        fireEvent.keyDown(screen.getByRole('button', { name: 'More' }), {
            key: 'Enter',
        });

        expect(
            await screen.findByRole('menuitem', { name: /Clear board/ }),
        ).toBeTruthy();
    });

    it('keeps a disabled More item reachable by keyboard with its reason, and inert', async () => {
        const actions = makeActions([
            {},
            {},
            { disabled: true, disabledReason: 'Nothing to clear' },
        ]);
        renderWithProviders(<FacilitatorBar actions={actions} compact />);

        fireEvent.keyDown(screen.getByRole('button', { name: 'More' }), {
            key: 'Enter',
        });
        const item = await screen.findByRole('menuitem', {
            name: /Clear board/,
        });

        expect(item.getAttribute('aria-disabled')).toBe('true');
        expect(item.textContent).toContain('Nothing to clear');
        await vi.waitFor(() => expect(document.activeElement).toBe(item));

        fireEvent.click(item);

        expect(actions[2].onSelect).not.toHaveBeenCalled();
    });

    it('gives two bars with the same disabled action distinct reason ids and takes a custom name', () => {
        const actions = makeActions([
            { disabled: true, disabledReason: 'Nobody has written yet' },
        ]);
        renderWithProviders(
            <>
                <FacilitatorBar actions={actions} />
                <FacilitatorBar actions={actions} label="Facilitator tools" />
            </>,
        );

        const [first, second] = screen.getAllByRole('button', {
            name: 'Reveal cards',
        });

        expect(first.getAttribute('aria-describedby')).not.toBe(
            second.getAttribute('aria-describedby'),
        );
        expect(
            screen.getByRole('toolbar', { name: 'Facilitator tools' }),
        ).toBeTruthy();
    });

    it('updates when props change', () => {
        const actions = makeActions();
        const { rerender } = renderWithProviders(
            <FacilitatorBar actions={actions} />,
        );

        rerender(
            <FacilitatorBar
                actions={makeActions([{ pressed: true, label: 'Hide cards' }])}
            />,
        );

        expect(
            screen
                .getByRole('button', { name: 'Hide cards' })
                .getAttribute('aria-pressed'),
        ).toBe('true');
    });

    it('puts the trailing actions after the main button, in the arrow-key order', () => {
        const onSkip = vi.fn();
        renderWithProviders(
            <FacilitatorBar
                actions={makeActions().slice(0, 1)}
                primary={next}
                trailing={[
                    {
                        id: 'skip',
                        label: 'Next task',
                        icon: ArrowRight,
                        onSelect: onSkip,
                    },
                ]}
            />,
        );
        const names = within(screen.getByRole('toolbar'))
            .getAllByRole('button')
            .map((button) => button.getAttribute('aria-label'));

        expect(names).toEqual(['Reveal cards', 'Grouping', 'Next task']);

        const main = screen.getByRole('button', { name: 'Grouping' });
        const skip = screen.getByRole('button', { name: 'Next task' });

        main.focus();
        fireEvent.keyDown(main, { key: 'ArrowRight' });

        expect(document.activeElement).toBe(skip);
        expect(skip.textContent).toBe('Next task');

        fireEvent.click(skip);

        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('puts the icon of an action after its label when asked', () => {
        renderWithProviders(
            <FacilitatorBar
                actions={[]}
                primary={{ ...next, iconPosition: 'end' }}
            />,
        );

        const button = screen.getByRole('button', { name: 'Grouping' });

        expect(button.firstElementChild?.tagName).toBe('SPAN');
        expect(button.lastElementChild?.tagName.toLowerCase()).toBe('svg');
    });

    it('handles an empty action list', () => {
        renderWithProviders(<FacilitatorBar actions={[]} />);

        expect(screen.getByRole('toolbar')).toBeTruthy();
        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });
});
