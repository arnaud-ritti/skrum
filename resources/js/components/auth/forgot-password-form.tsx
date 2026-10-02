import { Form, Link } from '@inertiajs/react';
import { authLinkClass } from '@/components/auth/login-form';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TextField } from '@/components/skrum/text-field';
import { Alert } from '@/components/ui/alert';
import { useTrans } from '@/hooks/use-trans';
import { login } from '@/routes';
import { email } from '@/routes/password';

export type ForgotPasswordFormProps = {
    /** The server's sentence once the reset link was requested. */
    status?: string;
};

export function ForgotPasswordForm({ status }: ForgotPasswordFormProps) {
    const { t } = useTrans();

    return (
        <div
            data-slot="forgot-password-form"
            className="flex min-w-0 flex-col gap-4"
        >
            {status && <Alert variant="success" title={status} />}

            <Form {...email.form()} className="flex min-w-0 flex-col gap-4">
                {({ processing, errors }) => (
                    <>
                        <TextField
                            id="email"
                            name="email"
                            type="email"
                            label={t('Work email')}
                            required
                            autoFocus
                            autoComplete="email"
                            placeholder={t('email@example.com')}
                            error={errors.email}
                            className="max-md:h-12"
                        />

                        <LoadingButton
                            type="submit"
                            size="lg"
                            className="w-full"
                            loading={processing}
                            data-test="email-password-reset-link-button"
                        >
                            <span className="truncate">
                                {t('Email password reset link')}
                            </span>
                        </LoadingButton>
                    </>
                )}
            </Form>

            <p className="text-center text-sm text-muted-foreground">
                {t('Or, return to')}{' '}
                <Link href={login()} className={authLinkClass}>
                    {t('log in')}
                </Link>
            </p>
        </div>
    );
}
