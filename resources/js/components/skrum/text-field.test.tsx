import { fireEvent, render, screen } from '@testing-library/react';
import { Mail } from 'lucide-react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextareaField, TextField } from '@/components/skrum/text-field';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';

describe('TextField', () => {
    it('links the label to the input', () => {
        render(<TextField label="Session name" />);

        expect(screen.getByLabelText('Session name')).toBeTruthy();
    });

    it('describes the input with the help text', () => {
        render(<TextField label="Name" description="Visible to all." />);

        const input = screen.getByLabelText('Name');
        const help = screen.getByText('Visible to all.');

        expect(input.getAttribute('aria-describedby')).toBe(help.id);
        expect(input.getAttribute('aria-invalid')).toBeNull();
    });

    it('flags the input invalid and shows the error instead of the help', () => {
        render(
            <TextField
                label="Email"
                description="Help text"
                error="Incomplete address."
            />,
        );

        const input = screen.getByLabelText('Email');
        const error = screen.getByText('Incomplete address.');

        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(input.getAttribute('aria-describedby')).toBe(error.id);
        expect(screen.queryByText('Help text')).toBeNull();
    });

    it('keeps a caller aria-describedby alongside the message', () => {
        render(
            <TextField label="Email" aria-describedby="extra" error="Bad." />,
        );

        expect(
            screen.getByLabelText('Email').getAttribute('aria-describedby'),
        ).toMatch(/^extra /);
    });

    it('uses the id given by the caller', () => {
        render(<TextField label="Code" id="code" />);

        expect(screen.getByLabelText('Code').id).toBe('code');
    });

    it('renders the prefix icon and the suffix', () => {
        const { container } = render(
            <TextField
                label="Email"
                icon={Mail}
                suffix={<button aria-label="Copy">c</button>}
            />,
        );

        expect(container.querySelector('svg')).not.toBeNull();
        expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    });

    it('disables the input', () => {
        render(<TextField label="Link" disabled />);

        expect(
            (screen.getByLabelText('Link') as HTMLInputElement).disabled,
        ).toBe(true);
    });
});

describe('TextareaField', () => {
    it('shows a counter against the default limit of 280', () => {
        render(<TextareaField label="Card" />);

        expect(screen.getByText('0/280')).toBeTruthy();
    });

    it('counts typed characters in uncontrolled mode', () => {
        render(<TextareaField label="Card" />);

        fireEvent.change(screen.getByLabelText('Card'), {
            target: { value: 'hello' },
        });

        expect(screen.getByText('5/280')).toBeTruthy();
    });

    it('counts from the controlled value', () => {
        render(<TextareaField label="Card" value="abc" onChange={() => {}} />);

        expect(screen.getByText('3/280')).toBeTruthy();
    });

    it('warns and announces politely from 90 percent of the limit', () => {
        render(<TextareaField label="Card" maxLength={10} />);
        const counter = screen.getByText('0/10');

        expect(counter.hasAttribute('data-near')).toBe(false);
        expect(counter.getAttribute('aria-live')).toBe('off');

        fireEvent.change(screen.getByLabelText('Card'), {
            target: { value: '123456789' },
        });

        expect(counter.hasAttribute('data-near')).toBe(true);
        expect(counter.getAttribute('aria-live')).toBe('polite');
    });

    it('honours a custom warnAt', () => {
        render(<TextareaField label="Card" maxLength={100} warnAt={5} />);

        fireEvent.change(screen.getByLabelText('Card'), {
            target: { value: '12345' },
        });

        expect(screen.getByText('5/100').hasAttribute('data-near')).toBe(true);
    });

    it('does not block typing past the limit', () => {
        render(<TextareaField label="Card" maxLength={3} />);

        fireEvent.change(screen.getByLabelText('Card'), {
            target: { value: '12345' },
        });

        expect(screen.getByText('5/3')).toBeTruthy();
    });

    it('drops the counter when the limit is null', () => {
        const { container } = render(
            <TextareaField label="Card" maxLength={null} />,
        );

        expect(
            container.querySelector('[data-slot="field-counter"]'),
        ).toBeNull();
    });

    it('submits on Ctrl+Enter and Cmd+Enter only', () => {
        const onSubmitShortcut = vi.fn();
        render(
            <TextareaField label="Card" onSubmitShortcut={onSubmitShortcut} />,
        );
        const area = screen.getByLabelText('Card');

        fireEvent.keyDown(area, { key: 'Enter' });
        expect(onSubmitShortcut).not.toHaveBeenCalled();

        fireEvent.keyDown(area, { key: 'Enter', ctrlKey: true });
        fireEvent.keyDown(area, { key: 'Enter', metaKey: true });
        expect(onSubmitShortcut).toHaveBeenCalledTimes(2);
    });

    it('listens for Escape on the window only while the field has focus', () => {
        const added = vi.spyOn(window, 'addEventListener');
        const removed = vi.spyOn(window, 'removeEventListener');
        const keydownCalls = (spy: typeof added | typeof removed): number =>
            spy.mock.calls.filter(
                ([type, , capture]) => type === 'keydown' && capture === true,
            ).length;

        render(<TextareaField label="Card" onCancel={vi.fn()} />);
        const field = screen.getByLabelText('Card');

        expect(keydownCalls(added)).toBe(0);

        fireEvent.focusIn(field);

        expect(keydownCalls(added)).toBe(1);
        expect(keydownCalls(removed)).toBe(0);

        fireEvent.focusOut(field);

        expect(keydownCalls(removed)).toBe(1);

        added.mockRestore();
        removed.mockRestore();
    });

    it('cancels on Escape', () => {
        const onCancel = vi.fn();
        render(<TextareaField label="Card" onCancel={onCancel} />);

        fireEvent.keyDown(screen.getByLabelText('Card'), { key: 'Escape' });

        expect(onCancel).toHaveBeenCalledOnce();
    });

    it('cancels the edit without closing the dialog that hosts it', async () => {
        const user = userEvent.setup();
        const onCancel = vi.fn();
        const onOpenChange = vi.fn();

        function Host({ editing }: { editing: boolean }) {
            return (
                <Dialog open onOpenChange={onOpenChange}>
                    <DialogContent>
                        <DialogTitle>Card</DialogTitle>
                        <DialogDescription>Edit the card</DialogDescription>
                        <TextareaField
                            label="Text"
                            onCancel={editing ? onCancel : undefined}
                        />
                    </DialogContent>
                </Dialog>
            );
        }

        const { rerender } = render(<Host editing />);

        await user.click(screen.getByLabelText('Text'));
        await user.keyboard('{Escape}');

        expect(onCancel).toHaveBeenCalledOnce();
        expect(onOpenChange).not.toHaveBeenCalled();

        rerender(<Host editing={false} />);
        await user.keyboard('{Escape}');

        expect(onCancel).toHaveBeenCalledOnce();
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('still calls the caller onChange and onKeyDown', () => {
        const onChange = vi.fn();
        const onKeyDown = vi.fn();
        render(
            <TextareaField
                label="Card"
                onChange={onChange}
                onKeyDown={onKeyDown}
            />,
        );
        const area = screen.getByLabelText('Card');

        fireEvent.change(area, { target: { value: 'x' } });
        fireEvent.keyDown(area, { key: 'a' });

        expect(onChange).toHaveBeenCalledOnce();
        expect(onKeyDown).toHaveBeenCalledOnce();
    });

    it('flags the textarea invalid and describes it with the error', () => {
        render(<TextareaField label="Card" error="Too short." />);

        const area = screen.getByLabelText('Card');

        expect(area.getAttribute('aria-invalid')).toBe('true');
        expect(area.getAttribute('aria-describedby')).toBe(
            screen.getByText('Too short.').id,
        );
    });
});
