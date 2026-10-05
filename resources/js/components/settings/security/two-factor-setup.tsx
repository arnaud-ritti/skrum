import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { Check, Copy } from 'lucide-react';
import { Fragment, useEffect, useId, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import { SkrumLogo } from '@/components/skrum/skrum-logo';
import { Skeleton } from '@/components/ui/skeleton';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import { OTP_MAX_LENGTH } from '@/hooks/use-two-factor-auth';

const groupSize = OTP_MAX_LENGTH / 2;
const slotGroups = [0, groupSize].map((start) =>
    Array.from({ length: groupSize }, (_, offset) => start + offset),
);

/** The setup key in groups of four, as authenticator apps show it. */
export function groupSetupKey(key: string): string {
    return key.match(/.{1,4}/g)?.join(' ') ?? key;
}

export function StepNumber({
    children,
}: {
    children: ReactNode;
}): ReactElement {
    return (
        <span
            aria-hidden="true"
            data-slot="step-number"
            className="grid size-6 shrink-0 place-items-center rounded-full bg-skrum-primary-soft text-xs font-bold text-skrum-primary-text"
        >
            {children}
        </span>
    );
}

type TwoFactorSetupProps = {
    /** Fortify's QR code, an SVG document; null while it is fetched. */
    qrCodeSvg: string | null;
    manualSetupKey: string | null;
    /** The server asks for a code before it turns the second factor on. */
    requiresConfirmation: boolean;
    code: string;
    onCodeChange: (code: string) => void;
    codeError?: string;
    processing: boolean;
};

export function TwoFactorSetup({
    qrCodeSvg,
    manualSetupKey,
    requiresConfirmation,
    code,
    onCodeChange,
    codeError,
    processing,
}: TwoFactorSetupProps): ReactElement {
    const { t } = useTrans();
    const [copied, copy] = useClipboard();
    const codeId = useId();
    const codeInput = useRef<HTMLInputElement>(null);
    const keyCopied = manualSetupKey !== null && copied === manualSetupKey;

    /* A disabled field loses the focus: a refused code is given back selected. */
    useEffect(() => {
        if (codeError && !processing) {
            codeInput.current?.focus();
            codeInput.current?.select();
        }
    }, [codeError, processing]);

    return (
        <div
            data-slot="two-factor-setup"
            className="grid items-start gap-6 sm:grid-cols-[13.5rem_minmax(0,1fr)] sm:gap-8"
        >
            <div
                data-slot="two-factor-qr"
                role="img"
                aria-label={t('QR code for your authenticator app')}
                className="light mx-auto w-full max-w-54 rounded-xl border bg-card p-3 shadow-card"
            >
                {qrCodeSvg === null ? (
                    <Skeleton className="aspect-square w-full" />
                ) : (
                    <div className="relative aspect-square w-full">
                        <div
                            className="size-full [&_svg]:size-full"
                            dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                        />
                        <span
                            data-slot="two-factor-qr-logo"
                            className="absolute inset-0 m-auto size-1/4 rounded-md bg-card p-1"
                        >
                            <SkrumLogo
                                variant="symbol"
                                decorative
                                className="size-full"
                            />
                        </span>
                    </div>
                )}
            </div>

            <ol className="flex min-w-0 flex-col gap-6">
                <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                    <StepNumber>1</StepNumber>
                    <div className="flex min-w-0 flex-col gap-2">
                        <span className="text-sm font-semibold">
                            {t('Scan the QR code')}
                        </span>
                        <span className="text-sm text-muted-foreground">
                            {t(
                                'With an authenticator app: 1Password, Bitwarden, Aegis, Google Authenticator…',
                            )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {t("Can't scan it? Enter this key manually:")}
                        </span>
                        <div
                            data-slot="two-factor-key"
                            className="flex max-w-104 min-w-0 items-center gap-2 rounded-md border border-input bg-muted py-1 pr-1 pl-3"
                        >
                            {manualSetupKey === null ? (
                                <Skeleton className="h-5 flex-1 bg-muted-foreground/20" />
                            ) : (
                                <span className="min-w-0 flex-1 font-mono text-sm font-medium tracking-wide wrap-anywhere">
                                    {groupSetupKey(manualSetupKey)}
                                </span>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={manualSetupKey === null}
                                className="shrink-0"
                                onClick={() =>
                                    manualSetupKey !== null &&
                                    void copy(manualSetupKey)
                                }
                            >
                                {keyCopied ? (
                                    <Check aria-hidden="true" />
                                ) : (
                                    <Copy aria-hidden="true" />
                                )}
                                <span className="truncate">
                                    {keyCopied ? t('Copied') : t('Copy')}
                                </span>
                            </Button>
                        </div>
                    </div>
                </li>

                {requiresConfirmation && (
                    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                        <StepNumber>2</StepNumber>
                        <div className="flex min-w-0 flex-col gap-2">
                            <label
                                htmlFor={codeId}
                                className="text-sm font-semibold"
                            >
                                {t('Enter the 6-digit code')}
                            </label>
                            <InputOTP
                                ref={codeInput}
                                id={codeId}
                                name="code"
                                maxLength={OTP_MAX_LENGTH}
                                value={code}
                                onChange={onCodeChange}
                                pattern={REGEXP_ONLY_DIGITS}
                                autoComplete="one-time-code"
                                pushPasswordManagerStrategy="none"
                                disabled={processing}
                                error={codeError}
                                aria-describedby={`${codeId}-help`}
                            >
                                {slotGroups.map((slots, group) => (
                                    <Fragment key={slots[0]}>
                                        {group > 0 && <InputOTPSeparator />}
                                        <InputOTPGroup>
                                            {slots.map((index) => (
                                                <InputOTPSlot
                                                    key={index}
                                                    index={index}
                                                />
                                            ))}
                                        </InputOTPGroup>
                                    </Fragment>
                                ))}
                            </InputOTP>
                            <span
                                id={`${codeId}-help`}
                                className="text-body-sm text-muted-foreground"
                            >
                                {t('The code changes every 30 seconds.')}
                            </span>
                        </div>
                    </li>
                )}
            </ol>
        </div>
    );
}
