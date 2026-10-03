import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BuilderOptionsEditor } from '@/components/surveys/builder-options-editor';
import type { SurveyOptionPayload } from '@/lib/surveys/types';
import { renderWithProviders } from '@/test/render';

function options(count: number): SurveyOptionPayload[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `o-${index + 1}`,
        label: `Choice ${index + 1}`,
    }));
}

function Harness({
    initial,
    onChange = vi.fn(),
}: {
    initial: SurveyOptionPayload[];
    onChange?: (options: SurveyOptionPayload[]) => void;
}) {
    const [value, setValue] = useState(initial);

    return (
        <BuilderOptionsEditor
            options={value}
            onChange={(next) => {
                setValue(next);
                onChange(next);
            }}
        />
    );
}

function button(name: string): HTMLButtonElement {
    return screen.getByRole('button', { name }) as HTMLButtonElement;
}

describe('BuilderOptionsEditor', () => {
    it('renames an option', () => {
        const onChange = vi.fn();

        renderWithProviders(
            <Harness initial={options(2)} onChange={onChange} />,
        );
        fireEvent.change(screen.getByLabelText('Option 2'), {
            target: { value: 'Review' },
        });

        expect(onChange).toHaveBeenLastCalledWith([
            { id: 'o-1', label: 'Choice 1' },
            { id: 'o-2', label: 'Review' },
        ]);
    });

    it('cannot remove below two options', () => {
        renderWithProviders(<Harness initial={options(2)} />);

        expect(button('Remove option 1').disabled).toBe(true);
        expect(button('Remove option 2').disabled).toBe(true);
    });

    it('removes an option above two', () => {
        const onChange = vi.fn();

        renderWithProviders(
            <Harness initial={options(3)} onChange={onChange} />,
        );
        fireEvent.click(button('Remove option 2'));

        expect(onChange).toHaveBeenLastCalledWith([
            { id: 'o-1', label: 'Choice 1' },
            { id: 'o-3', label: 'Choice 3' },
        ]);
    });

    it('cannot add past ten options', () => {
        renderWithProviders(<Harness initial={options(10)} />);

        expect(button('Add option').disabled).toBe(true);
    });

    it('adds an empty option and focuses it', () => {
        renderWithProviders(<Harness initial={options(2)} />);

        fireEvent.click(button('Add option'));

        const added = screen.getByLabelText('Option 3') as HTMLInputElement;

        expect(added.value).toBe('');
        expect(document.activeElement).toBe(added);
    });

    it('adds an option on Enter in the last one only', () => {
        renderWithProviders(<Harness initial={options(2)} />);

        fireEvent.keyDown(screen.getByLabelText('Option 1'), { key: 'Enter' });

        expect(screen.queryByLabelText('Option 3')).toBeNull();

        fireEvent.keyDown(screen.getByLabelText('Option 2'), { key: 'Enter' });

        expect(document.activeElement).toBe(screen.getByLabelText('Option 3'));
    });
});
