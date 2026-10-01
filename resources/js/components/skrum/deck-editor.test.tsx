import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
    DeckEditor,
    checkDeckValue,
    normalizeDeckValue,
} from '@/components/skrum/deck-editor';
import type {
    DeckDraft,
    DeckEditorProps,
} from '@/components/skrum/deck-editor';
import { renderWithProviders } from '@/test/render';

const base: DeckDraft = {
    name: 'Mine',
    values: ['1', '2', '3'],
    unknownCard: true,
    breakCard: false,
};

function Harness({
    initial = base,
    ...props
}: { initial?: DeckDraft } & Partial<DeckEditorProps>) {
    const [value, setValue] = useState(initial);

    return (
        <>
            <DeckEditor
                value={value}
                onChange={(next) => {
                    setValue(next);
                    props.onChange?.(next);
                }}
                onSave={props.onSave ?? vi.fn()}
                onCancel={props.onCancel ?? vi.fn()}
                errors={props.errors}
                saving={props.saving}
            />
            <output data-testid="values">{value.values.join('|')}</output>
        </>
    );
}

function currentValues(): string {
    return screen.getByTestId('values').textContent ?? '';
}

function addField(): HTMLInputElement {
    return screen.getByRole('textbox', {
        name: 'Add a value',
    }) as HTMLInputElement;
}

function type(text: string, key = 'Enter') {
    fireEvent.change(addField(), { target: { value: text } });
    fireEvent.keyDown(addField(), { key });
}

describe('deck value rules', () => {
    it('normalizes 0.5 to a half and trims', () => {
        expect(normalizeDeckValue(' 0.5 ')).toBe('½');
        expect(normalizeDeckValue(' 8 ')).toBe('8');
    });

    it('rejects empty, long, special, duplicate and overflowing values', () => {
        expect(checkDeckValue('', [])?.kind).toBe('empty');
        expect(checkDeckValue('12345', [])?.kind).toBe('tooLong');
        expect(checkDeckValue('1234', [])).toBeNull();
        expect(checkDeckValue('☕', [])?.kind).toBe('special');
        expect(checkDeckValue('8', ['8'])).toEqual({
            kind: 'duplicate',
            value: '8',
        });
        expect(
            checkDeckValue(
                'x',
                Array.from({ length: 20 }, (_, i) => `${i}`),
            )?.kind,
        ).toBe('full');
    });
});

describe('DeckEditor', () => {
    it('adds a value on Enter and on comma, keeping the typed order', () => {
        renderWithProviders(<Harness />);

        type('5');
        type('8', ',');

        expect(currentValues()).toBe('1|2|3|5|8');
        expect(addField().value).toBe('');
    });

    it('turns 0.5 into ½ when adding', () => {
        renderWithProviders(<Harness />);

        type('0.5');

        expect(currentValues()).toBe('1|2|3|½');
    });

    it('refuses a duplicate with a message and keeps the draft', () => {
        renderWithProviders(<Harness />);

        type('2');

        expect(currentValues()).toBe('1|2|3');
        expect(screen.getByText('Duplicate value: 2')).toBeTruthy();
        expect(screen.getByRole('list').getAttribute('aria-invalid')).toBe(
            'true',
        );
    });

    it('refuses a value longer than 4 characters', () => {
        renderWithProviders(<Harness />);

        type('12345');

        expect(currentValues()).toBe('1|2|3');
        expect(
            screen.getByText('Values are 4 characters at most.'),
        ).toBeTruthy();
    });

    it('disables save and says why with fewer than 2 values', () => {
        renderWithProviders(<Harness initial={{ ...base, values: ['1'] }} />);

        const save = screen.getByRole('button', { name: 'Save deck' });

        expect((save as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText('Add at least 2 values.')).toBeTruthy();
    });

    it('shows the 2 values message and the destructive state after removing below the minimum', () => {
        renderWithProviders(
            <Harness initial={{ ...base, values: ['1', '2'] }} />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Remove 2' }));

        expect(currentValues()).toBe('1');
        expect(
            screen.getAllByText('Add at least 2 values.').length,
        ).toBeGreaterThan(0);
        expect(screen.getByRole('list').getAttribute('aria-invalid')).toBe(
            'true',
        );
    });

    it('calls onSave when valid and onCancel on cancel', () => {
        const onSave = vi.fn();
        const onCancel = vi.fn();

        renderWithProviders(<Harness onSave={onSave} onCancel={onCancel} />);

        fireEvent.click(screen.getByRole('button', { name: 'Save deck' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('disables save while saving', () => {
        renderWithProviders(<Harness saving />);

        expect(
            (
                screen.getByRole('button', {
                    name: 'Save deck',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('shows server errors on name and values', () => {
        renderWithProviders(
            <Harness
                errors={{ name: 'Name taken', values: 'Duplicate value: 8' }}
            />,
        );

        expect(screen.getByText('Name taken')).toBeTruthy();
        expect(screen.getByText('Duplicate value: 8')).toBeTruthy();
        expect(
            screen
                .getByRole('textbox', { name: 'Name' })
                .getAttribute('aria-invalid'),
        ).toBe('true');
    });

    it('selects then removes the last chip with two Backspace presses in the empty field', () => {
        renderWithProviders(<Harness />);

        fireEvent.keyDown(addField(), { key: 'Backspace' });
        expect(currentValues()).toBe('1|2|3');

        fireEvent.keyDown(addField(), { key: 'Backspace' });
        expect(currentValues()).toBe('1|2');
    });

    it('moves a chip with Alt+ArrowRight', () => {
        renderWithProviders(<Harness />);

        fireEvent.keyDown(screen.getByRole('button', { name: 'Value 1' }), {
            key: 'ArrowRight',
            altKey: true,
        });

        expect(currentValues()).toBe('2|1|3');
    });

    it('edits a chip with Enter and commits the new value', () => {
        renderWithProviders(<Harness />);

        fireEvent.keyDown(screen.getByRole('button', { name: 'Value 2' }), {
            key: 'Enter',
        });
        const input = screen.getByRole('textbox', { name: 'Edit value 2' });

        fireEvent.change(input, { target: { value: '5' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(currentValues()).toBe('1|5|3');
    });

    it('refuses to rename a chip into a duplicate', () => {
        renderWithProviders(<Harness />);

        fireEvent.doubleClick(screen.getByRole('button', { name: 'Value 2' }));
        const input = screen.getByRole('textbox', { name: 'Edit value 2' });

        fireEvent.change(input, { target: { value: '3' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(currentValues()).toBe('1|2|3');
        expect(screen.getByText('Duplicate value: 3')).toBeTruthy();
    });

    it('removes a special card from the preview when its switch is off', () => {
        renderWithProviders(<Harness />);

        expect(screen.getByText('Preview · 4 cards')).toBeTruthy();

        fireEvent.click(screen.getByRole('switch', { name: "I don't know" }));

        expect(screen.getByText('Preview · 3 cards')).toBeTruthy();
    });
});
