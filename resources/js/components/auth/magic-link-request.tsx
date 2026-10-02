import { router, usePage } from '@inertiajs/react';
import {
    CircleAlert,
    Info,
    MailCheck,
    RefreshCw,
    WandSparkles,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import MagicLinksController from '@/actions/App/Http/Controllers/MagicLinksController';
import { authLinkClass } from '@/components/auth/auth-link';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { useSecondsLeft } from '@/hooks/use-seconds-left';
import { useTrans } from '@/hooks/use-trans';

const CooldownSeconds = 60;

type SendOptions = {
    onStart: () => void;
    onFinish: () => void;
    onSuccess: () => void;
    onError: (message: string | undefined) => void;
};

function sendMagicLink(email: string, options: SendOptions): void {
    router.post(
        MagicLinksController.store.url(),
        { email },
        {
            preserveScroll: true,
            preserveState: true,
            onStart: options.onStart,
            onFinish: options.onFinish,
            onSuccess: options.onSuccess,
            onError: (errors) => options.onError(errors.email),
        },
    );
}

function formatCountdown(seconds: number, locale: string): string {
    const digits = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 });

    return `${Math.floor(seconds / 60)}:${digits.format(seconds % 60)}`;
}

function RequestError({ message }: { message?: string }) {
    if (!message) {
        return null;
    }

    return (
        <p
            role="alert"
            data-slot="magic-link-error"
            className="flex items-center gap-1.5 text-body-sm text-skrum-destructive-text"
        >
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {message}
        </p>
    );
}

/**
 * Sends the address already typed in the login form's e-mail field: the
 * mockup has one field, not two. `ghost` is the button under "Log in";
 * `primary` is the button of the phone's "Magic link" tab.
 */
export function MagicLinkButton({
    email,
    onMissingAddress,
    onSent,
    variant = 'ghost',
    ref,
}: {
    email: string;
    onMissingAddress: () => void;
    onSent: () => void;
    variant?: 'ghost' | 'primary';
    ref?: Ref<HTMLButtonElement>;
}) {
    const { t } = useTrans();
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string>();

    const send = () => {
        if (email.trim() === '') {
            onMissingAddress();

            return;
        }

        sendMagicLink(email, {
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: () => {
                setError(undefined);
                onSent();
            },
            onError: setError,
        });
    };

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <LoadingButton
                ref={ref}
                type="button"
                variant={variant === 'primary' ? 'default' : 'ghost'}
                size={variant === 'primary' ? 'lg' : 'default'}
                className="w-full"
                loading={processing}
                data-test="magic-link-button"
                onClick={send}
            >
                <WandSparkles aria-hidden="true" />
                <span className="truncate">
                    {variant === 'primary'
                        ? t('Receive the magic link')
                        : t('E-mail me a magic link instead')}
                </span>
            </LoadingButton>
            <RequestError message={error} />
        </div>
    );
}

/**
 * The "link sent" state. It says the same thing for every address: the
 * server never tells whether an account exists, and neither does this.
 */
export function MagicLinkSent({
    email,
    onUseAnotherAddress,
}: {
    email: string;
    onUseAnotherAddress: () => void;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const heading = useRef<HTMLHeadingElement>(null);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string>();
    const [remaining, restart] = useSecondsLeft(CooldownSeconds);
    const sentence = t(
        'If an account exists for :email, a sign-in link is on its way. It is valid for 15 minutes and works once.',
    ).split(':email');

    useEffect(() => {
        heading.current?.focus();
    }, []);

    const resend = () =>
        sendMagicLink(email, {
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: () => {
                setError(undefined);
                restart(CooldownSeconds);
            },
            onError: setError,
        });

    return (
        <Card
            data-slot="magic-link-sent"
            className="mx-auto w-full max-w-md items-center gap-4 p-8 text-center max-md:p-6"
        >
            <span
                aria-hidden="true"
                className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-skrum-primary-soft text-skrum-primary-text"
            >
                <MailCheck className="size-7.5" />
            </span>
            <h2
                ref={heading}
                tabIndex={-1}
                className="text-xl font-title tracking-subheading outline-none"
            >
                {t('Check your inbox')}
            </h2>
            <p
                role="status"
                className="max-w-sm text-sm/snug text-muted-foreground"
            >
                {sentence[0]}
                <strong className="font-semibold break-all text-foreground">
                    {email}
                </strong>
                {sentence[1]}
            </p>
            <LoadingButton
                type="button"
                variant="ghost"
                loading={processing}
                disabled={remaining > 0}
                data-test="magic-link-resend-button"
                onClick={resend}
            >
                <RefreshCw aria-hidden="true" />
                <span className="truncate tabular-nums">
                    {remaining > 0
                        ? t('Resend in :time', {
                              time: formatCountdown(remaining, String(locale)),
                          })
                        : t('Resend the link')}
                </span>
            </LoadingButton>
            <RequestError message={error} />
            <Alert variant="info" className="max-w-sm text-left">
                <Info aria-hidden="true" />
                <AlertDescription className="text-body-sm">
                    {t(
                        'Nothing received? Check your spam folder. On a self-hosted instance, sending depends on the SMTP your admin configured.',
                    )}
                </AlertDescription>
            </Alert>
            <button
                type="button"
                className={`${authLinkClass} text-sm`}
                onClick={onUseAnotherAddress}
            >
                {t('Use another address')}
            </button>
        </Card>
    );
}
