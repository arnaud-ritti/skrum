import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ResendCode } from '@/components/skrum/resend-code';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from '@/components/ui/input-otp';

beforeAll(() => {
    document.elementFromPoint ??= () => null;
});

function Field({
    onComplete,
    ...rest
}: {
    onComplete?: (code: string) => void;
    error?: string;
    pasted?: boolean;
    disabled?: boolean;
}) {
    const [value, setValue] = useState('');

    return (
        <InputOTP
            maxLength={6}
            value={value}
            onChange={setValue}
            onComplete={onComplete}
            label="Verification code"
            {...rest}
        >
            <InputOTPGroup>
                {[0, 1, 2].map((index) => (
                    <InputOTPSlot key={index} index={index} />
                ))}
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
                {[3, 4, 5].map((index) => (
                    <InputOTPSlot key={index} index={index} />
                ))}
            </InputOTPGroup>
        </InputOTP>
    );
}

describe('InputOTP', () => {
    it('exposes one named input and hides the slots from assistive tech', () => {
        const { container } = render(<Field />);

        expect(
            screen.getByRole('textbox', { name: 'Verification code' }),
        ).toBeTruthy();
        const slots = container.querySelectorAll('[data-slot="input-otp-slot"]');
        expect(slots).toHaveLength(6);
        slots.forEach((slot) =>
            expect(slot.getAttribute('aria-hidden')).toBe('true'),
        );
    });

    it('calls onComplete with the sixth digit', () => {
        const onComplete = vi.fn();
        render(<Field onComplete={onComplete} />);
        const input = screen.getByRole('textbox');

        fireEvent.change(input, { target: { value: '12345' } });
        expect(onComplete).not.toHaveBeenCalled();
        fireEvent.change(input, { target: { value: '123456' } });
        expect(onComplete).toHaveBeenCalledWith('123456');
    });

    it('links the error with aria-describedby and aria-invalid', () => {
        render(<Field error="Invalid code. 2 attempts left." />);
        const input = screen.getByRole('textbox');
        const message = screen.getByText('Invalid code. 2 attempts left.');

        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(input.getAttribute('aria-describedby')).toContain(message.id);
    });

    it('announces a paste and disables the input while verifying', () => {
        render(<Field pasted disabled />);

        expect(screen.getByText('Code pasted from the clipboard')).toBeTruthy();
        expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(
            true,
        );
    });
});

describe('ResendCode', () => {
    it('shows a tabular countdown and a disabled button while waiting', () => {
        const onResend = vi.fn();
        render(
            <ResendCode
                remaining={42}
                onResend={onResend}
                locale="en"
            />,
        );
        const button = screen.getByRole('button', { name: 'Resend the code' });

        expect(screen.getByText('0:42')).toBeTruthy();
        expect(button.getAttribute('aria-disabled')).toBe('true');

        fireEvent.click(button);

        expect(onResend).not.toHaveBeenCalled();
    });

    it('keeps the button mounted and focused when the cooldown restarts', async () => {
        const user = userEvent.setup();
        const props = {
            onResend: () => {},
            sentTo: 'ana@skrum.test',
            locale: 'en' as const,
        };
        const { rerender } = render(<ResendCode {...props} remaining={0} />);
        const button = screen.getByRole('button', { name: 'Resend the code' });

        await user.click(button);
        rerender(<ResendCode {...props} remaining={60} />);

        expect(screen.getByRole('button', { name: 'Resend the code' })).toBe(
            button,
        );
        expect(document.activeElement).toBe(button);
        expect(screen.getByRole('status').textContent).toBe(
            'A new code was sent to ana@skrum.test',
        );
    });

    it('offers the button once the countdown ends and calls onResend', () => {
        const onResend = vi.fn();
        render(
            <ResendCode
                remaining={0}
                onResend={onResend}
                locale="fr"
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Resend the code' }));
        expect(onResend).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('status').textContent).toBe(
            'You can resend the code',
        );
    });

    it('keeps confirming the new code while the countdown runs, even when the server counts from 59', () => {
        const props = {
            onResend: () => {},
            sentTo: 'ana@skrum.test',
            locale: 'en' as const,
        };
        const { rerender } = render(<ResendCode {...props} remaining={0} />);

        rerender(<ResendCode {...props} remaining={59} />);

        expect(screen.getByRole('status').textContent).toBe(
            'A new code was sent to ana@skrum.test',
        );

        rerender(<ResendCode {...props} remaining={42} />);

        expect(screen.getByRole('status').className).not.toContain('sr-only');
        expect(screen.getByRole('status').textContent).toBe(
            'A new code was sent to ana@skrum.test',
        );
    });

    it('confirms a new code just sent to the address', () => {
        render(
            <ResendCode
                remaining={60}
                onResend={() => {}}
                sentTo="ana@skrum.test"
                locale="en"
            />,
        );

        expect(
            screen.getByText('A new code was sent to ana@skrum.test'),
        ).toBeTruthy();
    });
});

describe('InputOTP keyboard', () => {
    it('advances while typing and completes on the sixth digit', async () => {
        const user = userEvent.setup();
        const onComplete = vi.fn();
        render(<Field onComplete={onComplete} />);
        const input = screen.getByRole('textbox') as HTMLInputElement;

        await user.click(input);
        await user.keyboard('48291');

        expect(input.value).toBe('48291');
        expect(onComplete).not.toHaveBeenCalled();

        await user.keyboard('3');

        expect(onComplete).toHaveBeenCalledWith('482913');
    });

    it('removes the last digit on Backspace', async () => {
        const user = userEvent.setup();
        render(<Field />);
        const input = screen.getByRole('textbox') as HTMLInputElement;

        await user.click(input);
        await user.keyboard('482{Backspace}');

        expect(input.value).toBe('48');
    });

    it('selects the whole code when an error arrives, ready to retype', () => {
        function WithError({ error }: { error?: string }) {
            return (
                <InputOTP
                    maxLength={6}
                    defaultValue="482913"
                    label="Verification code"
                    error={error}
                >
                    <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                            <InputOTPSlot key={index} index={index} />
                        ))}
                    </InputOTPGroup>
                </InputOTP>
            );
        }

        const { rerender } = render(<WithError />);
        const input = screen.getByRole('textbox') as HTMLInputElement;

        input.setSelectionRange(6, 6);
        rerender(<WithError error="Invalid code." />);

        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe(6);
    });

    it.each(['482-913', '482 913', ' 482 - 913 '])(
        'fills every slot when "%s" is pasted',
        async (clipboard) => {
            const user = userEvent.setup();
            const onComplete = vi.fn();
            const { container } = render(<Field onComplete={onComplete} />);
            const input = screen.getByRole('textbox') as HTMLInputElement;

            await user.click(input);
            await user.paste(clipboard);

            expect(input.value).toBe('482913');
            expect(onComplete).toHaveBeenCalledWith('482913');
            expect(
                Array.from(
                    container.querySelectorAll('[data-slot="input-otp-slot"]'),
                    (slot) => slot.textContent,
                ).join(''),
            ).toBe('482913');
        },
    );
});
