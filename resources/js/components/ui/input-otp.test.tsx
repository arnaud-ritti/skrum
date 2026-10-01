import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ResendCode } from '@/components/skrum/resend-code';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from '@/components/ui/input-otp';

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
    it('shows a tabular countdown and no button while waiting', () => {
        render(
            <ResendCode
                cooldownSeconds={60}
                remaining={42}
                onResend={() => {}}
                locale="en"
            />,
        );

        expect(screen.getByText('0:42')).toBeTruthy();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('offers the button once the countdown ends and calls onResend', () => {
        const onResend = vi.fn();
        render(
            <ResendCode
                cooldownSeconds={60}
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

    it('confirms a new code just sent to the address', () => {
        render(
            <ResendCode
                cooldownSeconds={60}
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
