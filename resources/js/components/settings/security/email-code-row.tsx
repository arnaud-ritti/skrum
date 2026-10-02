import { router, usePage } from '@inertiajs/react';
import { Mail, ShieldCheck, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import EmailSecondFactorCodesController from '@/actions/App/Http/Controllers/Settings/EmailSecondFactorCodesController';
import EmailSecondFactorsController from '@/actions/App/Http/Controllers/Settings/EmailSecondFactorsController';
import { CodeField } from '@/components/auth/two-factor-form';
import {
    turnOffButtonClass,
    TwoFactorRow,
} from '@/components/settings/security/two-factor-row';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { LoadingButton } from '@/components/skrum/loading-button';
import { ResendCode } from '@/components/skrum/resend-code';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSecondsLeft } from '@/hooks/use-seconds-left';
import { useTrans } from '@/hooks/use-trans';
import { OTP_MAX_LENGTH } from '@/hooks/use-two-factor-auth';
import { deleteVisit } from '@/lib/delete-visit';
import type { EmailSecondFactor } from '@/types/auth';

const CooldownSeconds = 60;

type EmailCodeRowProps = EmailSecondFactor & {
    /** The authenticator app is on: its recovery codes cover a lost mailbox. */
    appEnabled: boolean;
};

/**
 * The e-mail code as a method of the two-factor card: turned on with a code
 * received at the address, turned off on the same row.
 */
export function EmailCodeRow({
    available,
    enabled,
    address,
    resendIn,
    appEnabled,
}: EmailCodeRowProps): ReactElement {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [code, setCode] = useState('');
    const [enrolling, setEnrolling] = useState(!enabled && resendIn > 0);
    const [justRequested, setJustRequested] = useState(false);
    const [sending, setSending] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string>();
    const [turnOffOpen, setTurnOffOpen] = useState(false);
    const [turnOffError, setTurnOffError] = useState<string>();
    const [remaining, restart] = useSecondsLeft(resendIn);

    const requestCode = (): void => {
        router.post(
            EmailSecondFactorCodesController.store.url(),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setSending(true),
                onFinish: () => setSending(false),
                onSuccess: (page) => {
                    const { emailSecondFactor } = page.props as {
                        emailSecondFactor?: EmailSecondFactor;
                    };

                    setJustRequested(true);
                    setEnrolling(true);
                    restart(emailSecondFactor?.resendIn ?? CooldownSeconds);
                },
            },
        );
    };

    const stopEnrolling = (): void => {
        setCode('');
        setError(undefined);
        setEnrolling(false);
    };

    const turnOn = (event: FormEvent): void => {
        event.preventDefault();

        router.post(
            EmailSecondFactorsController.store.url(),
            { code },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onError: (errors) => setError(errors.code),
                onSuccess: stopEnrolling,
            },
        );
    };

    const turnOff = async (): Promise<void> => {
        setTurnOffError(undefined);

        try {
            await deleteVisit(EmailSecondFactorsController.destroy.url());
        } catch (failure) {
            setTurnOffError(t('Something went wrong. Please try again.'));

            throw failure;
        }
    };

    const changeTurnOffOpen = (open: boolean): void => {
        if (!open) {
            setTurnOffError(undefined);
        }

        setTurnOffOpen(open);
    };

    const showsEnrolment = !enabled && enrolling;

    const action = (): ReactElement | undefined => {
        if (enabled) {
            return (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={turnOffButtonClass}
                    onClick={() => setTurnOffOpen(true)}
                >
                    <ShieldOff aria-hidden="true" />
                    <span className="truncate">
                        {t('Turn off the e-mail code')}
                    </span>
                </Button>
            );
        }

        if (enrolling) {
            return undefined;
        }

        return (
            <LoadingButton
                type="button"
                size="sm"
                loading={sending}
                className="max-w-full"
                onClick={requestCode}
            >
                <Mail aria-hidden="true" />
                <span className="truncate">{t('Send me a code')}</span>
            </LoadingButton>
        );
    };

    const sameMailbox = t(
        'A sign-in link followed by an e-mail code proves the same mailbox twice. An authenticator app or a passkey protects better.',
    );

    const limits = appEnabled ? (
        <Alert variant="warning" title={sameMailbox} />
    ) : (
        <Alert
            variant="warning"
            title={t(
                'This factor has no recovery codes: if you lose access to your mailbox, you lose access to your account.',
            )}
            description={sameMailbox}
        />
    );

    return (
        <TwoFactorRow
            icon={Mail}
            title={t('E-mail code')}
            description={t(
                'Receive a 6-digit code at :address each time you sign in.',
                { address },
            )}
            action={action()}
        >
            {enabled && !available && (
                <Alert
                    variant="destructive"
                    title={t(
                        'E-mail is not available on this instance, so no code can be sent. Contact your administrator.',
                    )}
                />
            )}
            {enabled && !appEnabled && limits}
            {showsEnrolment && (
                <form
                    onSubmit={turnOn}
                    noValidate
                    data-slot="email-code-enrolment"
                    className="flex min-w-0 flex-col gap-4"
                >
                    <CodeField
                        label={t('Code received by e-mail')}
                        value={code}
                        onChange={setCode}
                        error={error}
                        processing={processing}
                        autoFocus={justRequested}
                    />
                    <ResendCode
                        cooldownSeconds={CooldownSeconds}
                        remaining={remaining}
                        onResend={requestCode}
                        sentTo={address}
                        locale={locale}
                    />
                    {limits}
                    <div className="flex flex-wrap items-center justify-end gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={processing}
                            className="max-w-full"
                            onClick={stopEnrolling}
                        >
                            <span className="truncate">{t('Cancel')}</span>
                        </Button>
                        <LoadingButton
                            type="submit"
                            size="sm"
                            loading={processing}
                            disabled={code.length < OTP_MAX_LENGTH}
                            className="max-w-full"
                        >
                            <ShieldCheck aria-hidden="true" />
                            <span className="truncate">{t('Turn on')}</span>
                        </LoadingButton>
                    </div>
                </form>
            )}
            <ConfirmDialog
                open={turnOffOpen}
                onOpenChange={changeTurnOffOpen}
                error={turnOffError}
                tone="destructive"
                title={t('Turn off the e-mail code?')}
                description={
                    appEnabled
                        ? t(
                              'The authenticator app keeps protecting your account.',
                          )
                        : t(
                              'Your account will be protected by your password only.',
                          )
                }
                confirmLabel={t('Turn off the e-mail code')}
                onConfirm={turnOff}
            />
        </TwoFactorRow>
    );
}
