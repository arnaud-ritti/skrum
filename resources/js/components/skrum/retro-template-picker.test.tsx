import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    RetroTemplatePicker,
    columnColorClass,
} from '@/components/skrum/retro-template-picker';
import type {
    RetroTemplate,
    RetroTemplatePickerProps,
} from '@/components/skrum/retro-template-picker';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { renderWithProviders } from '@/test/render';

function makeTemplate(
    index: number,
    extra: Partial<RetroTemplate> = {},
): RetroTemplate {
    return {
        id: `tpl-${index}`,
        name: `Template ${index}`,
        description: `Description ${index}`,
        source: 'builtin',
        columns: [
            { title: 'Went well', color: 'moss', description: 'Good things' },
            { title: 'To improve', color: 'sky' },
        ],
        ...extra,
    };
}

const templates: RetroTemplate[] = [
    makeTemplate(1, { name: 'Start Stop Continue', isTeamDefault: true }),
    makeTemplate(2, { name: 'Glad Sad Mad' }),
    makeTemplate(3, { name: 'Sailboat' }),
    makeTemplate(4, { name: '4L' }),
    makeTemplate(5, {
        name: 'Ours',
        source: 'workspace',
        workspaceName: 'Nordlys',
        usageCount: 6,
        defaults: {
            votesPerPerson: 5,
            anonymous: true,
            timers: { writing: 300 },
        },
    }),
];

function renderPicker(props: Partial<RetroTemplatePickerProps> = {}) {
    const onValueChange = vi.fn();

    const result = renderWithProviders(
        <RetroTemplatePicker
            value="tpl-1"
            onValueChange={onValueChange}
            templates={templates}
            {...props}
        />,
    );

    return { onValueChange, ...result };
}

function mockGridOffsets(columns: number): void {
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
        configurable: true,
        get(this: HTMLElement) {
            const index = Array.from(
                this.parentElement?.children ?? [],
            ).indexOf(this);

            return Math.floor(index / columns) * 100;
        },
    });
}

afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'offsetTop');
    vi.useRealTimers();
});

describe('columnColorClass', () => {
    it('maps the eight colours to the col-* context class, and an unknown one to iris', () => {
        expect(columnColorClass('moss')).toBe('col-moss');
        expect(columnColorClass('coral')).toBe('col-coral');
        expect(columnColorClass('sky')).toBe('col-sky');
        expect(columnColorClass('sun')).toBe('col-sun');
        expect(columnColorClass('plum')).toBe('col-plum');
        expect(columnColorClass('iris')).toBe('col-iris');
        expect(columnColorClass('lagoon')).toBe('col-lagoon');
        expect(columnColorClass('apricot')).toBe('col-apricot');
        expect(columnColorClass('unknown')).toBe('col-iris');
        expect(columnColorClass('green')).toBe('col-iris');
    });
});

describe('RetroTemplatePicker', () => {
    it('lists built-in templates then the blank card, with the value checked', () => {
        renderPicker();

        const radios = within(screen.getByRole('radiogroup')).getAllByRole(
            'radio',
        );

        expect(radios).toHaveLength(5);
        expect(radios[4].textContent).toContain('Start from scratch');
        expect(
            screen
                .getByRole('radio', { name: 'Start Stop Continue' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            screen
                .getByRole('radio', { name: 'Sailboat' })
                .getAttribute('aria-checked'),
        ).toBe('false');
    });

    it('selects a card on click and reflects a new value prop', () => {
        const { onValueChange, rerender } = renderPicker();

        fireEvent.click(screen.getByRole('radio', { name: 'Sailboat' }));
        expect(onValueChange).toHaveBeenCalledWith('tpl-3');

        rerender(
            <RetroTemplatePicker
                value="tpl-3"
                onValueChange={onValueChange}
                templates={templates}
            />,
        );
        expect(
            screen
                .getByRole('radio', { name: 'Sailboat' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(screen.getByRole('heading', { name: 'Sailboat' })).toBeTruthy();
    });

    it('submits the value through a hidden input', () => {
        const { container } = renderPicker({
            name: 'template',
            value: 'tpl-2',
        });

        expect(
            (
                container.querySelector(
                    'input[type="hidden"][name="template"]',
                ) as HTMLInputElement
            ).value,
        ).toBe('tpl-2');
    });

    it('moves in two dimensions with the arrow keys', () => {
        mockGridOffsets(2);
        const { onValueChange } = renderPicker();
        const first = screen.getByRole('radio', {
            name: 'Start Stop Continue',
        });

        first.focus();
        fireEvent.keyDown(first, { key: 'ArrowDown' });
        expect(onValueChange).toHaveBeenLastCalledWith('tpl-3');
        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: 'Sailboat' }),
        );

        fireEvent.keyDown(document.activeElement as HTMLElement, {
            key: 'ArrowRight',
        });
        expect(onValueChange).toHaveBeenLastCalledWith('tpl-4');

        fireEvent.keyDown(document.activeElement as HTMLElement, {
            key: 'ArrowUp',
        });
        expect(onValueChange).toHaveBeenLastCalledWith('tpl-2');

        fireEvent.keyDown(document.activeElement as HTMLElement, {
            key: 'End',
        });
        expect(onValueChange).toHaveBeenLastCalledWith('custom');
    });

    it('uses a roving tab stop on the selected card', () => {
        renderPicker({ value: 'tpl-2' });

        expect(
            screen
                .getByRole('radio', { name: 'Glad Sad Mad' })
                .getAttribute('tabindex'),
        ).toBe('0');
        expect(
            screen
                .getByRole('radio', { name: 'Sailboat' })
                .getAttribute('tabindex'),
        ).toBe('-1');
    });

    it('calls onUse on Enter and from the detail button', () => {
        const onUse = vi.fn();

        renderPicker({ onUse });
        fireEvent.keyDown(screen.getByRole('radio', { name: 'Sailboat' }), {
            key: 'Enter',
        });
        expect(onUse).toHaveBeenLastCalledWith('tpl-3');

        fireEvent.click(
            screen.getByRole('button', { name: 'Use this template' }),
        );
        expect(onUse).toHaveBeenLastCalledWith('tpl-1');
    });

    it('does not render the use or duplicate buttons without callbacks', () => {
        renderPicker();

        expect(
            screen.queryByRole('button', { name: 'Use this template' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Duplicate and edit' }),
        ).toBeNull();
    });

    it('duplicates the selected template', () => {
        const onDuplicate = vi.fn();

        renderPicker({ onDuplicate });
        fireEvent.click(
            screen.getByRole('button', { name: 'Duplicate and edit' }),
        );
        expect(onDuplicate).toHaveBeenCalledWith('tpl-1');
    });

    it('does not re-register the Escape listener of the search on an unrelated render', () => {
        const { rerender } = renderPicker();

        fireEvent.change(
            screen.getByRole('searchbox', { name: 'Search templates' }),
            { target: { value: 'sail' } },
        );

        const added = vi.spyOn(window, 'addEventListener');

        rerender(
            <RetroTemplatePicker
                value="tpl-1"
                onValueChange={vi.fn()}
                templates={templates}
            />,
        );

        expect(
            added.mock.calls.filter(([type]) => type === 'keydown'),
        ).toHaveLength(0);

        added.mockRestore();
    });

    it('filters by search, keeps the blank card last, and clears with Escape', () => {
        renderPicker();
        const search = screen.getByRole('searchbox', {
            name: 'Search templates',
        });

        fireEvent.change(search, { target: { value: 'sail' } });
        const radios = within(screen.getByRole('radiogroup')).getAllByRole(
            'radio',
        );

        expect(radios).toHaveLength(2);
        expect(radios[1].textContent).toContain('Start from scratch');

        fireEvent.keyDown(search, { key: 'Escape' });
        expect((search as HTMLInputElement).value).toBe('');
        expect(
            within(screen.getByRole('radiogroup')).getAllByRole('radio'),
        ).toHaveLength(5);
    });

    it('shows the no-result state and recovers with Clear search or blank', () => {
        const { onValueChange } = renderPicker();

        fireEvent.change(
            screen.getByRole('searchbox', { name: 'Search templates' }),
            {
                target: { value: 'zzz' },
            },
        );
        expect(screen.getByText('No template matches "zzz"')).toBeTruthy();
        expect(screen.queryByRole('radiogroup')).toBeNull();

        fireEvent.click(
            screen.getByRole('button', { name: 'Start from scratch' }),
        );
        expect(onValueChange).toHaveBeenCalledWith('custom');

        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
        expect(screen.getByRole('radiogroup')).toBeTruthy();
    });

    it('focuses the search with the slash key but not while typing', () => {
        renderPicker();
        const search = screen.getByRole('searchbox', {
            name: 'Search templates',
        });

        fireEvent.keyDown(document.body, { key: '/' });
        expect(document.activeElement).toBe(search);

        fireEvent.keyDown(search, { key: '/' });
        expect(document.activeElement).toBe(search);
    });

    it('leaves the slash key alone when its shortcut is turned off', () => {
        renderWithProviders(
            <RetroTemplatePicker
                value="tpl-1"
                onValueChange={vi.fn()}
                templates={templates}
                shortcuts={false}
            />,
        );

        fireEvent.keyDown(document.body, { key: '/' });

        expect(document.activeElement).not.toBe(
            screen.getByRole('searchbox', { name: 'Search templates' }),
        );
    });

    it('does not focus the search when slash is typed in a dialog opened over the picker', () => {
        renderWithProviders(
            <>
                <RetroTemplatePicker
                    value="tpl-1"
                    onValueChange={vi.fn()}
                    templates={templates}
                />
                <Dialog open>
                    <DialogContent>
                        <DialogTitle>Other dialog</DialogTitle>
                        <button type="button">Inside</button>
                    </DialogContent>
                </Dialog>
            </>,
        );

        const inside = screen.getByRole('button', { name: 'Inside' });

        inside.focus();
        fireEvent.keyDown(inside, { key: '/' });

        expect(document.activeElement).toBe(inside);
    });

    it('clears the search with Escape without closing the host dialog, then lets Escape close it', async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();

        renderWithProviders(
            <Dialog open onOpenChange={onOpenChange}>
                <DialogContent>
                    <DialogTitle>Pick a template</DialogTitle>
                    <RetroTemplatePicker
                        value="tpl-1"
                        onValueChange={vi.fn()}
                        templates={templates}
                    />
                </DialogContent>
            </Dialog>,
        );

        const search = screen.getByRole('searchbox', {
            name: 'Search templates',
        });

        await user.click(search);
        await user.keyboard('sail');

        expect((search as HTMLInputElement).value).toBe('sail');

        await user.keyboard('{Escape}');

        expect((search as HTMLInputElement).value).toBe('');
        expect(onOpenChange).not.toHaveBeenCalled();

        await user.keyboard('{Escape}');

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('focuses the search with slash from inside its own host dialog', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <Dialog open>
                <DialogContent>
                    <DialogTitle>Pick a template</DialogTitle>
                    <RetroTemplatePicker
                        value="tpl-1"
                        onValueChange={vi.fn()}
                        templates={templates}
                    />
                </DialogContent>
            </Dialog>,
        );

        await act(async () => {
            await Promise.resolve();
        });

        screen.getAllByRole('radio')[0].focus();
        await user.keyboard('/');

        expect(document.activeElement).toBe(
            screen.getByRole('searchbox', { name: 'Search templates' }),
        );
    });

    it('sends the server id of the empty board and does not list that template twice', () => {
        const { onValueChange } = renderPicker({
            templates: [
                ...templates,
                makeTemplate(99, { id: 'custom', name: 'Custom' }),
            ],
        });
        const radios = within(screen.getByRole('radiogroup')).getAllByRole(
            'radio',
        );

        expect(radios).toHaveLength(5);
        expect(screen.queryByText('Custom')).toBeNull();

        fireEvent.click(radios[4]);

        expect(onValueChange).toHaveBeenLastCalledWith('custom');
    });

    it('takes another id for the empty board', () => {
        const { onValueChange } = renderPicker({ blankId: 'empty' });

        fireEvent.click(
            screen.getByRole('radio', { name: 'Start from scratch' }),
        );

        expect(onValueChange).toHaveBeenLastCalledWith('empty');
    });

    it('announces the result count after the debounce', () => {
        vi.useFakeTimers();
        renderPicker();

        fireEvent.change(
            screen.getByRole('searchbox', { name: 'Search templates' }),
            {
                target: { value: 'sail' },
            },
        );
        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(screen.getByRole('status').textContent).toBe(
            '1 templates found',
        );
    });

    it('names tabs with their counts and switches to workspace templates', () => {
        renderPicker();

        expect(screen.getByRole('tab', { name: /Built-in.*4/ })).toBeTruthy();
        fireEvent.mouseDown(
            screen.getByRole('tab', { name: /My workspace.*1/ }),
        );
        fireEvent.click(screen.getByRole('tab', { name: /My workspace.*1/ }));

        expect(screen.getByRole('radio', { name: 'Ours' })).toBeTruthy();
        expect(screen.queryByRole('radio', { name: 'Sailboat' })).toBeNull();
    });

    it('shows workspace badges and detail settings for a workspace template', () => {
        renderPicker({ value: 'tpl-5', tab: 'workspace' });

        expect(screen.getAllByText('Nordlys').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Used 6 times').length).toBeGreaterThan(0);
        expect(screen.getByText('5 votes per person')).toBeTruthy();
        expect(screen.getByText('Anonymous')).toBeTruthy();
        expect(screen.getByText('Writing 5 min')).toBeTruthy();
    });

    it('shows an empty workspace tab with a create action', () => {
        const onCreate = vi.fn();

        renderPicker({
            templates: templates.slice(0, 4),
            tab: 'workspace',
            onCreate,
        });
        expect(screen.getByText('No workspace template yet.')).toBeTruthy();
        fireEvent.click(
            screen.getByRole('button', { name: 'Create a template' }),
        );
        expect(onCreate).toHaveBeenCalled();
    });

    it('handles zero templates', () => {
        renderPicker({ templates: [], value: '' });

        expect(screen.getByText('No template available.')).toBeTruthy();
    });

    it('is busy while loading and renders no cards', () => {
        const { container } = renderPicker({ loading: true });

        expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
        expect(screen.getByText('Loading templates…')).toBeTruthy();
        expect(screen.queryByRole('radio')).toBeNull();
    });

    it('shows the blank detail when blank is selected', () => {
        renderPicker({ value: 'custom', onUse: vi.fn(), onDuplicate: vi.fn() });

        expect(
            screen.getByRole('heading', { name: 'Start from scratch' }),
        ).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Duplicate and edit' }),
        ).toBeNull();
    });

    it('renders 40 templates and a long name', () => {
        const many = Array.from({ length: 40 }, (_, i) =>
            makeTemplate(i, {
                name: `Rétrospective de fin de sprint très détaillée numéro ${i}`,
            }),
        );

        renderPicker({ templates: many, value: 'tpl-0' });
        expect(
            within(screen.getByRole('radiogroup')).getAllByRole('radio'),
        ).toHaveLength(41);
    });

    it('works controlled inside a stateful parent', () => {
        function Parent() {
            const [value, setValue] = useState('tpl-1');

            return (
                <RetroTemplatePicker
                    value={value}
                    onValueChange={setValue}
                    templates={templates}
                />
            );
        }

        renderWithProviders(<Parent />);
        fireEvent.click(screen.getByRole('radio', { name: '4L' }));
        expect(
            screen
                .getByRole('radio', { name: '4L' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });
});
