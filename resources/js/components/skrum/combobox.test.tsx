import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Combobox, SelectField } from '@/components/skrum/combobox';
import type { SelectOption } from '@/components/skrum/combobox';
import { renderWithProviders } from '@/test/render';

beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.HTMLElement.prototype.hasPointerCapture = vi.fn();
    window.HTMLElement.prototype.releasePointerCapture = vi.fn();
    window.ResizeObserver ??= class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    };
});

const options: SelectOption[] = [
    { value: 'a', label: 'Alice Martin' },
    { value: 'b', label: 'Bastien Durand', disabled: true },
    { value: 'c', label: 'Camille Lefèvre', group: 'Design' },
];

function Controlled({
    onChange = vi.fn(),
}: {
    onChange?: (v: string) => void;
}) {
    const [value, setValue] = useState<string | undefined>();

    return (
        <SelectField
            label="Owner"
            options={options}
            value={value}
            onValueChange={(next) => {
                setValue(next);
                onChange(next);
            }}
            placeholder="Pick one"
        />
    );
}

describe('SelectField', () => {
    it('shows the placeholder, then the chosen option, and reports it', async () => {
        const onChange = vi.fn();
        renderWithProviders(<Controlled onChange={onChange} />);

        const trigger = screen.getByRole('combobox', { name: 'Owner' });
        expect(trigger.textContent).toContain('Pick one');

        fireEvent.keyDown(trigger, { key: 'ArrowDown' });
        const listbox = await screen.findByRole('listbox');
        expect(within(listbox).getAllByRole('option')).toHaveLength(3);
        expect(screen.getByText('Design')).toBeTruthy();

        fireEvent.click(screen.getByRole('option', { name: 'Alice Martin' }));

        expect(onChange).toHaveBeenCalledWith('a');
        await waitFor(() =>
            expect(trigger.textContent).toContain('Alice Martin'),
        );
    });

    it('marks disabled options and invalid state with the error message', async () => {
        renderWithProviders(
            <SelectField
                label="Owner"
                options={options}
                onValueChange={vi.fn()}
                error="Required"
            />,
        );

        const trigger = screen.getByRole('combobox', { name: 'Owner' });
        expect(trigger.getAttribute('aria-invalid')).toBe('true');
        expect(screen.getByText('Required')).toBeTruthy();

        fireEvent.keyDown(trigger, { key: 'ArrowDown' });
        const disabled = await screen.findByRole('option', {
            name: 'Bastien Durand',
        });
        expect(disabled.getAttribute('aria-disabled')).toBe('true');
    });

    it('does not open when disabled', () => {
        renderWithProviders(
            <SelectField
                label="Owner"
                options={options}
                onValueChange={vi.fn()}
                disabled
            />,
        );

        expect(
            (screen.getByRole('combobox') as HTMLButtonElement).disabled,
        ).toBe(true);
    });
});

describe('Combobox', () => {
    function setup(extra: Partial<React.ComponentProps<typeof Combobox>> = {}) {
        const onValueChange = vi.fn();

        renderWithProviders(
            <Combobox
                label="Assignee"
                options={options}
                onValueChange={onValueChange}
                searchPlaceholder="Search people"
                emptyText="Nobody found."
                {...extra}
            />,
        );

        return {
            onValueChange,
            trigger: screen.getByRole('combobox', { name: 'Assignee' }),
        };
    }

    it('opens, filters, highlights the match and selects with the keyboard', async () => {
        const user = userEvent.setup();
        const { onValueChange, trigger } = setup();

        await user.click(trigger);
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        const input = await screen.findByPlaceholderText('Search people');

        await user.type(input, 'cam');

        expect(screen.getAllByRole('option')).toHaveLength(1);
        expect(document.querySelector('mark')?.textContent).toBe('Cam');

        await user.keyboard('{Enter}');

        expect(onValueChange).toHaveBeenCalledWith('c');
        await waitFor(() =>
            expect(trigger.getAttribute('aria-expanded')).toBe('false'),
        );
    });

    it('names its popover dialog after the field label', async () => {
        const user = userEvent.setup();
        const { trigger } = setup();

        await user.click(trigger);

        const dialog = await screen.findByRole('dialog');

        expect(dialog.getAttribute('aria-label')).toBeTruthy();
        expect(dialog.getAttribute('aria-label')).toBe(
            document.querySelector(`label[for="${trigger.id}"]`)?.textContent,
        );
    });

    it('shows the empty text and offers to create the query', async () => {
        const user = userEvent.setup();
        const onCreate = vi.fn();
        const { trigger } = setup({ onCreate });

        await user.click(trigger);
        await user.type(
            await screen.findByPlaceholderText('Search people'),
            'zzz',
        );

        expect(screen.getByText('Nobody found.')).toBeTruthy();

        await user.click(screen.getByRole('button', { name: /Create “zzz”/ }));

        expect(onCreate).toHaveBeenCalledWith('zzz');
    });

    it('does not offer creation without onCreate', async () => {
        const user = userEvent.setup();
        const { trigger } = setup();

        await user.click(trigger);
        await user.type(
            await screen.findByPlaceholderText('Search people'),
            'zzz',
        );

        expect(screen.queryByRole('button', { name: /Create/ })).toBeNull();
    });

    it('uses renderOption and skips disabled options', async () => {
        const user = userEvent.setup();
        const { onValueChange, trigger } = setup({
            renderOption: (option) => <em>{`@${option.label}`}</em>,
        });

        await user.click(trigger);
        expect(await screen.findByText('@Alice Martin')).toBeTruthy();

        await user.click(screen.getByText('@Bastien Durand'));

        expect(onValueChange).not.toHaveBeenCalled();
    });

    it('closes on Escape and returns focus to the trigger', async () => {
        const user = userEvent.setup();
        const { trigger } = setup();

        await user.click(trigger);
        await screen.findByPlaceholderText('Search people');
        await user.keyboard('{Escape}');

        await waitFor(() =>
            expect(trigger.getAttribute('aria-expanded')).toBe('false'),
        );
        expect(document.activeElement).toBe(trigger);
    });

    it('reflects a value change from the parent', () => {
        const { rerender } = renderWithProviders(
            <Combobox
                label="Assignee"
                options={options}
                value="a"
                onValueChange={vi.fn()}
            />,
        );
        expect(screen.getByRole('combobox').textContent).toContain(
            'Alice Martin',
        );

        rerender(
            <Combobox
                label="Assignee"
                options={options}
                value="c"
                onValueChange={vi.fn()}
            />,
        );

        expect(screen.getByRole('combobox').textContent).toContain(
            'Camille Lefèvre',
        );
    });

    it('handles 200 options', async () => {
        const user = userEvent.setup();
        const many = Array.from({ length: 200 }, (_, i) => ({
            value: `v${i}`,
            label: `Member ${i}`,
        }));
        renderWithProviders(
            <Combobox
                label="Assignee"
                options={many}
                onValueChange={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('combobox'));

        expect(await screen.findAllByRole('option')).toHaveLength(200);
    });
});
