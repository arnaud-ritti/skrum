import { Form, Link } from '@inertiajs/react';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { logout } from '@/routes';
import { send } from '@/routes/verification';

export type VerifyEmailFormProps = {
    /** `verification-link-sent` once a new link was requested. */
    status?: string;
};

export function VerifyEmailForm({ status }: VerifyEmailFormProps) {
    const { t } = useTrans();

    return (
        <div
            data-slot="verify-email-form"
            className="flex min-w-0 flex-col gap-4"
        >
            {status === 'verification-link-sent' && (
                <Alert
                    variant="success"
                    title={t(
                        'A new verification link has been sent to the email address you provided during registration.',
                    )}
                />
            )}

            <Form {...send.form()} className="flex min-w-0 flex-col">
                {({ processing }) => (
                    <LoadingButton
                        type="submit"
                        variant="secondary"
                        size="lg"
                        className="w-full"
                        loading={processing}
                    >
                        <span className="truncate">
                            {t('Resend verification email')}
                        </span>
                    </LoadingButton>
                )}
            </Form>

            <Button asChild variant="ghost" size="lg" className="w-full">
                <Link href={logout()} as="button">
                    <span className="truncate">{t('Log out')}</span>
                </Link>
            </Button>
        </div>
    );
}
