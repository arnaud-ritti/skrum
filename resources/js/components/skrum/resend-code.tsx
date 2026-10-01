import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export interface ResendCodeProps {
    cooldownSeconds: number;
    remaining: number;
    onResend: () => void;
    sentTo?: string;
    locale: 'fr' | 'en';
}

function formatCountdown(seconds: number, locale: string): string {
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    const digits = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 });
    const minutes = Math.floor(safeSeconds / 60);

    return `${minutes}:${digits.format(safeSeconds % 60)}`;
}

export function ResendCode({
    cooldownSeconds,
    remaining,
    onResend,
    sentTo,
    locale,
}: ResendCodeProps) {
    const { t } = useTrans();
    const canResend = remaining <= 0;
    const justSent =
        !canResend && sentTo !== undefined && remaining >= cooldownSeconds;

    return (
        <div
            data-slot="resend-code"
            className="flex flex-wrap items-center gap-x-2 text-body-sm text-muted-foreground"
        >
            {justSent ? (
                <p className="text-skrum-success-text">
                    {t('A new code was sent to :address', { address: sentTo })}
                </p>
            ) : null}
            {!canResend ? (
                <p>
                    {t('Nothing received? Resend the code in')}{' '}
                    <span
                        data-slot="resend-code-countdown"
                        className="tabular-nums"
                    >
                        {formatCountdown(remaining, locale)}
                    </span>
                </p>
            ) : null}
            <span role="status" aria-live="polite" className="sr-only">
                {canResend ? t('You can resend the code') : ''}
            </span>
            {canResend ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="-ml-3 text-skrum-primary-text"
                    onClick={onResend}
                >
                    <RotateCw aria-hidden="true" />
                    <span className="truncate">{t('Resend the code')}</span>
                </Button>
            ) : null}
        </div>
    );
}
