import { Form, router, usePage } from '@inertiajs/react';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import EmailChallengeCodesController from '@/actions/App/Http/Controllers/EmailChallengeCodesController';
import EmailCodeChallengesController from '@/actions/App/Http/Controllers/EmailCodeChallengesController';
import { CodeField } from '@/components/auth/two-factor-form';
import InputError from '@/components/input-error';
import { LoadingButton } from '@/components/skrum/loading-button';
import { ResendCode } from '@/components/skrum/resend-code';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSecondsLeft } from '@/hooks/use-seconds-left';
import { useTrans } from '@/hooks/use-trans';
import { OTP_MAX_LENGTH } from '@/hooks/use-two-factor-auth';
import type { EmailCodeChallengeState } from '@/types/auth';

const CooldownSeconds = 60;

/**
 * The second factor received by e-mail. Its code goes to its own route,
 * never to the one of the authenticator app.
 */
export function EmailCodeChallenge({
    sentTo,
    resendIn,
    available,
}: EmailCodeChallengeState) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [code, setCode] = useState('');
    const [remaining, restart] = useSecondsLeft(resendIn);
    const [resendError, setResendError] = useState<string>();
    const sentence = t('Enter the 6-digit code sent to :address.').split(
        ':address',
    );

    const resend = (): void => {
        router.post(
            EmailChallengeCodesController.store.url(),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onError: (errors) => setResendError(errors.email_code),
                onSuccess: (page) => {
                    const { emailCode } = page.props as {
                        emailCode?: EmailCodeChallengeState | null;
                    };

                    setResendError(undefined);
                    restart(emailCode?.resendIn ?? CooldownSeconds);
                },
            },
        );
    };

    return (
        <Form
            {...EmailCodeChallengesController.store.form()}
            resetOnSuccess
            data-slot="email-code-challenge"
            className="flex min-w-0 flex-col gap-4"
        >
            {({ errors, processing }) => (
                <>
                    <p className="text-sm text-muted-foreground">
                        {sentence[0]}
                        <strong className="font-semibold break-all text-foreground">
                            {sentTo}
                        </strong>
                        {sentence[1]}
                    </p>

                    <CodeField
                        label={t('Code received by e-mail')}
                        value={code}
                        onChange={setCode}
                        error={errors.code}
                        processing={processing}
                    />

                    <LoadingButton
                        type="submit"
                        size="lg"
                        className="w-full"
                        loading={processing}
                        disabled={code.length < OTP_MAX_LENGTH}
                    >
                        <span className="truncate">{t('Continue')}</span>
                    </LoadingButton>

                    {available ? (
                        <>
                            <ResendCode
                                cooldownSeconds={CooldownSeconds}
                                remaining={remaining}
                                onResend={resend}
                                sentTo={sentTo}
                                locale={locale}
                            />
                            <InputError role="alert" message={resendError} />
                        </>
                    ) : (
                        <Alert variant="destructive">
                            <CircleAlert aria-hidden="true" />
                            <AlertDescription className="text-body-sm">
                                {t(
                                    'E-mail is not available on this instance, so no code can be sent. Contact your administrator.',
                                )}
                            </AlertDescription>
                        </Alert>
                    )}
                </>
            )}
        </Form>
    );
}
