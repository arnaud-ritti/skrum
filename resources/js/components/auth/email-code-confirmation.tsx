import { useHttp, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import ConfirmationCodesController from '@/actions/App/Http/Controllers/Settings/ConfirmationCodesController';
import { CodeField } from '@/components/auth/two-factor-form';
import InputError from '@/components/input-error';
import { ResendCode } from '@/components/skrum/resend-code';
import { useSecondsLeft } from '@/hooks/use-seconds-left';
import { useTrans } from '@/hooks/use-trans';

type SentCode = { sentTo: string; resendIn: number };

/**
 * The confirmation of an account without a known password: a code is sent
 * to its address as soon as this shows, and is typed in the `code` field
 * of the form around it.
 */
export function EmailCodeConfirmation({
    error,
    processing = false,
}: {
    error?: string;
    processing?: boolean;
}): ReactElement {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const sending = useHttp<Record<string, never>, SentCode>();
    const [code, setCode] = useState('');
    const [sentTo, setSentTo] = useState<string>();
    const [sendError, setSendError] = useState<string>();
    const [remaining, restart] = useSecondsLeft(0);

    const send = (): void => {
        sending
            .post(ConfirmationCodesController.store.url(), {
                onError: (errors) => setSendError(errors.email_code),
            })
            .then((sent) => {
                setSendError(undefined);
                setSentTo(sent.sentTo);
                restart(sent.resendIn);
            })
            .catch(() => undefined);
    };

    useEffect(send, []);

    const sentence = t('Enter the 6-digit code sent to :address.').split(
        ':address',
    );

    return (
        <div
            data-slot="email-code-confirmation"
            className="flex min-w-0 flex-col gap-4"
        >
            {sentTo !== undefined && (
                <p className="text-sm text-muted-foreground">
                    {sentence[0]}
                    <strong className="font-semibold break-all text-foreground">
                        {sentTo}
                    </strong>
                    {sentence[1]}
                </p>
            )}
            <CodeField
                label={t('Code received by email')}
                value={code}
                onChange={setCode}
                error={error}
                processing={processing}
            />
            <ResendCode
                remaining={remaining}
                onResend={send}
                sentTo={sentTo}
                locale={locale}
            />
            <InputError role="alert" message={sendError} />
        </div>
    );
}
