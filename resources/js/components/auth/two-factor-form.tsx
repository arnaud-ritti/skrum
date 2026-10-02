import { Form } from '@inertiajs/react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { authLinkClass } from '@/components/auth/auth-link';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TextField } from '@/components/skrum/text-field';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { OTP_MAX_LENGTH } from '@/hooks/use-two-factor-auth';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { store } from '@/routes/two-factor/login';

export type TwoFactorMode = 'code' | 'recovery';

export type TwoFactorFormProps = {
    mode: TwoFactorMode;
    onModeChange: (mode: TwoFactorMode) => void;
};

const groupSize = OTP_MAX_LENGTH / 2;
const slotGroups = [0, groupSize].map((start) =>
    Array.from({ length: groupSize }, (_, offset) => start + offset),
);

/**
 * Six digits in two groups of three, sent by themselves at the sixth: the
 * field of the authenticator code and of the code received by e-mail.
 */
export function CodeField({
    label,
    value,
    onChange,
    error,
    processing,
    autoFocus = true,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    processing: boolean;
    autoFocus?: boolean;
}) {
    const id = useId();
    const input = useRef<HTMLInputElement>(null);

    /* A disabled field loses the focus: a refused code is given back selected. */
    useEffect(() => {
        if (error && !processing) {
            input.current?.focus();
            input.current?.select();
        }
    }, [error, processing]);

    return (
        <div
            data-slot="two-factor-code"
            className="flex min-w-0 flex-col gap-1.5"
        >
            <Label htmlFor={id} className={cn(processing && 'opacity-55')}>
                {label}
            </Label>
            <InputOTP
                ref={input}
                id={id}
                name="code"
                maxLength={OTP_MAX_LENGTH}
                value={value}
                onChange={onChange}
                onComplete={() => input.current?.form?.requestSubmit()}
                pattern={REGEXP_ONLY_DIGITS}
                disabled={processing}
                error={error}
                autoFocus={autoFocus}
            >
                {slotGroups.map((slots, group) => (
                    <Fragment key={slots[0]}>
                        {group > 0 && <InputOTPSeparator />}
                        <InputOTPGroup>
                            {slots.map((index) => (
                                <InputOTPSlot key={index} index={index} />
                            ))}
                        </InputOTPGroup>
                    </Fragment>
                ))}
            </InputOTP>
        </div>
    );
}

export function TwoFactorForm({ mode, onModeChange }: TwoFactorFormProps) {
    const { t } = useTrans();
    const [code, setCode] = useState('');
    const recovery = mode === 'recovery';

    return (
        <Form
            {...store.form()}
            resetOnError={recovery}
            resetOnSuccess={!recovery}
            data-slot="two-factor-form"
            className="flex min-w-0 flex-col gap-4"
        >
            {({ errors, processing, clearErrors }) => (
                <>
                    {recovery ? (
                        <TextField
                            name="recovery_code"
                            label={t('Recovery code')}
                            placeholder={t('Enter recovery code')}
                            required
                            autoFocus
                            autoComplete="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            error={errors.recovery_code}
                            className="font-mono placeholder:font-sans max-md:h-12"
                        />
                    ) : (
                        <CodeField
                            label={t('Authentication code')}
                            value={code}
                            onChange={setCode}
                            error={errors.code}
                            processing={processing}
                        />
                    )}

                    <LoadingButton
                        type="submit"
                        size="lg"
                        className="w-full"
                        loading={processing}
                        disabled={!recovery && code.length < OTP_MAX_LENGTH}
                    >
                        <span className="truncate">{t('Continue')}</span>
                    </LoadingButton>

                    <p className="text-center text-sm text-muted-foreground">
                        {t('or you can')}{' '}
                        <button
                            type="button"
                            data-slot="two-factor-mode"
                            className={cn(authLinkClass, 'cursor-pointer')}
                            onClick={() => {
                                clearErrors();
                                setCode('');
                                onModeChange(recovery ? 'code' : 'recovery');
                            }}
                        >
                            {recovery
                                ? t('login using an authentication code')
                                : t('login using a recovery code')}
                        </button>
                    </p>
                </>
            )}
        </Form>
    );
}
