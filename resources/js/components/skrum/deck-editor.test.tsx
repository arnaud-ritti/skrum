import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
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
                nameRequired={props.nameRequired}
                withoutName={props.withoutName}
                saveLabel={props.saveLabel}
                idPrefix={props.idPrefix}
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

function valuesMessage(): string {
    return (
        document.getElementById(
            addField().getAttribute('aria-describedby') ?? '',
        )?.textContent ?? ''
    );
}

function announcement(): string {
    return (
        screen
            .getAllByRole('status')
            .find((region) => region.getAttribute('aria-live') === 'polite')
            ?.textContent ?? ''
    );
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
        expect(checkDeckValue('123456789', [])?.kind).toBe('tooLong');
        expect(checkDeckValue('12345678', [])).toBeNull();
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
        expect(valuesMessage()).toBe('Duplicate value: 2');
        expect(addField().getAttribute('aria-invalid')).toBe('true');
        expect(announcement()).toBe('Duplicate value: 2');
    });

    it('follows the server limit: 8 characters pass, 9 are refused', () => {
        renderWithProviders(<Harness />);

        type('12345678');
        type('123456789');

        expect(currentValues()).toBe('1|2|3|12345678');
        expect(valuesMessage()).toBe('Values are 8 characters at most.');
    });

    it('holds 20 values and refuses the 21st', () => {
        const twenty = Array.from({ length: 20 }, (_, i) => `v${i}`);

        renderWithProviders(<Harness initial={{ ...base, values: twenty }} />);

        type('extra');

        expect(currentValues()).toBe(twenty.join('|'));
        expect(valuesMessage()).toBe('A deck has 20 values at most.');
        expect(screen.getAllByRole('button', { name: /^Value / })).toHaveLength(
            20,
        );
    });

    it('has no name field and asks for no name when withoutName is set', () => {
        renderWithProviders(
            <Harness initial={{ ...base, name: '' }} withoutName />,
        );

        expect(screen.queryByLabelText('Name')).toBeNull();
        expect(screen.queryByLabelText('Name (optional)')).toBeNull();
        expect(
            screen.queryByText(
                'Give it a name to save this deck for the team.',
            ),
        ).toBeNull();
        expect(
            (
                screen.getByRole('button', {
                    name: 'Save deck',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(false);
    });

    it('requires a name unless nameRequired is false', () => {
        const onSave = vi.fn();
        const { unmount } = renderWithProviders(
            <Harness initial={{ ...base, name: '' }} />,
        );

        expect(
            (
                screen.getByRole('button', {
                    name: 'Save deck',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        unmount();

        renderWithProviders(
            <Harness
                initial={{ ...base, name: '' }}
                nameRequired={false}
                saveLabel="Use these cards"
                onSave={onSave}
            />,
        );

        expect(
            screen.getByRole('textbox', { name: 'Name (optional)' }),
        ).toBeTruthy();
        fireEvent.click(
            screen.getByRole('button', { name: 'Use these cards' }),
        );
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('caps the name at the 40 characters the server accepts', () => {
        renderWithProviders(<Harness />);

        expect(
            screen
                .getByRole('textbox', { name: 'Name' })
                .getAttribute('maxlength'),
        ).toBe('40');
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
        expect(addField().getAttribute('aria-invalid')).toBe('true');
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

    it('removes a chip emptied and confirmed with Enter', () => {
        renderWithProviders(<Harness />);

        fireEvent.keyDown(screen.getByRole('button', { name: 'Value 2' }), {
            key: 'Enter',
        });
        const input = screen.getByRole('textbox', { name: 'Edit value 2' });

        fireEvent.change(input, { target: { value: '  ' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(currentValues()).toBe('1|3');
        expect(
            screen.queryByRole('textbox', { name: /^Edit value/ }),
        ).toBeNull();
    });

    it('saves a valid chip edit when focus moves to another field and leaves focus there', async () => {
        renderWithProviders(<Harness />);

        fireEvent.keyDown(screen.getByRole('button', { name: 'Value 2' }), {
            key: 'Enter',
        });
        const input = screen.getByRole('textbox', { name: 'Edit value 2' });
        const name = screen.getByRole('textbox', { name: 'Name' });

        input.focus();
        fireEvent.change(input, { target: { value: '5' } });
        name.focus();

        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(currentValues()).toBe('1|5|3');
        expect(document.activeElement).toBe(name);
        expect(
            screen.queryByRole('textbox', { name: /^Edit value/ }),
        ).toBeNull();
    });

    it('restores the chip and says why when an invalid edit loses focus', async () => {
        renderWithProviders(<Harness />);

        fireEvent.doubleClick(screen.getByRole('button', { name: 'Value 2' }));
        const input = screen.getByRole('textbox', { name: 'Edit value 2' });

        input.focus();
        fireEvent.change(input, { target: { value: '3' } });
        addField().focus();

        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(currentValues()).toBe('1|2|3');
        expect(screen.getByRole('button', { name: 'Value 2' })).toBeTruthy();
        expect(screen.getByText('Duplicate value: 3')).toBeTruthy();
        expect(screen.getByText('Kept 2')).toBeTruthy();
        expect(document.activeElement).toBe(addField());
    });

    it('returns focus to the chip on Escape and drops the edit', async () => {
        renderWithProviders(<Harness />);

        fireEvent.keyDown(screen.getByRole('button', { name: 'Value 2' }), {
            key: 'Enter',
        });
        const input = screen.getByRole('textbox', { name: 'Edit value 2' });

        fireEvent.change(input, { target: { value: '9' } });
        fireEvent.keyDown(input, { key: 'Escape' });

        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(currentValues()).toBe('1|2|3');
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Value 2' }),
        );
    });

    it('keeps the host dialog open when Escape cancels a chip edit', async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();

        renderWithProviders(
            <Dialog open onOpenChange={onOpenChange}>
                <DialogContent>
                    <DialogTitle>Deck</DialogTitle>
                    <DialogDescription>Edit the deck</DialogDescription>
                    <Harness />
                </DialogContent>
            </Dialog>,
        );

        screen.getByRole('button', { name: 'Value 2' }).focus();
        await user.keyboard('{Enter}');
        await user.keyboard('9{Escape}');

        expect(onOpenChange).not.toHaveBeenCalled();
        expect(
            screen.queryByRole('textbox', { name: /Edit value/ }),
        ).toBeNull();
        expect(currentValues()).toBe('1|2|3');

        await new Promise((resolve) => requestAnimationFrame(resolve));
        await user.keyboard('{Escape}');

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('uses the ids of the game settings by default and a prefix when asked', () => {
        const { unmount } = renderWithProviders(<Harness />);

        expect(document.getElementById('deck-new-name')).toBe(
            screen.getByRole('textbox', { name: 'Name' }),
        );
        expect(document.getElementById('deck-new-cards')).toBe(
            screen.getByRole('textbox', { name: 'Add a value' }),
        );
        expect(
            document.getElementById('deck-new-unknown')?.getAttribute('role'),
        ).toBe('switch');
        expect(
            document
                .getElementById('deck-new-coffee')
                ?.getAttribute('aria-checked'),
        ).toBe('false');
        unmount();

        renderWithProviders(<Harness idPrefix="deck-edit" />);

        expect(document.getElementById('deck-new-name')).toBeNull();
        expect(document.getElementById('deck-edit-name')).not.toBeNull();
    });

    it('takes a filled or pasted comma list and keeps what it refuses', () => {
        renderWithProviders(<Harness />);
        const field = screen.getByRole('textbox', { name: 'Add a value' });

        fireEvent.change(field, { target: { value: '5, 8,13 , 2' } });

        expect(currentValues()).toBe('1|2|3|5|8|13');
        expect((field as HTMLInputElement).value).toBe('2');
        expect(valuesMessage()).toBe('Duplicate value: 2');
        expect(announcement()).toBe('Added 5, 8, 13. Duplicate value: 2');
    });

    it('refuses to rename a chip into a duplicate', () => {
        renderWithProviders(<Harness />);

        fireEvent.doubleClick(screen.getByRole('button', { name: 'Value 2' }));
        const input = screen.getByRole('textbox', { name: 'Edit value 2' });

        fireEvent.change(input, { target: { value: '3' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(currentValues()).toBe('1|2|3');
        expect(valuesMessage()).toBe('Duplicate value: 3');
        expect(announcement()).toBe('Duplicate value: 3');
    });

    it('removes a special card from the preview when its switch is off', () => {
        renderWithProviders(<Harness />);

        expect(screen.getByText('Preview · 4 cards')).toBeTruthy();

        fireEvent.click(screen.getByRole('switch', { name: "I don't know" }));

        expect(screen.getByText('Preview · 3 cards')).toBeTruthy();
    });
});
