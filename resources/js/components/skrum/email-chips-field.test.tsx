import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { EmailChipsField } from '@/components/skrum/email-chips-field';
import type { EmailChip } from '@/lib/invitations/email-chips';

function Harness({
    initial = [],
    errors = {},
}: {
    initial?: EmailChip[];
    errors?: Record<string, string>;
}) {
    const [chips, setChips] = useState<EmailChip[]>(initial);

    return (
        <EmailChipsField
            id="emails"
            label="Emails"
            chips={chips}
            onChange={setChips}
            errors={errors}
        />
    );
}

function chipValues(): string[] {
    return screen
        .queryAllByRole('listitem')
        .map((chip) => chip.getAttribute('data-value') ?? '');
}

describe('EmailChipsField', () => {
    it('turns typed text into a chip on Enter', () => {
        render(<Harness />);
        const input = screen.getByLabelText('Emails');

        fireEvent.change(input, { target: { value: 'Camille@Nordlys.io' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(chipValues()).toEqual(['camille@nordlys.io']);
        expect((input as HTMLInputElement).value).toBe('');
    });

    it('turns a pasted list into chips', () => {
        render(<Harness />);
        const input = screen.getByLabelText('Emails');

        fireEvent.paste(input, {
            clipboardData: { getData: () => 'a@x.io, b@x.io\nc@x.io' },
        });

        expect(chipValues()).toEqual(['a@x.io', 'b@x.io', 'c@x.io']);
    });

    it('turns typed text into a chip when the field is left', () => {
        render(<Harness />);
        const input = screen.getByLabelText('Emails');

        fireEvent.change(input, { target: { value: 'a@x.io' } });
        fireEvent.blur(input);

        expect(chipValues()).toEqual(['a@x.io']);
    });

    it('removes a chip with its button and with Backspace in an empty input', () => {
        render(
            <Harness
                initial={[
                    { value: 'a@x.io', isValid: true },
                    { value: 'b@x.io', isValid: true },
                    { value: 'c@x.io', isValid: true },
                ]}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Remove a@x.io' }));

        expect(chipValues()).toEqual(['b@x.io', 'c@x.io']);

        fireEvent.keyDown(screen.getByLabelText('Emails'), {
            key: 'Backspace',
        });

        expect(chipValues()).toEqual(['b@x.io']);
    });

    it('marks an incomplete address and says so under the field', () => {
        render(<Harness />);
        const input = screen.getByLabelText('Emails');

        fireEvent.change(input, { target: { value: 'malik@nordlys' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(screen.getByRole('listitem').getAttribute('aria-invalid')).toBe(
            'true',
        );
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(
            screen.getByText('“malik@nordlys” looks incomplete.'),
        ).toBeTruthy();
    });

    it('shows the server error of a chip under the field, naming its address', () => {
        render(
            <Harness
                initial={[
                    { value: 'a@x.io', isValid: true },
                    { value: 'b@x.io', isValid: true },
                ]}
                errors={{ 'emails.1': 'The address is not valid.' }}
            />,
        );

        const error = screen.getByText('The address is not valid.', {
            exact: false,
        });

        expect(error.textContent).toContain('b@x.io');
        expect(
            screen.getAllByRole('listitem')[1].getAttribute('aria-invalid'),
        ).toBe('true');
    });

    it('does not repeat an address the server message already names', () => {
        render(
            <Harness
                initial={[{ value: 'a@x.io', isValid: true }]}
                errors={{ 'emails.0': 'a@x.io is already in Atlas.' }}
            />,
        );

        expect(
            screen.getByText('a@x.io is already in Atlas.').textContent,
        ).toBe('a@x.io is already in Atlas.');
    });

    it('shows an error on the whole list', () => {
        render(<Harness errors={{ emails: 'Add at least one address.' }} />);

        expect(screen.getByText('Add at least one address.')).toBeTruthy();
    });
});
