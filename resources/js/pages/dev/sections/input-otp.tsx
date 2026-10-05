import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { ResendCode } from '@/components/skrum/resend-code';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'ui';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function Otp({
    label,
    initial = '',
    ...rest
}: {
    label: string;
    initial?: string;
    error?: string;
    pasted?: boolean;
    disabled?: boolean;
    autoFocus?: boolean;
}) {
    const [value, setValue] = useState(initial);

    return (
        <InputOTP
            maxLength={6}
            value={value}
            onChange={setValue}
            label={label}
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

export default function InputOtpSection() {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const label = t('Verification code');

    return (
        <section className="@container grid gap-4 p-4 md:grid-cols-2 md:p-6">
            <State label={t('Code: empty (click to see the focus ring)')}>
                <Otp label={label} />
            </State>
            <State label={t('Code: being typed')}>
                <Otp label={label} initial="482" />
            </State>
            <State label={t('Code: complete')}>
                <Otp label={label} initial="482913" />
            </State>
            <State label={t('Code: error, content selected for retyping')}>
                <Otp
                    label={label}
                    initial="482913"
                    error={t('Invalid code. :count attempts left.', {
                        count: 2,
                    })}
                />
            </State>
            <State label={t('Code: pasted from the clipboard')}>
                <Otp label={label} initial="482913" pasted />
            </State>
            <State label={t('Code: disabled while verifying')}>
                <Otp label={label} initial="482913" disabled />
            </State>
            <State label={t('Resend: waiting, countdown running')}>
                <ResendCode
                    cooldownSeconds={60}
                    remaining={42}
                    onResend={() => {}}
                    locale={locale}
                />
            </State>
            <State label={t('Resend: available')}>
                <ResendCode
                    cooldownSeconds={60}
                    remaining={0}
                    onResend={() => {}}
                    locale={locale}
                />
            </State>
            <State label={t('Resend: new code sent')}>
                <ResendCode
                    cooldownSeconds={60}
                    remaining={60}
                    onResend={() => {}}
                    sentTo="ana@skrum.test"
                    locale={locale}
                />
            </State>
        </section>
    );
}
